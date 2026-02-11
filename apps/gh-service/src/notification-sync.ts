import { ConnectionManager } from './connection-manager.js';
import { ConvexBackendClient } from './convex-backend-client.js';
import { fetchNotifications } from './gh-runner.js';

export interface NotificationSyncResult {
  githubUser: string | null;
  companiesMatched: number;
  hasRouteMappings: boolean;
  notificationsFetched: number;
  notificationsFiltered: number;
  notificationsReceived: number;
  notificationsRouted: number;
  notificationsUnmatched: number;
  deliveriesCreated: number;
  deliveriesUpdated: number;
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
}): Promise<NotificationSyncResult> {
  const session = await options.connectionManager.getAuthenticatedToken(
    options.userId
  );
  const routes = await options.backendClient.listCompanyRoutes(options.userId);
  const allowedOrgLogins = buildAllowedOrgSet(routes);

  if (allowedOrgLogins.size === 0) {
    return {
      githubUser: session.githubUser,
      companiesMatched: routes.length,
      hasRouteMappings: false,
      notificationsFetched: 0,
      notificationsFiltered: 0,
      notificationsReceived: 0,
      notificationsRouted: 0,
      notificationsUnmatched: 0,
      deliveriesCreated: 0,
      deliveriesUpdated: 0,
    };
  }

  const fetched = await fetchNotifications({
    token: session.token,
    limit: options.batchSize,
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

  return {
    githubUser: session.githubUser,
    companiesMatched: routes.length,
    hasRouteMappings: true,
    notificationsFetched: fetched.length,
    notificationsFiltered: notifications.length,
    notificationsReceived: result.notificationsReceived,
    notificationsRouted: result.notificationsRouted,
    notificationsUnmatched: result.notificationsUnmatched,
    deliveriesCreated: result.deliveriesCreated,
    deliveriesUpdated: result.deliveriesUpdated,
  };
}
