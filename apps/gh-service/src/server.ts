import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { z } from 'zod';
import type { GhServiceConfig } from './config.js';
import { HttpError, authenticateRequest } from './auth.js';
import { checkGhRuntimeStatus } from './github.js';
import type { Logger } from './logger.js';
import {
  ConnectionManagerError,
  type ConnectionManager,
} from './connection-manager.js';
import {
  GhRunnerError,
  discoverPullRequests,
  fetchPullRequestBundleData,
} from './gh-runner.js';
import { maskUserId, sanitizeLogMessage } from './logging-utils.js';
import {
  ConvexBackendClient,
  ConvexBackendError,
} from './convex-backend-client.js';
import { syncUserNotifications } from './notification-sync.js';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

interface JsonObject {
  [key: string]: unknown;
}

const prDiscoverInputSchema = z.object({
  repo: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
      'repo must use owner/repo format'
    ),
  state: z.enum(['open', 'closed', 'merged', 'all']).default('open'),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const prBundleInputSchema = z.object({
  repo: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
      'repo must use owner/repo format'
    ),
  number: z.coerce.number().int().min(1),
  includeChecks: z.coerce.boolean().default(false),
});

const notificationSyncInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: JsonObject
): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function normalizeOriginHeader(
  value: string | string[] | undefined
): string | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function setCorsHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  config: GhServiceConfig
): void {
  const origin = normalizeOriginHeader(req.headers.origin);
  if (!origin) {
    return;
  }

  if (!config.corsOrigins.includes(origin)) {
    return;
  }

  res.setHeader('access-control-allow-origin', origin);
  res.setHeader(
    'access-control-allow-headers',
    'authorization, content-type, x-devsuite-user-id'
  );
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('vary', 'Origin');
}

async function readJsonBody(req: IncomingMessage): Promise<JsonObject> {
  const chunks: Buffer[] = [];
  const maxBytes = 256 * 1024;
  let totalBytes = 0;

  for await (const chunk of req) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += value.length;
    if (totalBytes > maxBytes) {
      throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
    }
    chunks.push(value);
  }

  if (chunks.length === 0) {
    return {};
  }

  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Expected JSON object');
    }
    return parsed as JsonObject;
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Malformed JSON body');
  }
}

function sendError(
  res: ServerResponse,
  requestId: string,
  error: unknown
): void {
  if (error instanceof HttpError) {
    const payload: ErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        requestId,
      },
    };
    sendJson(res, error.statusCode, payload as unknown as JsonObject);
    return;
  }

  if (error instanceof ConnectionManagerError) {
    const statusCode = error.code === 'LOGIN_PENDING' ? 409 : 401;
    const payload: ErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        requestId,
      },
    };
    sendJson(res, statusCode, payload as unknown as JsonObject);
    return;
  }

  if (error instanceof GhRunnerError) {
    const statusCode = error.code === 'INVALID_OUTPUT' ? 502 : 400;
    const payload: ErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        requestId,
      },
    };
    sendJson(res, statusCode, payload as unknown as JsonObject);
    return;
  }

  if (error instanceof ConvexBackendError) {
    const payload: ErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        requestId,
      },
    };
    sendJson(res, error.statusCode, payload as unknown as JsonObject);
    return;
  }

  const payload: ErrorBody = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      requestId,
    },
  };
  sendJson(res, 500, payload as unknown as JsonObject);
}

export function createGhServiceServer(
  config: GhServiceConfig,
  logger: Logger,
  connectionManager: ConnectionManager,
  backendClient: ConvexBackendClient | null = null
) {
  return createServer(async (req, res) => {
    const requestId = randomUUID();
    const method = req.method ?? 'GET';
    const url = new URL(
      req.url ?? '/',
      `http://${req.headers.host ?? 'localhost'}`
    );
    const startedAt = Date.now();

    setCorsHeaders(req, res, config);

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      if (method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, {
          ok: true,
          service: '@devsuite/gh-service',
          requestId,
          timestamp: Date.now(),
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/ready') {
        const status = await checkGhRuntimeStatus();
        sendJson(res, 200, {
          ok: status.installed,
          requestId,
          runtime: {
            ghInstalled: status.installed,
            ghVersion: status.version,
            convexConfigured: Boolean(config.convexSiteUrl),
          },
          checkedAt: status.checkedAt,
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/github/connect/start') {
        const auth = authenticateRequest(req, config);
        await readJsonBody(req);
        const connection = await connectionManager.startLogin(auth.userId);

        logger.info('connect-start requested', {
          requestId,
          user: maskUserId(auth.userId),
          state: connection.state,
        });

        sendJson(res, 200, {
          requestId,
          userId: auth.userId,
          connection,
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/github/connect/status') {
        const auth = authenticateRequest(req, config);
        const runtime = await checkGhRuntimeStatus();
        const connection = await connectionManager.getStatus(auth.userId);

        const logMethod =
          connection.state === 'disconnected' ? logger.debug : logger.info;
        logMethod('connect-status requested', {
          requestId,
          user: maskUserId(auth.userId),
          state: connection.state,
          githubUser: connection.githubUser,
          hasError: Boolean(connection.lastError),
        });

        sendJson(res, 200, {
          requestId,
          userId: auth.userId,
          connection,
          runtime: {
            ghInstalled: runtime.installed,
            ghVersion: runtime.version,
            error: runtime.error,
          },
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/github/disconnect') {
        const auth = authenticateRequest(req, config);
        await readJsonBody(req);
        const connection = await connectionManager.disconnect(auth.userId);

        logger.info('disconnect requested', {
          requestId,
          user: maskUserId(auth.userId),
          state: connection.state,
        });

        sendJson(res, 200, {
          requestId,
          userId: auth.userId,
          connection,
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/github/pr/discover') {
        const auth = authenticateRequest(req, config);
        const rawBody = await readJsonBody(req);
        const parsedBody = prDiscoverInputSchema.safeParse(rawBody);
        if (!parsedBody.success) {
          const message =
            parsedBody.error.issues[0]?.message ?? 'Invalid request body';
          throw new HttpError(400, 'INVALID_INPUT', message);
        }

        const session = await connectionManager.getAuthenticatedToken(
          auth.userId
        );
        const pullRequests = await discoverPullRequests({
          token: session.token,
          repo: parsedBody.data.repo,
          state: parsedBody.data.state,
          limit: parsedBody.data.limit,
          audit: {
            actorId: auth.userId,
            logger,
          },
        });

        logger.info('pr-discover requested', {
          requestId,
          user: maskUserId(auth.userId),
          repo: parsedBody.data.repo,
          state: parsedBody.data.state,
          limit: parsedBody.data.limit,
          resultCount: pullRequests.length,
        });

        sendJson(res, 200, {
          requestId,
          userId: auth.userId,
          repo: parsedBody.data.repo,
          pullRequests,
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/github/pr/bundle-data') {
        const auth = authenticateRequest(req, config);
        const rawBody = await readJsonBody(req);
        const parsedBody = prBundleInputSchema.safeParse(rawBody);
        if (!parsedBody.success) {
          const message =
            parsedBody.error.issues[0]?.message ?? 'Invalid request body';
          throw new HttpError(400, 'INVALID_INPUT', message);
        }

        const session = await connectionManager.getAuthenticatedToken(
          auth.userId
        );
        const bundleData = await fetchPullRequestBundleData({
          token: session.token,
          repo: parsedBody.data.repo,
          number: parsedBody.data.number,
          includeChecks: parsedBody.data.includeChecks,
          audit: {
            actorId: auth.userId,
            logger,
          },
        });

        logger.info('pr-bundle-data requested', {
          requestId,
          user: maskUserId(auth.userId),
          repo: parsedBody.data.repo,
          number: parsedBody.data.number,
          includeChecks: parsedBody.data.includeChecks,
          fileCount: bundleData.metadata.files.length,
          hasChecks: bundleData.checks !== null,
        });

        sendJson(res, 200, {
          requestId,
          userId: auth.userId,
          repo: parsedBody.data.repo,
          number: parsedBody.data.number,
          metadata: bundleData.metadata,
          diff: bundleData.diff,
          checks: bundleData.checks,
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/github/notifications/sync') {
        const auth = authenticateRequest(req, config);
        if (!backendClient) {
          throw new HttpError(
            503,
            'BACKEND_NOT_CONFIGURED',
            'Notification backend integration is not configured'
          );
        }

        const rawBody = await readJsonBody(req);
        const parsedBody = notificationSyncInputSchema.safeParse(rawBody);
        if (!parsedBody.success) {
          const message =
            parsedBody.error.issues[0]?.message ?? 'Invalid request body';
          throw new HttpError(400, 'INVALID_INPUT', message);
        }
        const syncResult = await syncUserNotifications({
          connectionManager,
          backendClient,
          userId: auth.userId,
          batchSize: parsedBody.data.limit ?? config.notificationBatchSize,
          logger,
        }).catch(async (error: unknown) => {
          if (
            error instanceof ConnectionManagerError ||
            error instanceof GhRunnerError
          ) {
            try {
              await backendClient.recordSyncTelemetry(auth.userId, {
                githubUser: null,
                status: 'error',
                hasRouteMappings: false,
                companiesMatched: 0,
                notificationsFetched: 0,
                notificationsFiltered: 0,
                notificationsReceived: 0,
                notificationsRouted: 0,
                notificationsUnmatched: 0,
                deliveriesCreated: 0,
                deliveriesUpdated: 0,
                attemptedAt: Date.now(),
                errorCode: error.code,
                errorMessage: error.message,
              });
            } catch {
              // Ignore telemetry write failures.
            }
          }
          throw error;
        });

        logger.info('notifications-sync requested', {
          requestId,
          user: maskUserId(auth.userId),
          githubUser: syncResult.githubUser,
          companiesMatched: syncResult.companiesMatched,
          hasRouteMappings: syncResult.hasRouteMappings,
          notificationsFetched: syncResult.notificationsFetched,
          notificationsFiltered: syncResult.notificationsFiltered,
          notificationsReceived: syncResult.notificationsReceived,
          notificationsRouted: syncResult.notificationsRouted,
          notificationsUnmatched: syncResult.notificationsUnmatched,
          deliveriesCreated: syncResult.deliveriesCreated,
          deliveriesUpdated: syncResult.deliveriesUpdated,
        });

        sendJson(res, 200, {
          requestId,
          userId: auth.userId,
          sync: syncResult,
        });
        return;
      }

      sendJson(res, 404, {
        requestId,
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found',
        },
      });
    } catch (error) {
      if (!(error instanceof HttpError)) {
        logger.error('request failed', {
          requestId,
          method,
          path: url.pathname,
          error:
            error instanceof Error
              ? sanitizeLogMessage(error.message)
              : 'unknown error',
        });
      }
      sendError(res, requestId, error);
    } finally {
      logger.debug('request completed', {
        requestId,
        method,
        path: url.pathname,
        durationMs: Date.now() - startedAt,
      });
    }
  });
}
