import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { z } from 'zod';
import type { NotionServiceConfig } from './config.js';
import { HttpError, authenticateRequest } from './auth.js';
import type { Logger } from './logger.js';
import type {
  ConvexBackendClient,
  NotionWebhookEventPayload,
} from './convex-backend-client.js';
import {
  NotionConnectionManager,
  NotionConnectionManagerError,
} from './notion-connection-manager.js';
import { ConvexBackendError } from './convex-backend-client.js';
import { maskUserId, sanitizeLogMessage } from './logging-utils.js';
import { verifyNotionWebhookSignature } from './notion-webhook.js';

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

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const rateLimitBuckets = new Map<
  string,
  { windowStart: number; count: number }
>();
const WEBHOOK_REPLAY_WINDOW_MS = 5 * 60 * 1000;
const seenWebhookEvents = new Map<string, number>();

function getClientIdentifier(req: IncomingMessage): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwarded = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor;
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function enforceRateLimit(req: IncomingMessage, path: string): void {
  if (!path.startsWith('/notion/')) {
    return;
  }
  const now = Date.now();
  const key = `${getClientIdentifier(req)}:${path}`;
  const current = rateLimitBuckets.get(key);
  if (!current || now - current.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(key, { windowStart: now, count: 1 });
    return;
  }

  current.count += 1;
  if (current.count > RATE_LIMIT_MAX_REQUESTS) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many requests');
  }
}

function enforceWebhookReplayProtection(
  event: NotionWebhookEventPayload
): void {
  const now = Date.now();

  for (const [eventId, seenAt] of seenWebhookEvents.entries()) {
    if (now - seenAt > WEBHOOK_REPLAY_WINDOW_MS) {
      seenWebhookEvents.delete(eventId);
    }
  }

  if (seenWebhookEvents.has(event.eventId)) {
    throw new HttpError(
      409,
      'WEBHOOK_REPLAY_DETECTED',
      'Duplicate webhook event received'
    );
  }

  if (
    event.eventTimestamp !== null &&
    Math.abs(now - event.eventTimestamp) > WEBHOOK_REPLAY_WINDOW_MS
  ) {
    throw new HttpError(
      400,
      'WEBHOOK_TIMESTAMP_OUT_OF_WINDOW',
      'Webhook event timestamp is outside the allowed window'
    );
  }

  seenWebhookEvents.set(event.eventId, now);
}

export const __securityGuardsForTests = {
  enforceRateLimit,
  enforceWebhookReplayProtection,
  clear(): void {
    rateLimitBuckets.clear();
    seenWebhookEvents.clear();
  },
};

const notionCompanyInputSchema = z.object({
  companyId: z.string().trim().min(1, 'companyId is required'),
});

const notionLinkResolveInputSchema = notionCompanyInputSchema.extend({
  url: z
    .string()
    .trim()
    .min(1, 'url is required')
    .url('url must be a valid URL'),
});

const notionAssigneeOptionsInputSchema = notionCompanyInputSchema.extend({
  url: z
    .string()
    .trim()
    .min(1, 'url is required')
    .url('url must be a valid URL'),
});

const notionAssigneeConfigInputSchema = notionCompanyInputSchema.extend({
  mode: z.enum(['any_people', 'specific_property']),
  dataSourceId: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
  propertyName: z.string().optional().nullable(),
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
  config: NotionServiceConfig
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
    'authorization, content-type, x-devsuite-user-id, x-devsuite-user-token'
  );
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('vary', 'Origin');
}

async function readJsonBody(req: IncomingMessage): Promise<JsonObject> {
  const raw = await readRawBody(req);
  return parseJsonObject(raw);
}

function readHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }
  return value?.trim() || null;
}

async function readRawBody(req: IncomingMessage): Promise<string> {
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
    return '';
  }

  return Buffer.concat(chunks).toString('utf8');
}

function parseJsonObject(text: string): JsonObject {
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

function trimToNull(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function parseEventTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value !== 'string') {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const result = value
    .map(item => trimToNull(item))
    .filter((item): item is string => Boolean(item));
  return result.length > 0 ? result : null;
}

function parseNotionWebhookDataPageId(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const data = value as {
    page_id?: unknown;
    pageId?: unknown;
    parent?: unknown;
  };

  const directPageId = trimToNull(data.page_id) ?? trimToNull(data.pageId);
  if (directPageId) {
    return directPageId;
  }

  if (
    !data.parent ||
    typeof data.parent !== 'object' ||
    Array.isArray(data.parent)
  ) {
    return null;
  }

  const parent = data.parent as {
    type?: unknown;
    page_id?: unknown;
    page?: unknown;
  };
  const parentType = trimToNull(parent.type);
  if (parentType === 'page_id') {
    return trimToNull(parent.page_id);
  }
  if (parentType === 'page' && parent.page && typeof parent.page === 'object') {
    return trimToNull((parent.page as { id?: unknown }).id);
  }

  return null;
}

function buildNotionEntityUrl(identifier: string | null): string | null {
  if (!identifier) {
    return null;
  }
  const normalized = identifier.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(normalized)) {
    return null;
  }
  return `https://www.notion.so/${normalized}`;
}

function parseNotionWebhookEventPayload(
  value: unknown
): NotionWebhookEventPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as {
    id?: unknown;
    workspace_id?: unknown;
    type?: unknown;
    timestamp?: unknown;
    entity?: unknown;
    authors?: unknown;
    data?: unknown;
  };

  const eventId = trimToNull(payload.id);
  const workspaceId = trimToNull(payload.workspace_id);
  const eventType = trimToNull(payload.type);
  if (!eventId || !workspaceId || !eventType) {
    return null;
  }

  let entityType: string | null = null;
  let entityId: string | null = null;
  let entityUrl: string | null = null;
  if (
    payload.entity &&
    typeof payload.entity === 'object' &&
    !Array.isArray(payload.entity)
  ) {
    const entity = payload.entity as {
      type?: unknown;
      id?: unknown;
      url?: unknown;
    };
    entityType = trimToNull(entity.type);
    entityId = trimToNull(entity.id);
    entityUrl = trimToNull(entity.url);
  }

  let actorId: string | null = null;
  if (Array.isArray(payload.authors) && payload.authors.length > 0) {
    const firstAuthor = payload.authors[0];
    if (
      firstAuthor &&
      typeof firstAuthor === 'object' &&
      !Array.isArray(firstAuthor)
    ) {
      actorId = trimToNull((firstAuthor as { id?: unknown }).id);
    }
  }

  let title: string | null = null;
  let dataPageId: string | null = null;
  let updatedPropertyIds: string[] | null = null;
  if (
    payload.data &&
    typeof payload.data === 'object' &&
    !Array.isArray(payload.data)
  ) {
    const data = payload.data as {
      title?: unknown;
      plain_text?: unknown;
      updated_properties?: unknown;
    };
    title = trimToNull(data.title) ?? trimToNull(data.plain_text);
    dataPageId = parseNotionWebhookDataPageId(data);
    updatedPropertyIds = parseStringArray(data.updated_properties);
  }

  const eventTimestamp = parseEventTimestamp(payload.timestamp);

  const pageId = (entityType === 'page' ? entityId : null) ?? dataPageId;
  const databaseId = entityType === 'database' ? entityId : null;
  const commentId = entityType === 'comment' ? entityId : null;

  if (!entityUrl) {
    if (entityType === 'comment' && pageId) {
      entityUrl = buildNotionEntityUrl(pageId);
    } else {
      entityUrl = buildNotionEntityUrl(entityId);
    }
  }

  return {
    eventId,
    workspaceId,
    eventType,
    eventTimestamp,
    entityType,
    entityId,
    entityUrl,
    actorId,
    title,
    pageId,
    databaseId,
    commentId,
    updatedPropertyIds,
    updatedPropertyNames: null,
  };
}

function getPostAuthRedirectBase(config: NotionServiceConfig): string {
  if (config.notionPostAuthRedirectUrl) {
    return config.notionPostAuthRedirectUrl.replace(
      '/_app/settings/integrations',
      '/settings/integrations'
    );
  }

  const defaultOrigin = config.corsOrigins[0] ?? 'http://localhost:5173';
  return `${defaultOrigin.replace(/\/+$/g, '')}/settings/integrations`;
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

  if (error instanceof NotionConnectionManagerError) {
    const statusCode =
      error.code === 'NOT_CONFIGURED' || error.code === 'BACKEND_NOT_CONFIGURED'
        ? 503
        : error.code === 'WORKSPACE_CONFLICT'
          ? 409
          : error.code === 'TOKEN_INVALID' || error.code === 'NOT_CONNECTED'
            ? 401
            : error.code === 'INTEGRATION_DISABLED'
              ? 403
              : error.code === 'LINK_INVALID' || error.code === 'FILTER_INVALID'
                ? 422
                : 400;
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

export function createNotionServiceServer(
  config: NotionServiceConfig,
  logger: Logger,
  notionConnectionManager: NotionConnectionManager,
  backendClient: ConvexBackendClient | null
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

    enforceRateLimit(req, url.pathname);

    try {
      if (method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, {
          ok: true,
          service: '@devsuite/notion-service',
          requestId,
          timestamp: Date.now(),
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/ready') {
        sendJson(res, 200, {
          ok: Boolean(
            config.notionOauthClientId &&
            config.notionOauthClientSecret &&
            config.notionOauthRedirectUri
          ),
          requestId,
          runtime: {
            oauthConfigured: Boolean(
              config.notionOauthClientId &&
              config.notionOauthClientSecret &&
              config.notionOauthRedirectUri
            ),
            convexConfigured: Boolean(
              config.convexSiteUrl && config.backendToken
            ),
          },
          checkedAt: Date.now(),
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/notion/connect/callback') {
        const callbackResult =
          await notionConnectionManager.completeOAuthCallback({
            state: url.searchParams.get('state'),
            code: url.searchParams.get('code'),
            error: url.searchParams.get('error'),
            errorDescription: url.searchParams.get('error_description'),
          });

        const redirectBase = getPostAuthRedirectBase(config);
        let redirectUrl: URL;
        try {
          redirectUrl = new URL(redirectBase);
        } catch {
          redirectUrl = new URL('http://localhost:5173/settings/integrations');
        }

        redirectUrl.searchParams.set(
          'notionAuth',
          callbackResult.ok ? 'success' : 'error'
        );
        if (callbackResult.companyId) {
          redirectUrl.searchParams.set(
            'notionCompanyId',
            callbackResult.companyId
          );
        }
        if (!callbackResult.ok) {
          redirectUrl.searchParams.set('notionMessage', callbackResult.message);
        }

        logger.info('notion callback completed', {
          requestId,
          ok: callbackResult.ok,
          user: callbackResult.userId
            ? maskUserId(callbackResult.userId)
            : null,
          companyId: callbackResult.companyId,
          ...(callbackResult.ok
            ? {}
            : { error: sanitizeLogMessage(callbackResult.message) }),
        });

        res.statusCode = 302;
        res.setHeader('location', redirectUrl.toString());
        res.end();
        return;
      }

      if (method === 'POST' && url.pathname === '/notion/connect/start') {
        const auth = authenticateRequest(req, config);
        const rawBody = await readJsonBody(req);
        const parsedBody = notionCompanyInputSchema.safeParse(rawBody);
        if (!parsedBody.success) {
          const message =
            parsedBody.error.issues[0]?.message ?? 'Invalid request body';
          throw new HttpError(400, 'INVALID_INPUT', message);
        }

        const connection = await notionConnectionManager.startLogin(
          auth.userId,
          parsedBody.data.companyId
        );

        logger.info('notion connect-start requested', {
          requestId,
          user: maskUserId(auth.userId),
          companyId: parsedBody.data.companyId,
          state: connection.state,
        });

        sendJson(res, 200, {
          requestId,
          userId: auth.userId,
          companyId: parsedBody.data.companyId,
          connection,
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/notion/connect/status') {
        const auth = authenticateRequest(req, config);
        const companyId = url.searchParams.get('companyId')?.trim() ?? '';
        if (!companyId) {
          throw new HttpError(400, 'INVALID_INPUT', 'companyId is required');
        }

        const connection = await notionConnectionManager.getStatus(
          auth.userId,
          companyId
        );

        logger.info('notion connect-status requested', {
          requestId,
          user: maskUserId(auth.userId),
          companyId,
          state: connection.state,
          workspaceId: connection.workspaceId,
          hasError: Boolean(connection.lastError),
        });

        sendJson(res, 200, {
          requestId,
          userId: auth.userId,
          companyId,
          connection,
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/notion/links/resolve') {
        const auth = authenticateRequest(req, config);
        const rawBody = await readJsonBody(req);
        const parsedBody = notionLinkResolveInputSchema.safeParse(rawBody);
        if (!parsedBody.success) {
          const message =
            parsedBody.error.issues[0]?.message ?? 'Invalid request body';
          throw new HttpError(400, 'INVALID_INPUT', message);
        }

        const link = await notionConnectionManager.resolveLink(
          auth.userId,
          parsedBody.data.companyId,
          parsedBody.data.url
        );

        logger.info('notion link resolved', {
          requestId,
          user: maskUserId(auth.userId),
          companyId: parsedBody.data.companyId,
          entityType: link.entityType,
          identifier: link.identifier,
        });

        sendJson(res, 200, {
          requestId,
          userId: auth.userId,
          companyId: parsedBody.data.companyId,
          link,
        });
        return;
      }

      if (
        method === 'POST' &&
        url.pathname === '/notion/webhooks/assignee/options'
      ) {
        const auth = authenticateRequest(req, config);
        const rawBody = await readJsonBody(req);
        const parsedBody = notionAssigneeOptionsInputSchema.safeParse(rawBody);
        if (!parsedBody.success) {
          const message =
            parsedBody.error.issues[0]?.message ?? 'Invalid request body';
          throw new HttpError(400, 'INVALID_INPUT', message);
        }

        const options =
          await notionConnectionManager.getAssigneePropertyOptions(
            auth.userId,
            parsedBody.data.companyId,
            parsedBody.data.url
          );

        logger.info('notion assignee options resolved', {
          requestId,
          user: maskUserId(auth.userId),
          companyId: parsedBody.data.companyId,
          dataSourceId: options.dataSourceId,
          optionCount: options.options.length,
        });

        sendJson(res, 200, {
          requestId,
          userId: auth.userId,
          companyId: parsedBody.data.companyId,
          options,
        });
        return;
      }

      if (
        method === 'POST' &&
        url.pathname === '/notion/webhooks/assignee/config'
      ) {
        const auth = authenticateRequest(req, config);
        const rawBody = await readJsonBody(req);
        const parsedBody = notionAssigneeConfigInputSchema.safeParse(rawBody);
        if (!parsedBody.success) {
          const message =
            parsedBody.error.issues[0]?.message ?? 'Invalid request body';
          throw new HttpError(400, 'INVALID_INPUT', message);
        }

        const connection = await notionConnectionManager.updateAssigneeFilter(
          auth.userId,
          parsedBody.data.companyId,
          {
            mode: parsedBody.data.mode,
            dataSourceId: trimToNull(parsedBody.data.dataSourceId),
            propertyId: trimToNull(parsedBody.data.propertyId),
            propertyName: trimToNull(parsedBody.data.propertyName),
          }
        );

        logger.info('notion assignee filter updated', {
          requestId,
          user: maskUserId(auth.userId),
          companyId: parsedBody.data.companyId,
          mode: connection.assigneeFilter.mode,
          dataSourceId: connection.assigneeFilter.dataSourceId,
          propertyId: connection.assigneeFilter.propertyId,
        });

        sendJson(res, 200, {
          requestId,
          userId: auth.userId,
          companyId: parsedBody.data.companyId,
          connection,
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/notion/webhooks') {
        const rawBody = await readRawBody(req);
        const payload = parseJsonObject(rawBody);
        const verificationToken = trimToNull(
          (payload as { verification_token?: unknown }).verification_token
        );

        if (verificationToken) {
          if (
            config.notionWebhookVerificationToken &&
            verificationToken !== config.notionWebhookVerificationToken
          ) {
            throw new HttpError(
              401,
              'INVALID_WEBHOOK_VERIFICATION_TOKEN',
              'Webhook verification token did not match'
            );
          }

          logger.info('notion webhook verification received', {
            requestId,
            verified: Boolean(config.notionWebhookVerificationToken),
          });
          // One-time setup: when no token is configured, log it so you can set DEVSUITE_NOTION_WEBHOOK_VERIFICATION_TOKEN
          if (!config.notionWebhookVerificationToken) {
            logger.info(
              'notion webhook setup: copy this token to DEVSUITE_NOTION_WEBHOOK_VERIFICATION_TOKEN',
              {
                verificationToken,
              }
            );
          }
          sendJson(res, 200, {
            ok: true,
            requestId,
            verification: 'accepted',
          });
          return;
        }

        if (config.notionWebhookVerificationToken) {
          const signatureHeader = readHeaderValue(
            req.headers['x-notion-signature']
          );
          const verified = verifyNotionWebhookSignature({
            body: rawBody,
            signatureHeader,
            verificationToken: config.notionWebhookVerificationToken,
          });
          if (!verified) {
            throw new HttpError(
              401,
              'INVALID_WEBHOOK_SIGNATURE',
              'Webhook signature verification failed'
            );
          }
        }

        const event = parseNotionWebhookEventPayload(payload);
        if (!event) {
          throw new HttpError(
            400,
            'INVALID_INPUT',
            'Invalid Notion webhook event'
          );
        }
        enforceWebhookReplayProtection(event);

        const routingDecision =
          await notionConnectionManager.shouldRouteWebhookEvent(event);
        if (!routingDecision.shouldRoute) {
          logger.info('notion webhook event ignored', {
            requestId,
            eventId: event.eventId,
            workspaceId: event.workspaceId,
            eventType: event.eventType,
            reason: routingDecision.reason,
          });
          sendJson(res, 200, {
            requestId,
            received: true,
            ignored: true,
            reason: routingDecision.reason,
          });
          return;
        }

        if (!backendClient) {
          throw new HttpError(
            503,
            'BACKEND_NOT_CONFIGURED',
            'Notion webhook backend integration is not configured'
          );
        }

        const result = await backendClient.ingestNotionWebhookEvents([event]);
        logger.info('notion webhook event ingested', {
          requestId,
          eventId: event.eventId,
          workspaceId: event.workspaceId,
          eventType: event.eventType,
          filter: routingDecision.reason,
          routed: result.eventsRouted,
          unmatched: result.eventsUnmatched,
          created: result.deliveriesCreated,
        });

        sendJson(res, 200, {
          requestId,
          received: true,
          result,
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/notion/disconnect') {
        const auth = authenticateRequest(req, config);
        const rawBody = await readJsonBody(req);
        const parsedBody = notionCompanyInputSchema.safeParse(rawBody);
        if (!parsedBody.success) {
          const message =
            parsedBody.error.issues[0]?.message ?? 'Invalid request body';
          throw new HttpError(400, 'INVALID_INPUT', message);
        }

        const connection = await notionConnectionManager.disconnect(
          auth.userId,
          parsedBody.data.companyId
        );

        logger.info('notion disconnect requested', {
          requestId,
          user: maskUserId(auth.userId),
          companyId: parsedBody.data.companyId,
          state: connection.state,
        });

        sendJson(res, 200, {
          requestId,
          userId: auth.userId,
          companyId: parsedBody.data.companyId,
          connection,
        });
        return;
      }

      throw new HttpError(404, 'NOT_FOUND', 'Route not found');
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      const logPayload: Record<string, unknown> = {
        requestId,
        method,
        path: url.pathname,
        elapsedMs,
        error:
          error instanceof Error
            ? sanitizeLogMessage(error.message)
            : 'unknown',
      };
      if (error instanceof HttpError && error.code === 'UNAUTHORIZED') {
        logPayload.authHeaderPresent = Boolean(
          req.headers.authorization?.trim()
        );
        logPayload.origin = req.headers.origin ?? null;
        logPayload.serviceTokenConfigured = Boolean(config.serviceToken);
      }
      if (error instanceof ConvexBackendError) {
        logPayload.convexPath = error.path ?? null;
        logPayload.convexStatus = error.statusCode;
      }
      logger.warn('request failed', logPayload);
      sendError(res, requestId, error);
      return;
    }
  });
}
