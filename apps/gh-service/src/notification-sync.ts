import { ConnectionManager } from './connection-manager.js';
import { ConvexBackendClient } from './convex-backend-client.js';
import { fetchNotifications, type GhNotification } from './gh-runner.js';
import type { Logger } from './logger.js';

const SYNC_SINCE_OVERLAP_MS = 60_000;
const inFlightSyncByUser = new Map<string, Promise<NotificationSyncResult>>();

export interface NotificationSyncResult {
  githubUser: string | null;
  backfillDays: number | null;
  status: 'success' | 'skipped_no_routes' | 'error';
  companiesMatched: number;
  hasRouteMappings: boolean;
  notificationsFetched: number;
  notificationsFiltered: number;
  notificationsReceived: number;
  notificationsRouted: number;
  notificationsUnmatched: number;
  deliveriesCreated: number;
  deliveriesUpdated: number;
  droppedMissingOrg: number;
  droppedOutOfScope: number;
  droppedNoRouteMatch: number;
  droppedStaleThread: number;
  attemptedAt: number;
  errorCode: string | null;
  errorMessage: string | null;
}

interface SyncUserNotificationsOptions {
  connectionManager: ConnectionManager;
  backendClient: ConvexBackendClient;
  userId: string;
  batchSize: number;
  sinceOverrideMs?: number | null;
  backfillDays?: number;
  logger?: Logger;
  fetchNotificationsImpl?: typeof fetchNotifications;
}

function buildAllowedOrgSet(
  routes: Array<{ githubOrgLogins: string[] }>
): Set<string> {
  const orgs = new Set<string>();
  for (const route of routes) {
    for (const orgLogin of route.githubOrgLogins) {
      const normalized = orgLogin.trim().toLowerCase();
      if (normalized) {
        orgs.add(normalized);
      }
    }
  }
  return orgs;
}

function normalizeBackfillDays(value: number | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.floor(value);
}

function getMaxGithubUpdatedAt(notifications: GhNotification[]): number | null {
  let maxUpdatedAt: number | null = null;
  for (const notification of notifications) {
    if (
      typeof notification.updatedAt !== 'number' ||
      !Number.isFinite(notification.updatedAt)
    ) {
      continue;
    }
    if (maxUpdatedAt === null || notification.updatedAt > maxUpdatedAt) {
      maxUpdatedAt = notification.updatedAt;
    }
  }
  return maxUpdatedAt;
}

export async function syncUserNotifications(
  options: SyncUserNotificationsOptions
): Promise<NotificationSyncResult> {
  const existing = inFlightSyncByUser.get(options.userId);
  if (existing) {
    return existing;
  }

  const runPromise = syncUserNotificationsUnlocked(options).finally(() => {
    if (inFlightSyncByUser.get(options.userId) === runPromise) {
      inFlightSyncByUser.delete(options.userId);
    }
  });

  inFlightSyncByUser.set(options.userId, runPromise);
  return runPromise;
}

async function syncUserNotificationsUnlocked(
  options: SyncUserNotificationsOptions
): Promise<NotificationSyncResult> {
  const normalizedBackfillDays = normalizeBackfillDays(options.backfillDays);
  const fetchNotificationsImpl =
    options.fetchNotificationsImpl ?? fetchNotifications;
  const attemptedAt = Date.now();
  const routes = await options.backendClient.listCompanyRoutes(options.userId);
  const allowedOrgLogins = buildAllowedOrgSet(routes);

  if (allowedOrgLogins.size === 0) {
    const result: NotificationSyncResult = {
      githubUser: null,
      backfillDays: normalizedBackfillDays,
      status: 'skipped_no_routes',
      hasRouteMappings: false,
      companiesMatched: routes.length,
      notificationsFetched: 0,
      notificationsFiltered: 0,
      notificationsReceived: 0,
      notificationsRouted: 0,
      notificationsUnmatched: 0,
      deliveriesCreated: 0,
      deliveriesUpdated: 0,
      droppedMissingOrg: 0,
      droppedOutOfScope: 0,
      droppedNoRouteMatch: 0,
      droppedStaleThread: 0,
      attemptedAt,
      errorCode: null,
      errorMessage: null,
    };
    const { backfillDays, ...telemetryBase } = result;
    await options.backendClient.recordSyncTelemetry(options.userId, {
      ...telemetryBase,
      ...(backfillDays !== null ? { backfillDays } : {}),
    });
    return result;
  }

  const session = await options.connectionManager.getAuthenticatedToken(
    options.userId
  );
  const syncCursor = await options.backendClient.getNotificationSyncCursor(
    options.userId
  );
  const cursorMs =
    typeof syncCursor.lastSuccessGithubUpdatedAt === 'number'
      ? syncCursor.lastSuccessGithubUpdatedAt
      : syncCursor.lastSuccessAt;
  const autoSince =
    typeof cursorMs === 'number'
      ? Math.max(0, cursorMs - SYNC_SINCE_OVERLAP_MS)
      : null;
  const since =
    typeof options.sinceOverrideMs === 'number' &&
    Number.isFinite(options.sinceOverrideMs)
      ? Math.max(0, options.sinceOverrideMs)
      : autoSince;

  const fetched = await fetchNotificationsImpl({
    token: session.token,
    limit: options.batchSize,
    ...(since !== null ? { since } : {}),
    ...(options.logger
      ? {
          audit: {
            actorId: options.userId,
            logger: options.logger,
          },
        }
      : {}),
  });

  let droppedMissingOrg = 0;
  let droppedOutOfScope = 0;
  const notifications = fetched.filter(item => {
    if (!item.orgLogin) {
      droppedMissingOrg += 1;
      return false;
    }
    if (!allowedOrgLogins.has(item.orgLogin.toLowerCase())) {
      droppedOutOfScope += 1;
      return false;
    }
    return true;
  });

  const result = await options.backendClient.ingestNotifications(
    options.userId,
    notifications
  );
  const maxProcessedGithubUpdatedAt = getMaxGithubUpdatedAt(notifications);

  const syncResult: NotificationSyncResult = {
    githubUser: session.githubUser,
    backfillDays: normalizedBackfillDays,
    status: 'success',
    hasRouteMappings: true,
    companiesMatched: routes.length,
    notificationsFetched: fetched.length,
    notificationsFiltered: notifications.length,
    notificationsReceived: result.notificationsReceived,
    notificationsRouted: result.notificationsRouted,
    notificationsUnmatched: result.notificationsUnmatched,
    deliveriesCreated: result.deliveriesCreated,
    deliveriesUpdated: result.deliveriesUpdated,
    droppedMissingOrg,
    droppedOutOfScope,
    droppedNoRouteMatch: result.notificationsUnmatched,
    droppedStaleThread: result.deliveriesSkippedStale,
    attemptedAt,
    errorCode: null,
    errorMessage: null,
  };

  const { backfillDays, ...telemetryBase } = syncResult;
  await options.backendClient.recordSyncTelemetry(options.userId, {
    ...telemetryBase,
    ...(backfillDays !== null ? { backfillDays } : {}),
    ...(maxProcessedGithubUpdatedAt !== null
      ? { maxProcessedGithubUpdatedAt }
      : {}),
  });
  return syncResult;
}
