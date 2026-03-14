import { httpRouter, type FunctionReference } from 'convex/server';
import { httpAction } from './_generated/server';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { authComponent, createAuth, requireSiteUrl } from './auth';

const http = httpRouter();
const GH_SERVICE_BACKEND_TOKEN_ENV = 'DEVSUITE_GH_SERVICE_BACKEND_TOKEN';
const NOTION_SERVICE_BACKEND_TOKEN_ENV =
  'DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN';
const MAX_INGEST_BATCH_ITEMS = 1000;
const MAX_INGEST_STRING_LENGTH = 4096;

export function assertServiceBackendTokensConfigured(
  env: Record<string, string | undefined> = process.env
): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }
  if (!env[GH_SERVICE_BACKEND_TOKEN_ENV]) {
    throw new Error(
      `${GH_SERVICE_BACKEND_TOKEN_ENV} is required in production`
    );
  }
  if (!env[NOTION_SERVICE_BACKEND_TOKEN_ENV]) {
    throw new Error(
      `${NOTION_SERVICE_BACKEND_TOKEN_ENV} is required in production`
    );
  }
}
assertServiceBackendTokensConfigured();

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

function getBrowserCorsHeaders(
  request: globalThis.Request
): Record<string, string> | null {
  const origin = request.headers.get('origin');
  if (!origin) {
    return {};
  }

  const allowedOrigins = new Set<string>();
  try {
    allowedOrigins.add(
      new globalThis.URL(requireSiteUrl(process.env.SITE_URL)).origin
    );
  } catch {
    // Ignore malformed configuration and fall back to deny.
  }
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.add('http://localhost:5173');
  }

  if (!allowedOrigins.has(origin)) {
    return null;
  }

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    vary: 'Origin',
  };
}

function emptyCorsResponse(
  request: globalThis.Request,
  status: number
): globalThis.Response {
  const headers = getBrowserCorsHeaders(request);
  if (headers === null) {
    return jsonResponse(403, { error: 'Forbidden origin' });
  }

  return new globalThis.Response(null, {
    status,
    headers,
  });
}

function jsonCorsResponse(
  request: globalThis.Request,
  status: number,
  payload: Record<string, unknown>
): globalThis.Response {
  const headers = getBrowserCorsHeaders(request);
  if (headers === null) {
    return jsonResponse(403, { error: 'Forbidden origin' });
  }

  return new globalThis.Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
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

function authorizeNotionServiceRequest(
  request: globalThis.Request
): globalThis.Response | null {
  const expectedToken = process.env[NOTION_SERVICE_BACKEND_TOKEN_ENV];
  if (!expectedToken) {
    return jsonResponse(503, {
      error: 'Notion service backend token is not configured',
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

const pauseSessionOnUnload = httpAction(async (ctx, request) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return jsonCorsResponse(request, 401, {
      error: 'Unauthorized',
    });
  }

  let payload: { companyId?: string; sessionId?: string };
  try {
    payload = JSON.parse(await request.text()) as {
      companyId?: string;
      sessionId?: string;
    };
  } catch {
    return jsonCorsResponse(request, 400, {
      error: 'Invalid request payload',
    });
  }

  const companyId = payload.companyId?.trim() as Id<'companies'> | undefined;
  const sessionId = payload.sessionId?.trim() as Id<'sessions'> | undefined;
  if (!companyId || !sessionId) {
    return jsonCorsResponse(request, 400, {
      error: 'companyId and sessionId are required',
    });
  }

  const activeSession = await ctx.runQuery(api.sessions.getActiveSession, {
    companyId,
  });
  if (
    !activeSession ||
    activeSession._id !== sessionId ||
    activeSession.status !== 'RUNNING'
  ) {
    return emptyCorsResponse(request, 204);
  }

  await ctx.runMutation(api.sessions.pauseSession, {
    companyId,
    sessionId,
  });

  return emptyCorsResponse(request, 204);
});

http.route({
  path: '/web/session/pause-on-unload',
  method: 'POST',
  handler: pauseSessionOnUnload,
});

interface GithubSyncTelemetryPayload {
  githubUser?: string | null;
  status: 'success' | 'skipped_no_routes' | 'error';
  hasRouteMappings: boolean;
  companiesMatched: number;
  notificationsFetched: number;
  notificationsFiltered: number;
  notificationsReceived: number;
  notificationsRouted: number;
  notificationsUnmatched: number;
  deliveriesCreated: number;
  deliveriesUpdated: number;
  droppedMissingOrg?: number;
  droppedOutOfScope?: number;
  droppedNoRouteMatch?: number;
  droppedStaleThread?: number;
  backfillDays?: number;
  maxProcessedGithubUpdatedAt?: number;
  attemptedAt: number;
  errorCode?: string | null;
  errorMessage?: string | null;
}

interface NotionConnectionUpsertPayload {
  userId: string;
  companyId: string;
  workspaceId: string;
  workspaceName?: string | null;
  workspaceIcon?: string | null;
  botId?: string | null;
  ownerType?: string | null;
}

interface NotionWebhookEventPayload {
  eventId: string;
  workspaceId: string;
  eventType: string;
  eventTimestamp?: number | null;
  entityType?: string | null;
  entityId?: string | null;
  entityUrl?: string | null;
  actorId?: string | null;
  title?: string | null;
  pageId?: string | null;
  databaseId?: string | null;
  commentId?: string | null;
  updatedPropertyIds?: string[] | null;
  updatedPropertyNames?: string[] | null;
}

function isBoundedString(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_INGEST_STRING_LENGTH;
}

function isBoundedOptionalString(value: unknown): value is string | null {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.length <= MAX_INGEST_STRING_LENGTH)
  );
}

function isBoundedOptionalStringArray(
  value: unknown
): value is string[] | null {
  return (
    value === undefined ||
    value === null ||
    (Array.isArray(value) &&
      value.length <= MAX_INGEST_BATCH_ITEMS &&
      value.every(isBoundedString))
  );
}

function parseNotificationsPayload(
  value: unknown
): GithubNotificationPayload[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  if (value.length > MAX_INGEST_BATCH_ITEMS) {
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
      !isBoundedString(item.threadId) ||
      !isBoundedString(item.reason) ||
      !isBoundedString(item.title) ||
      typeof item.unread !== 'boolean'
    ) {
      return null;
    }

    if (!isBoundedOptionalString(item.url)) {
      return null;
    }
    if (!isBoundedOptionalString(item.repoFullName)) {
      return null;
    }
    if (!isBoundedOptionalString(item.orgLogin)) {
      return null;
    }
    if (!isBoundedOptionalString(item.subjectType)) {
      return null;
    }
    if (
      item.updatedAt !== undefined &&
      item.updatedAt !== null &&
      typeof item.updatedAt !== 'number'
    ) {
      return null;
    }
    if (!isBoundedOptionalString(item.apiUrl)) {
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

function parseSyncTelemetryPayload(
  value: unknown
): GithubSyncTelemetryPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as {
    githubUser?: unknown;
    status?: unknown;
    hasRouteMappings?: unknown;
    companiesMatched?: unknown;
    notificationsFetched?: unknown;
    notificationsFiltered?: unknown;
    notificationsReceived?: unknown;
    notificationsRouted?: unknown;
    notificationsUnmatched?: unknown;
    deliveriesCreated?: unknown;
    deliveriesUpdated?: unknown;
    droppedMissingOrg?: unknown;
    droppedOutOfScope?: unknown;
    droppedNoRouteMatch?: unknown;
    droppedStaleThread?: unknown;
    backfillDays?: unknown;
    maxProcessedGithubUpdatedAt?: unknown;
    attemptedAt?: unknown;
    errorCode?: unknown;
    errorMessage?: unknown;
  };

  if (
    payload.status !== 'success' &&
    payload.status !== 'skipped_no_routes' &&
    payload.status !== 'error'
  ) {
    return null;
  }

  const numericFields = [
    payload.companiesMatched,
    payload.notificationsFetched,
    payload.notificationsFiltered,
    payload.notificationsReceived,
    payload.notificationsRouted,
    payload.notificationsUnmatched,
    payload.deliveriesCreated,
    payload.deliveriesUpdated,
    payload.attemptedAt,
  ];

  if (
    typeof payload.hasRouteMappings !== 'boolean' ||
    numericFields.some(value => typeof value !== 'number')
  ) {
    return null;
  }

  const optionalNumericFields = [
    payload.droppedMissingOrg,
    payload.droppedOutOfScope,
    payload.droppedNoRouteMatch,
    payload.droppedStaleThread,
    payload.backfillDays,
    payload.maxProcessedGithubUpdatedAt,
  ];
  if (
    optionalNumericFields.some(
      value => value !== undefined && typeof value !== 'number'
    )
  ) {
    return null;
  }

  if (
    payload.githubUser !== undefined &&
    payload.githubUser !== null &&
    typeof payload.githubUser !== 'string'
  ) {
    return null;
  }
  if (
    payload.errorCode !== undefined &&
    payload.errorCode !== null &&
    typeof payload.errorCode !== 'string'
  ) {
    return null;
  }
  if (
    payload.errorMessage !== undefined &&
    payload.errorMessage !== null &&
    typeof payload.errorMessage !== 'string'
  ) {
    return null;
  }

  return {
    status: payload.status,
    hasRouteMappings: payload.hasRouteMappings,
    companiesMatched: payload.companiesMatched as number,
    notificationsFetched: payload.notificationsFetched as number,
    notificationsFiltered: payload.notificationsFiltered as number,
    notificationsReceived: payload.notificationsReceived as number,
    notificationsRouted: payload.notificationsRouted as number,
    notificationsUnmatched: payload.notificationsUnmatched as number,
    deliveriesCreated: payload.deliveriesCreated as number,
    deliveriesUpdated: payload.deliveriesUpdated as number,
    ...(payload.droppedMissingOrg !== undefined
      ? { droppedMissingOrg: payload.droppedMissingOrg as number }
      : {}),
    ...(payload.droppedOutOfScope !== undefined
      ? { droppedOutOfScope: payload.droppedOutOfScope as number }
      : {}),
    ...(payload.droppedNoRouteMatch !== undefined
      ? { droppedNoRouteMatch: payload.droppedNoRouteMatch as number }
      : {}),
    ...(payload.droppedStaleThread !== undefined
      ? { droppedStaleThread: payload.droppedStaleThread as number }
      : {}),
    ...(payload.backfillDays !== undefined
      ? { backfillDays: payload.backfillDays as number }
      : {}),
    ...(payload.maxProcessedGithubUpdatedAt !== undefined
      ? {
          maxProcessedGithubUpdatedAt:
            payload.maxProcessedGithubUpdatedAt as number,
        }
      : {}),
    attemptedAt: payload.attemptedAt as number,
    ...(payload.githubUser !== undefined
      ? { githubUser: payload.githubUser }
      : {}),
    ...(payload.errorCode !== undefined
      ? { errorCode: payload.errorCode }
      : {}),
    ...(payload.errorMessage !== undefined
      ? { errorMessage: payload.errorMessage }
      : {}),
  };
}

function parseNotionConnectionUpsertPayload(
  value: unknown
): NotionConnectionUpsertPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as {
    userId?: unknown;
    companyId?: unknown;
    workspaceId?: unknown;
    workspaceName?: unknown;
    workspaceIcon?: unknown;
    botId?: unknown;
    ownerType?: unknown;
  };

  if (
    typeof payload.userId !== 'string' ||
    typeof payload.companyId !== 'string' ||
    typeof payload.workspaceId !== 'string'
  ) {
    return null;
  }

  const optionalStringOrNullFields = [
    payload.workspaceName,
    payload.workspaceIcon,
    payload.botId,
    payload.ownerType,
  ];
  if (
    optionalStringOrNullFields.some(
      value =>
        value !== undefined && value !== null && typeof value !== 'string'
    )
  ) {
    return null;
  }

  return {
    userId: payload.userId.trim(),
    companyId: payload.companyId.trim(),
    workspaceId: payload.workspaceId.trim(),
    ...(payload.workspaceName !== undefined
      ? { workspaceName: payload.workspaceName as string | null }
      : {}),
    ...(payload.workspaceIcon !== undefined
      ? { workspaceIcon: payload.workspaceIcon as string | null }
      : {}),
    ...(payload.botId !== undefined
      ? { botId: payload.botId as string | null }
      : {}),
    ...(payload.ownerType !== undefined
      ? { ownerType: payload.ownerType as string | null }
      : {}),
  };
}

function parseNotionWebhookEventsPayload(
  value: unknown
): NotionWebhookEventPayload[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  if (value.length > MAX_INGEST_BATCH_ITEMS) {
    return null;
  }

  const parsed: NotionWebhookEventPayload[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }

    const item = raw as {
      eventId?: unknown;
      workspaceId?: unknown;
      eventType?: unknown;
      eventTimestamp?: unknown;
      entityType?: unknown;
      entityId?: unknown;
      entityUrl?: unknown;
      actorId?: unknown;
      title?: unknown;
      pageId?: unknown;
      databaseId?: unknown;
      commentId?: unknown;
      updatedPropertyIds?: unknown;
      updatedPropertyNames?: unknown;
    };

    if (
      !isBoundedString(item.eventId) ||
      !isBoundedString(item.workspaceId) ||
      !isBoundedString(item.eventType)
    ) {
      return null;
    }

    const optionalStringOrNullFields = [
      item.entityType,
      item.entityId,
      item.entityUrl,
      item.actorId,
      item.title,
      item.pageId,
      item.databaseId,
      item.commentId,
    ];
    if (
      optionalStringOrNullFields.some(
        candidate => !isBoundedOptionalString(candidate)
      )
    ) {
      return null;
    }

    if (
      item.eventTimestamp !== undefined &&
      item.eventTimestamp !== null &&
      typeof item.eventTimestamp !== 'number'
    ) {
      return null;
    }

    const optionalStringArrayOrNullFields = [
      item.updatedPropertyIds,
      item.updatedPropertyNames,
    ];
    if (
      optionalStringArrayOrNullFields.some(
        candidate => !isBoundedOptionalStringArray(candidate)
      )
    ) {
      return null;
    }

    parsed.push({
      eventId: item.eventId.trim(),
      workspaceId: item.workspaceId.trim(),
      eventType: item.eventType.trim(),
      ...(item.eventTimestamp !== undefined
        ? { eventTimestamp: item.eventTimestamp as number | null }
        : {}),
      ...(item.entityType !== undefined
        ? { entityType: item.entityType as string | null }
        : {}),
      ...(item.entityId !== undefined
        ? { entityId: item.entityId as string | null }
        : {}),
      ...(item.entityUrl !== undefined
        ? { entityUrl: item.entityUrl as string | null }
        : {}),
      ...(item.actorId !== undefined
        ? { actorId: item.actorId as string | null }
        : {}),
      ...(item.title !== undefined
        ? { title: item.title as string | null }
        : {}),
      ...(item.pageId !== undefined
        ? { pageId: item.pageId as string | null }
        : {}),
      ...(item.databaseId !== undefined
        ? { databaseId: item.databaseId as string | null }
        : {}),
      ...(item.commentId !== undefined
        ? { commentId: item.commentId as string | null }
        : {}),
      ...(item.updatedPropertyIds !== undefined
        ? { updatedPropertyIds: item.updatedPropertyIds as string[] | null }
        : {}),
      ...(item.updatedPropertyNames !== undefined
        ? { updatedPropertyNames: item.updatedPropertyNames as string[] | null }
        : {}),
    });
  }

  return parsed;
}

export const __ingestParsersForTests = {
  parseNotificationsPayload,
  parseNotionWebhookEventsPayload,
};

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

const ghServiceRecordSyncTelemetry = httpAction(async (ctx, request) => {
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
  const telemetry = parseSyncTelemetryPayload(
    (payload as { telemetry?: unknown }).telemetry
  );

  if (!userId) {
    return jsonResponse(400, { error: 'userId is required' });
  }
  if (!telemetry) {
    return jsonResponse(400, { error: 'telemetry payload is invalid' });
  }

  const id = await ctx.runMutation(
    internal.githubService.recordNotificationSyncTelemetry,
    {
      userId,
      telemetry,
    }
  );

  return jsonResponse(200, { id });
});

const ghServiceGetSyncCursor = httpAction(async (ctx, request) => {
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

  const telemetry = await ctx.runQuery(
    internal.githubService.getMyNotificationSyncTelemetry,
    { userId }
  );
  const lastSuccessAt =
    telemetry && typeof telemetry.lastSuccessAt === 'number'
      ? telemetry.lastSuccessAt
      : null;
  const lastSuccessGithubUpdatedAt =
    telemetry && typeof telemetry.lastSuccessGithubUpdatedAt === 'number'
      ? telemetry.lastSuccessGithubUpdatedAt
      : null;

  return jsonResponse(200, {
    lastSuccessAt,
    lastSuccessGithubUpdatedAt,
  });
});

const notionServiceUpsertConnection = httpAction(async (ctx, request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const authError = authorizeNotionServiceRequest(request);
  if (authError) {
    return authError;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const parsed = parseNotionConnectionUpsertPayload(payload);
  if (!parsed || !parsed.userId || !parsed.companyId || !parsed.workspaceId) {
    return jsonResponse(400, {
      error: 'userId, companyId, and workspaceId are required',
    });
  }

  const id = await ctx.runMutation(internal.notionService.upsertConnection, {
    userId: parsed.userId,
    companyId: parsed.companyId as Id<'companies'>,
    workspaceId: parsed.workspaceId,
    ...(parsed.workspaceName !== undefined
      ? { workspaceName: parsed.workspaceName }
      : {}),
    ...(parsed.workspaceIcon !== undefined
      ? { workspaceIcon: parsed.workspaceIcon }
      : {}),
    ...(parsed.botId !== undefined ? { botId: parsed.botId } : {}),
    ...(parsed.ownerType !== undefined ? { ownerType: parsed.ownerType } : {}),
  });

  return jsonResponse(200, { id });
});

const notionServiceClearConnection = httpAction(async (ctx, request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const authError = authorizeNotionServiceRequest(request);
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
  const companyId =
    typeof (payload as { companyId?: unknown }).companyId === 'string'
      ? (payload as { companyId: string }).companyId.trim()
      : '';

  if (!userId || !companyId) {
    return jsonResponse(400, { error: 'userId and companyId are required' });
  }

  const id = await ctx.runMutation(internal.notionService.clearConnection, {
    userId,
    companyId: companyId as Id<'companies'>,
  });

  return jsonResponse(200, { id });
});

const notionServiceIntegrationEnabled = httpAction(async (ctx, request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const authError = authorizeNotionServiceRequest(request);
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
  const companyId =
    typeof (payload as { companyId?: unknown }).companyId === 'string'
      ? (payload as { companyId: string }).companyId.trim()
      : '';

  if (!userId || !companyId) {
    return jsonResponse(400, { error: 'userId and companyId are required' });
  }

  const enabled = await ctx.runQuery(
    (
      internal as unknown as {
        integrationSettings: {
          isEnabledForCompanyUser: FunctionReference<
            'query',
            'internal',
            {
              userId: string;
              companyId: Id<'companies'>;
              integration: 'notion';
            },
            boolean
          >;
        };
      }
    ).integrationSettings.isEnabledForCompanyUser,
    {
      userId,
      companyId: companyId as Id<'companies'>,
      integration: 'notion',
    }
  );

  return jsonResponse(200, { enabled });
});

const notionServiceIngestEvents = httpAction(async (ctx, request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const authError = authorizeNotionServiceRequest(request);
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

  const events = parseNotionWebhookEventsPayload(
    (payload as { events?: unknown }).events
  );
  if (!events) {
    return jsonResponse(400, { error: 'events must be an array' });
  }

  const result = await ctx.runMutation(
    internal.notionService.ingestWebhookEvents,
    {
      events: events.map(event => ({
        eventId: event.eventId,
        workspaceId: event.workspaceId,
        eventType: event.eventType,
        eventTimestamp: event.eventTimestamp ?? null,
        entityType: event.entityType ?? null,
        entityId: event.entityId ?? null,
        entityUrl: event.entityUrl ?? null,
        actorId: event.actorId ?? null,
        title: event.title ?? null,
        pageId: event.pageId ?? null,
        databaseId: event.databaseId ?? null,
        commentId: event.commentId ?? null,
        updatedPropertyIds: event.updatedPropertyIds ?? null,
        updatedPropertyNames: event.updatedPropertyNames ?? null,
      })),
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

http.route({
  path: '/github/service/sync-telemetry',
  method: 'POST',
  handler: ghServiceRecordSyncTelemetry,
});

http.route({
  path: '/github/service/sync-cursor',
  method: 'POST',
  handler: ghServiceGetSyncCursor,
});

http.route({
  path: '/notion/service/upsert-connection',
  method: 'POST',
  handler: notionServiceUpsertConnection,
});

http.route({
  path: '/notion/service/clear-connection',
  method: 'POST',
  handler: notionServiceClearConnection,
});

http.route({
  path: '/notion/service/integration-enabled',
  method: 'POST',
  handler: notionServiceIntegrationEnabled,
});

http.route({
  path: '/notion/service/ingest-events',
  method: 'POST',
  handler: notionServiceIngestEvents,
});

export default http;
