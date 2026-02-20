import assert from 'node:assert/strict';
import test from 'node:test';

import { HttpError } from './auth.js';
import type { NotionWebhookEventPayload } from './convex-backend-client.js';
import { __securityGuardsForTests } from './server.js';

function createRequest(remoteAddress: string) {
  return {
    headers: {},
    socket: {
      remoteAddress,
    },
  } as never;
}

function createEvent(
  eventId: string,
  eventTimestamp: number
): NotionWebhookEventPayload {
  return {
    eventId,
    workspaceId: 'workspace-1',
    eventType: 'page_updated',
    eventTimestamp,
    entityType: null,
    entityId: null,
    entityUrl: null,
    actorId: null,
    title: null,
    pageId: null,
    databaseId: null,
    commentId: null,
    updatedPropertyIds: null,
    updatedPropertyNames: null,
  };
}

test('Notion rate limiter: blocks requests after threshold', () => {
  __securityGuardsForTests.clear();
  const req = createRequest('127.0.0.1');

  for (let idx = 0; idx < 120; idx += 1) {
    assert.doesNotThrow(() =>
      __securityGuardsForTests.enforceRateLimit(req, '/notion/webhooks')
    );
  }

  assert.throws(
    () => __securityGuardsForTests.enforceRateLimit(req, '/notion/webhooks'),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 429 &&
      error.code === 'RATE_LIMITED'
  );
});

test('Notion webhook replay guard: rejects duplicate event id', () => {
  __securityGuardsForTests.clear();
  const now = Date.now();
  const event = createEvent('event-1', now);

  assert.doesNotThrow(() =>
    __securityGuardsForTests.enforceWebhookReplayProtection(event)
  );

  assert.throws(
    () => __securityGuardsForTests.enforceWebhookReplayProtection(event),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 409 &&
      error.code === 'WEBHOOK_REPLAY_DETECTED'
  );
});

test('Notion webhook replay guard: rejects stale timestamps', () => {
  __securityGuardsForTests.clear();
  const staleEvent = createEvent('event-2', Date.now() - 10 * 60 * 1000);

  assert.throws(
    () => __securityGuardsForTests.enforceWebhookReplayProtection(staleEvent),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 400 &&
      error.code === 'WEBHOOK_TIMESTAMP_OUT_OF_WINDOW'
  );
});
