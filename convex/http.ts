import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { authComponent, createAuth } from './betterAuth/auth';

const http = httpRouter();
const GH_SERVICE_BACKEND_TOKEN_ENV = 'DEVSUITE_GH_SERVICE_BACKEND_TOKEN';

// CORS handling is required for client-side frameworks (e.g. React SPA).
authComponent.registerRoutes(http, createAuth, { cors: true });

function jsonResponse(
  status: number,
  payload: Record<string, unknown>
): globalThis.Response {
  return new globalThis.Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function readBearerToken(request: globalThis.Request): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}

function authorizeGhServiceRequest(
  request: globalThis.Request
): globalThis.Response | null {
  const expectedToken = process.env[GH_SERVICE_BACKEND_TOKEN_ENV];
  if (!expectedToken) {
    return jsonResponse(503, {
      error: 'GitHub service backend token is not configured',
    });
  }

  const actualToken = readBearerToken(request);
  if (!actualToken || actualToken !== expectedToken) {
    return jsonResponse(401, {
      error: 'Unauthorized',
    });
  }

  return null;
}

interface GithubNotificationPayload {
  threadId: string;
  reason: string;
  title: string;
  url?: string | null;
  repoFullName?: string | null;
  orgLogin?: string | null;
  subjectType?: string | null;
  updatedAt?: number | null;
  unread: boolean;
  apiUrl?: string | null;
}

function parseNotificationsPayload(
  value: unknown
): GithubNotificationPayload[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed: GithubNotificationPayload[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const item = raw as {
      threadId?: unknown;
      reason?: unknown;
      title?: unknown;
      url?: unknown;
      repoFullName?: unknown;
      orgLogin?: unknown;
      subjectType?: unknown;
      updatedAt?: unknown;
      unread?: unknown;
      apiUrl?: unknown;
    };

    if (
      typeof item.threadId !== 'string' ||
      typeof item.reason !== 'string' ||
      typeof item.title !== 'string' ||
      typeof item.unread !== 'boolean'
    ) {
      return null;
    }

    if (
      item.url !== undefined &&
      item.url !== null &&
      typeof item.url !== 'string'
    ) {
      return null;
    }
    if (
      item.repoFullName !== undefined &&
      item.repoFullName !== null &&
      typeof item.repoFullName !== 'string'
    ) {
      return null;
    }
    if (
      item.orgLogin !== undefined &&
      item.orgLogin !== null &&
      typeof item.orgLogin !== 'string'
    ) {
      return null;
    }
    if (
      item.subjectType !== undefined &&
      item.subjectType !== null &&
      typeof item.subjectType !== 'string'
    ) {
      return null;
    }
    if (
      item.updatedAt !== undefined &&
      item.updatedAt !== null &&
      typeof item.updatedAt !== 'number'
    ) {
      return null;
    }
    if (
      item.apiUrl !== undefined &&
      item.apiUrl !== null &&
      typeof item.apiUrl !== 'string'
    ) {
      return null;
    }

    parsed.push({
      threadId: item.threadId,
      reason: item.reason,
      title: item.title,
      unread: item.unread,
      ...(item.url !== undefined ? { url: item.url } : {}),
      ...(item.repoFullName !== undefined
        ? { repoFullName: item.repoFullName }
        : {}),
      ...(item.orgLogin !== undefined ? { orgLogin: item.orgLogin } : {}),
      ...(item.subjectType !== undefined
        ? { subjectType: item.subjectType }
        : {}),
      ...(item.updatedAt !== undefined ? { updatedAt: item.updatedAt } : {}),
      ...(item.apiUrl !== undefined ? { apiUrl: item.apiUrl } : {}),
    });
  }

  return parsed;
}

const ghServiceListCompanyRoutes = httpAction(async (ctx, request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const authError = authorizeGhServiceRequest(request);
  if (authError) {
    return authError;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const userId =
    payload &&
    typeof payload === 'object' &&
    typeof (payload as { userId?: unknown }).userId === 'string'
      ? (payload as { userId: string }).userId.trim()
      : '';

  if (!userId) {
    return jsonResponse(400, { error: 'userId is required' });
  }

  const routes = await ctx.runQuery(internal.githubService.listCompanyRoutes, {
    userId,
  });

  return jsonResponse(200, { routes });
});

const ghServiceIngestNotifications = httpAction(async (ctx, request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const authError = authorizeGhServiceRequest(request);
  if (authError) {
    return authError;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  if (!payload || typeof payload !== 'object') {
    return jsonResponse(400, { error: 'Invalid payload' });
  }

  const userId =
    typeof (payload as { userId?: unknown }).userId === 'string'
      ? (payload as { userId: string }).userId.trim()
      : '';
  const notifications = parseNotificationsPayload(
    (payload as { notifications?: unknown }).notifications
  );

  if (!userId) {
    return jsonResponse(400, { error: 'userId is required' });
  }

  if (!notifications) {
    return jsonResponse(400, { error: 'notifications must be an array' });
  }

  const result = await ctx.runMutation(
    internal.githubService.ingestNotifications,
    {
      userId,
      notifications,
    }
  );

  return jsonResponse(200, result as Record<string, unknown>);
});

http.route({
  path: '/github/service/company-routes',
  method: 'POST',
  handler: ghServiceListCompanyRoutes,
});

http.route({
  path: '/github/service/ingest-notifications',
  method: 'POST',
  handler: ghServiceIngestNotifications,
});

export default http;
