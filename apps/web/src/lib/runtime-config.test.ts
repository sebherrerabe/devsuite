import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveWebRuntimeConfig } from './runtime-config';

test('resolveWebRuntimeConfig returns normalized runtime config when required env exists', () => {
  const result = resolveWebRuntimeConfig({
    VITE_CONVEX_URL: ' https://example.convex.cloud ',
    VITE_CONVEX_SITE_URL: ' https://example.convex.site ',
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      convexUrl: 'https://example.convex.cloud',
      convexSiteUrl: 'https://example.convex.site',
    },
  });
});

test('resolveWebRuntimeConfig reports missing convex url', () => {
  const result = resolveWebRuntimeConfig({
    VITE_CONVEX_URL: '   ',
    VITE_CONVEX_SITE_URL: 'https://example.convex.site',
  });

  assert.deepEqual(result, {
    ok: false,
    missingKeys: ['VITE_CONVEX_URL'],
  });
});

test('resolveWebRuntimeConfig reports both missing required env values', () => {
  const result = resolveWebRuntimeConfig({
    VITE_CONVEX_URL: '',
    VITE_CONVEX_SITE_URL: undefined,
  });

  assert.deepEqual(result, {
    ok: false,
    missingKeys: ['VITE_CONVEX_URL', 'VITE_CONVEX_SITE_URL'],
  });
});
