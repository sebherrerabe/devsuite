import assert from 'node:assert/strict';
import { before } from 'node:test';
import test from 'node:test';

let requireBetterAuthSecret!: (secret: string | undefined) => string;
let requireSiteUrl!: (siteUrl: string | undefined) => string;

before(async () => {
  process.env.SITE_URL ??= 'http://localhost:5173';
  process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
  const authModule = await import('./auth.js');
  requireBetterAuthSecret = authModule.requireBetterAuthSecret;
  requireSiteUrl = authModule.requireSiteUrl;
});

test('requireSiteUrl: rejects empty site url', () => {
  assert.throws(() => requireSiteUrl(undefined), /SITE_URL is required/);
});

test('requireSiteUrl: accepts configured site url', () => {
  assert.equal(requireSiteUrl('https://example.com'), 'https://example.com');
});

test('requireBetterAuthSecret: rejects short secrets', () => {
  assert.throws(
    () => requireBetterAuthSecret('short-secret'),
    /BETTER_AUTH_SECRET must be at least 32 characters/
  );
});

test('requireBetterAuthSecret: accepts 32+ char secrets', () => {
  const secret = 's'.repeat(32);
  assert.equal(requireBetterAuthSecret(secret), secret);
});
