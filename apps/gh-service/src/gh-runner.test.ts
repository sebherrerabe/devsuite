import assert from 'node:assert/strict';
import test from 'node:test';

import { buildNotificationsApiPath } from './gh-runner.js';

test('buildNotificationsApiPath: omits since when cursor missing', () => {
  const path = buildNotificationsApiPath({ perPage: 50 });
  assert.equal(path, '/notifications?all=true&participating=false&per_page=50');
});

test('buildNotificationsApiPath: includes since as ISO timestamp', () => {
  const cursor = Date.parse('2026-02-19T10:11:12.000Z');
  const path = buildNotificationsApiPath({ perPage: 25, since: cursor });

  assert.equal(
    path,
    '/notifications?all=true&participating=false&per_page=25&since=2026-02-19T10%3A11%3A12.000Z'
  );
});

test('buildNotificationsApiPath: ignores invalid since values', () => {
  assert.equal(
    buildNotificationsApiPath({ perPage: 10, since: 0 }),
    '/notifications?all=true&participating=false&per_page=10'
  );
  assert.equal(
    buildNotificationsApiPath({ perPage: 10, since: Number.NaN }),
    '/notifications?all=true&participating=false&per_page=10'
  );
});

test('buildNotificationsApiPath: includes page for pagination', () => {
  assert.equal(
    buildNotificationsApiPath({ perPage: 100, page: 3 }),
    '/notifications?all=true&participating=false&per_page=100&page=3'
  );
});
