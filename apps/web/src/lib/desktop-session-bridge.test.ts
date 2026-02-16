import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDesktopPublishTimestamps,
  DESKTOP_STATE_PUBLISH_INTERVAL_MS,
} from './desktop-session-bridge-config';

test('desktop bridge publishes every 5 seconds', () => {
  assert.equal(DESKTOP_STATE_PUBLISH_INTERVAL_MS, 5_000);
});

test('desktop bridge publish timestamps include publishedAt', () => {
  const timestamps = createDesktopPublishTimestamps(12345);

  assert.deepEqual(timestamps, {
    updatedAt: 12345,
    publishedAt: 12345,
  });
});
