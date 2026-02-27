import assert from 'node:assert/strict';
import test from 'node:test';

import { ConvexBackendClient } from './convex-backend-client.js';

function getUrlFromFetchInput(
  input: Parameters<typeof globalThis.fetch>[0]
): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof globalThis.URL) {
    return input.toString();
  }
  return input.url;
}

test('ConvexBackendClient ingestNotifications: defaults missing deliveriesSkippedStale to zero', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    assert.equal(
      getUrlFromFetchInput(input),
      'https://example.convex.site/github/service/ingest-notifications'
    );
    assert.equal(init?.method, 'POST');

    const body = init?.body ? JSON.parse(String(init.body)) : {};
    assert.deepEqual(body, {
      userId: 'user-1',
      notifications: [],
    });

    return new globalThis.Response(
      JSON.stringify({
        companiesConsidered: 1,
        notificationsReceived: 0,
        notificationsRouted: 0,
        notificationsUnmatched: 0,
        deliveriesCreated: 0,
        deliveriesUpdated: 0,
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      }
    );
  }) as typeof globalThis.fetch;

  try {
    const client = new ConvexBackendClient(
      'https://example.convex.site',
      'test-token'
    );
    const result = await client.ingestNotifications('user-1', []);

    assert.deepEqual(result, {
      companiesConsidered: 1,
      notificationsReceived: 0,
      notificationsRouted: 0,
      notificationsUnmatched: 0,
      deliveriesCreated: 0,
      deliveriesUpdated: 0,
      deliveriesSkippedStale: 0,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ConvexBackendClient ingestNotifications: keeps deliveriesSkippedStale when provided', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new globalThis.Response(
      JSON.stringify({
        companiesConsidered: 2,
        notificationsReceived: 5,
        notificationsRouted: 4,
        notificationsUnmatched: 1,
        deliveriesCreated: 2,
        deliveriesUpdated: 1,
        deliveriesSkippedStale: 3,
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      }
    );
  }) as typeof globalThis.fetch;

  try {
    const client = new ConvexBackendClient(
      'https://example.convex.site',
      'test-token'
    );
    const result = await client.ingestNotifications('user-1', []);

    assert.equal(result.deliveriesSkippedStale, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
