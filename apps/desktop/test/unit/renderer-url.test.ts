import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveRendererUrl } from '../../src/renderer-url.js';

test('resolveRendererUrl prefers explicit env URL override', () => {
  const resolved = resolveRendererUrl({
    envUrl: '  https://devsuite.example/app  ',
    isPackaged: true,
    rendererExists: false,
  });

  assert.equal(resolved, 'https://devsuite.example/app');
});

test('resolveRendererUrl uses local Vite URL in dev mode', () => {
  const resolved = resolveRendererUrl({
    envUrl: '  ',
    isPackaged: false,
    rendererExists: false,
  });

  assert.equal(resolved, 'http://localhost:5173');
});

test('resolveRendererUrl uses bundled protocol in packaged mode', () => {
  const resolved = resolveRendererUrl({
    envUrl: undefined,
    isPackaged: true,
    rendererExists: true,
  });

  assert.equal(resolved, 'devsuite://app/');
});

test('resolveRendererUrl falls back to undefined when no source is available', () => {
  const resolved = resolveRendererUrl({
    envUrl: undefined,
    isPackaged: true,
    rendererExists: false,
  });

  assert.equal(resolved, undefined);
});
