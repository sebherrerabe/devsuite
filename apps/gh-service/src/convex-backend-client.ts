export interface GithubNotificationIngestItem {
  threadId: string;
  reason: string;
  title: string;
  url: string | null;
  repoFullName: string | null;
  orgLogin: string | null;
  subjectType: string | null;
  updatedAt: number | null;
  unread: boolean;
  apiUrl: string | null;
}

export interface IngestNotificationsResult {
  companiesConsidered: number;
  notificationsReceived: number;
  notificationsRouted: number;
  notificationsUnmatched: number;
  deliveriesCreated: number;
  deliveriesUpdated: number;
  deliveriesSkippedStale: number;
}

export interface CompanyRoute {
  companyId: string;
  companyName: string;
  githubOrgLogins: string[];
}

export interface GithubNotificationSyncTelemetry {
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
  droppedMissingOrg: number;
  droppedOutOfScope: number;
  droppedNoRouteMatch: number;
  droppedStaleThread: number;
  attemptedAt: number;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface GithubNotificationSyncCursor {
  lastSuccessAt: number | null;
}

export class ConvexBackendError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: 'HTTP_ERROR' | 'INVALID_RESPONSE',
    message: string
  ) {
    super(message);
  }
}

export class ConvexBackendClient {
  constructor(
    private readonly convexSiteUrl: string,
    private readonly backendToken: string
  ) {
    if (
      process.env.NODE_ENV === 'production' &&
      !this.convexSiteUrl.startsWith('https://')
    ) {
      throw new Error(
        'DEVSUITE_CONVEX_SITE_URL must use https:// in production'
      );
    }
  }

  async listCompanyRoutes(userId: string): Promise<CompanyRoute[]> {
    const payload = await this.post('/github/service/company-routes', {
      userId,
    });

    if (
      !payload ||
      typeof payload !== 'object' ||
      !Array.isArray(payload.routes)
    ) {
      throw new ConvexBackendError(
        502,
        'INVALID_RESPONSE',
        'Convex returned an invalid company routes payload'
      );
    }

    return payload.routes as CompanyRoute[];
  }

  async ingestNotifications(
    userId: string,
    notifications: GithubNotificationIngestItem[]
  ): Promise<IngestNotificationsResult> {
    const payload = await this.post('/github/service/ingest-notifications', {
      userId,
      notifications,
    });

    return parseIngestNotificationsResult(payload);
  }

  async recordSyncTelemetry(
    userId: string,
    telemetry: GithubNotificationSyncTelemetry
  ): Promise<void> {
    await this.post('/github/service/sync-telemetry', {
      userId,
      telemetry,
    });
  }

  async getNotificationSyncCursor(
    userId: string
  ): Promise<GithubNotificationSyncCursor> {
    const payload = await this.post('/github/service/sync-cursor', {
      userId,
    });

    const lastSuccessAt =
      typeof payload.lastSuccessAt === 'number' &&
      Number.isFinite(payload.lastSuccessAt)
        ? payload.lastSuccessAt
        : null;

    return { lastSuccessAt };
  }

  private async post(
    path: string,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const url = new globalThis.URL(path, this.convexSiteUrl).toString();
    const response = await globalThis.fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.backendToken}`,
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const bodyText = await response.text();
    let body: unknown = null;
    if (bodyText.trim()) {
      try {
        body = JSON.parse(bodyText) as unknown;
      } catch {
        throw new ConvexBackendError(
          response.status,
          'INVALID_RESPONSE',
          'Convex response is not valid JSON'
        );
      }
    }

    if (!response.ok) {
      const message =
        body &&
        typeof body === 'object' &&
        typeof (body as { error?: unknown }).error === 'string'
          ? (body as { error: string }).error
          : 'Convex request failed';
      throw new ConvexBackendError(response.status, 'HTTP_ERROR', message);
    }

    return (body ?? {}) as Record<string, unknown>;
  }
}

function parseIngestNotificationsResult(
  payload: Record<string, unknown>
): IngestNotificationsResult {
  const keys = [
    'companiesConsidered',
    'notificationsReceived',
    'notificationsRouted',
    'notificationsUnmatched',
    'deliveriesCreated',
    'deliveriesUpdated',
    'deliveriesSkippedStale',
  ] as const;

  for (const key of keys) {
    if (typeof payload[key] !== 'number') {
      throw new ConvexBackendError(
        502,
        'INVALID_RESPONSE',
        `Convex ingest payload missing numeric field: ${key}`
      );
    }
  }

  return {
    companiesConsidered: payload.companiesConsidered as number,
    notificationsReceived: payload.notificationsReceived as number,
    notificationsRouted: payload.notificationsRouted as number,
    notificationsUnmatched: payload.notificationsUnmatched as number,
    deliveriesCreated: payload.deliveriesCreated as number,
    deliveriesUpdated: payload.deliveriesUpdated as number,
    deliveriesSkippedStale: payload.deliveriesSkippedStale as number,
  };
}
