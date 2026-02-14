import { ConnectionManager } from './connection-manager.js';
import { ConvexBackendClient } from './convex-backend-client.js';
import { fetchNotifications } from './gh-runner.js';
import type { Logger } from './logger.js';

export interface NotificationSyncResult {
  githubUser: string | null;
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
  attemptedAt: number;
  errorCode: string | null;
  errorMessage: string | null;
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

export async function syncUserNotifications(options: {
  connectionManager: ConnectionManager;
  backendClient: ConvexBackendClient;
  userId: string;
  batchSize: number;
  logger?: Logger;
}): Promise<NotificationSyncResult> {
  const attemptedAt = Date.now();
  const routes = await options.backendClient.listCompanyRoutes(options.userId);
  const allowedOrgLogins = buildAllowedOrgSet(routes);

  if (allowedOrgLogins.size === 0) {
    const telemetry = {
      githubUser: null,
      status: 'skipped_no_routes' as const,
      hasRouteMappings: false,
      companiesMatched: routes.length,
      notificationsFetched: 0,
      notificationsFiltered: 0,
      notificationsReceived: 0,
      notificationsRouted: 0,
      notificationsUnmatched: 0,
      deliveriesCreated: 0,
      deliveriesUpdated: 0,
      attemptedAt,
      errorCode: null,
      errorMessage: null,
    };
    await options.backendClient.recordSyncTelemetry(options.userId, telemetry);
    return telemetry;
  }

  const session = await options.connectionManager.getAuthenticatedToken(
    options.userId
  );

  const fetched = await fetchNotifications({
    token: session.token,
    limit: options.batchSize,
    ...(options.logger
      ? {
          audit: {
            actorId: options.userId,
            logger: options.logger,
          },
        }
      : {}),
  });

  const notifications = fetched.filter(item => {
    if (!item.orgLogin) {
      return false;
    }
    return allowedOrgLogins.has(item.orgLogin.toLowerCase());
  });

  const result = await options.backendClient.ingestNotifications(
    options.userId,
    notifications
  );

  const telemetry = {
    githubUser: session.githubUser,
    status: 'success' as const,
    hasRouteMappings: true,
    companiesMatched: routes.length,
    notificationsFetched: fetched.length,
    notificationsFiltered: notifications.length,
    notificationsReceived: result.notificationsReceived,
    notificationsRouted: result.notificationsRouted,
    notificationsUnmatched: result.notificationsUnmatched,
    deliveriesCreated: result.deliveriesCreated,
    deliveriesUpdated: result.deliveriesUpdated,
    attemptedAt,
    errorCode: null,
    errorMessage: null,
  };

  await options.backendClient.recordSyncTelemetry(options.userId, telemetry);
  return telemetry;
}
