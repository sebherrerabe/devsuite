import assert from 'node:assert/strict';
import test from 'node:test';

import { HttpError } from './auth.js';
import { __rateLimitForTests } from './server.js';

function createRequest(remoteAddress: string) {
  return {
    headers: {},
    socket: {
      remoteAddress,
    },
  } as never;
}

test('GH rate limiter: blocks requests after threshold', () => {
  __rateLimitForTests.clear();
  const req = createRequest('127.0.0.1');

  for (let idx = 0; idx < 120; idx += 1) {
    assert.doesNotThrow(() =>
      __rateLimitForTests.enforceRateLimit(req, '/github/connect/status')
    );
  }

  assert.throws(
    () => __rateLimitForTests.enforceRateLimit(req, '/github/connect/status'),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 429 &&
      error.code === 'RATE_LIMITED'
  );
});
