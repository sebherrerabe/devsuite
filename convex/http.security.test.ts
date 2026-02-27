import assert from 'node:assert/strict';
import { before } from 'node:test';
import test from 'node:test';

let assertServiceBackendTokensConfigured!: (
  env?: Record<string, string | undefined>
) => void;
let __ingestParsersForTests!: {
  parseNotificationsPayload: (value: unknown) => { threadId: string }[] | null;
  parseNotionWebhookEventsPayload: (
    value: unknown
  ) => { eventId: string }[] | null;
};

before(async () => {
  // nosemgrep: semgrep.devsuite-process-env-without-validation
  process.env.SITE_URL ??= 'http://localhost:5173';
  // nosemgrep: semgrep.devsuite-process-env-without-validation
  process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
  process.env.NODE_ENV ??= 'test';

  const httpModule = await import('./http.js');
  assertServiceBackendTokensConfigured =
    httpModule.assertServiceBackendTokensConfigured;
  __ingestParsersForTests = httpModule.__ingestParsersForTests;
});

test('assertServiceBackendTokensConfigured: requires backend tokens in production', () => {
  assert.throws(
    () =>
      assertServiceBackendTokensConfigured({
        NODE_ENV: 'production',
      } as Record<string, string | undefined>),
    /DEVSUITE_GH_SERVICE_BACKEND_TOKEN is required in production/
  );

  assert.throws(
    () =>
      assertServiceBackendTokensConfigured({
        NODE_ENV: 'production',
        DEVSUITE_GH_SERVICE_BACKEND_TOKEN: 'gh-token',
      } as Record<string, string | undefined>),
    /DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN is required in production/
  );
});

test('assertServiceBackendTokensConfigured: allows configured production env', () => {
  assert.doesNotThrow(() =>
    assertServiceBackendTokensConfigured({
      NODE_ENV: 'production',
      DEVSUITE_GH_SERVICE_BACKEND_TOKEN: 'gh-token',
      DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN: 'notion-token',
    } as Record<string, string | undefined>)
  );
});

test('parseNotificationsPayload: rejects oversized notification batches', () => {
  const entries = Array.from({ length: 1001 }, (_, idx) => ({
    threadId: `thread-${idx}`,
    reason: 'review_requested',
    title: 'A title',
    unread: true,
  }));

  assert.equal(
    __ingestParsersForTests.parseNotificationsPayload(entries),
    null
  );
});

test('parseNotificationsPayload: rejects oversized string fields', () => {
  const entries = [
    {
      threadId: 'thread-1',
      reason: 'review_requested',
      title: 'x'.repeat(4097),
      unread: true,
    },
  ];

  assert.equal(
    __ingestParsersForTests.parseNotificationsPayload(entries),
    null
  );
});

test('parseNotionWebhookEventsPayload: rejects oversized event batches', () => {
  const events = Array.from({ length: 1001 }, (_, idx) => ({
    eventId: `event-${idx}`,
    workspaceId: 'workspace-1',
    eventType: 'page_updated',
  }));

  assert.equal(
    __ingestParsersForTests.parseNotionWebhookEventsPayload(events),
    null
  );
});

test('parseNotionWebhookEventsPayload: accepts bounded payloads', () => {
  const events = [
    {
      eventId: 'event-1',
      workspaceId: 'workspace-1',
      eventType: 'page_updated',
      updatedPropertyNames: ['Assignee'],
    },
  ];

  const parsed =
    __ingestParsersForTests.parseNotionWebhookEventsPayload(events);
  assert.ok(parsed);
  assert.equal(parsed[0]?.eventId, 'event-1');
});
