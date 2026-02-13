export interface NotionConnectionUpsertPayload {
  userId: string;
  companyId: string;
  workspaceId: string;
  workspaceName?: string | null;
  workspaceIcon?: string | null;
  botId?: string | null;
  ownerType?: string | null;
}

export interface NotionWebhookEventPayload {
  eventId: string;
  workspaceId: string;
  eventType: string;
  eventTimestamp: number | null;
  entityType: string | null;
  entityId: string | null;
  entityUrl: string | null;
  actorId: string | null;
  title: string | null;
  pageId: string | null;
  databaseId: string | null;
  commentId: string | null;
}

export interface NotionWebhookIngestResult {
  eventsReceived: number;
  eventsRouted: number;
  eventsUnmatched: number;
  deliveriesCreated: number;
  deliveriesUpdated: number;
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
  ) {}

  async upsertNotionConnection(
    payload: NotionConnectionUpsertPayload
  ): Promise<void> {
    await this.post('/notion/service/upsert-connection', {
      ...payload,
    });
  }

  async clearNotionConnection(
    userId: string,
    companyId: string
  ): Promise<void> {
    await this.post('/notion/service/clear-connection', {
      userId,
      companyId,
    });
  }

  async ingestNotionWebhookEvents(
    events: NotionWebhookEventPayload[]
  ): Promise<NotionWebhookIngestResult> {
    const payload = await this.post('/notion/service/ingest-events', {
      events,
    });

    return parseNotionWebhookIngestResult(payload);
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
          `Convex response is not valid JSON for ${path}`
        );
      }
    }

    if (!response.ok) {
      const message =
        body &&
        typeof body === 'object' &&
        typeof (body as { error?: unknown }).error === 'string'
          ? (body as { error: string }).error
          : `Convex request failed for ${path}`;
      throw new ConvexBackendError(response.status, 'HTTP_ERROR', message);
    }

    return (body ?? {}) as Record<string, unknown>;
  }
}

function parseNotionWebhookIngestResult(
  payload: Record<string, unknown>
): NotionWebhookIngestResult {
  const keys = [
    'eventsReceived',
    'eventsRouted',
    'eventsUnmatched',
    'deliveriesCreated',
    'deliveriesUpdated',
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
    eventsReceived: payload.eventsReceived as number,
    eventsRouted: payload.eventsRouted as number,
    eventsUnmatched: payload.eventsUnmatched as number,
    deliveriesCreated: payload.deliveriesCreated as number,
    deliveriesUpdated: payload.deliveriesUpdated as number,
  };
}
