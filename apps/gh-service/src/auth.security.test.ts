import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { authenticateRequest, HttpError } from './auth.js';

function createSignedUserToken(input: {
  sub: string;
  exp: number;
  secret: string;
}): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: input.sub,
      exp: input.exp,
    }),
    'utf8'
  ).toString('base64url');
  const signature = createHmac('sha256', input.secret)
    .update(payload, 'utf8')
    .digest('base64url');
  return `${payload}.${signature}`;
}

test('authenticateRequest: accepts signed user token when configured', () => {
  const secret = 'signed-user-token-secret';
  const token = createSignedUserToken({
    sub: 'user_from_token',
    exp: Math.floor(Date.now() / 1000) + 60,
    secret,
  });

  const auth = authenticateRequest(
    {
      headers: {
        'x-devsuite-user-id': 'ignored_user',
        'x-devsuite-user-token': token,
      },
    } as never,
    {
      serviceToken: null,
      userTokenSecret: secret,
    } as never
  );

  assert.equal(auth.userId, 'user_from_token');
});

test('authenticateRequest: rejects missing signed user token when required', () => {
  assert.throws(
    () =>
      authenticateRequest(
        {
          headers: {
            'x-devsuite-user-id': 'fallback_user',
          },
        } as never,
        {
          serviceToken: null,
          userTokenSecret: 'signed-user-token-secret',
        } as never
      ),
    (error: unknown) =>
      error instanceof HttpError &&
      error.code === 'MISSING_USER_TOKEN' &&
      error.statusCode === 400
  );
});

test('authenticateRequest: rejects expired signed token', () => {
  const secret = 'signed-user-token-secret';
  const token = createSignedUserToken({
    sub: 'user_from_token',
    exp: Math.floor(Date.now() / 1000) - 1,
    secret,
  });

  assert.throws(
    () =>
      authenticateRequest(
        {
          headers: {
            'x-devsuite-user-token': token,
          },
        } as never,
        {
          serviceToken: null,
          userTokenSecret: secret,
        } as never
      ),
    (error: unknown) =>
      error instanceof HttpError &&
      error.code === 'USER_TOKEN_EXPIRED' &&
      error.statusCode === 401
  );
});

test('authenticateRequest: falls back to x-devsuite-user-id without token secret', () => {
  const auth = authenticateRequest(
    {
      headers: {
        'x-devsuite-user-id': 'legacy_user',
      },
    } as never,
    {
      serviceToken: null,
      userTokenSecret: null,
    } as never
  );

  assert.equal(auth.userId, 'legacy_user');
});
