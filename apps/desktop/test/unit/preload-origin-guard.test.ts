import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveTrustedDesktopOrigins,
  shouldExposeDesktopApis,
} from '../../src/preload-origin-guard.js';

test('resolveTrustedDesktopOrigins uses configured web URL origin', () => {
  const trusted = resolveTrustedDesktopOrigins({
    webUrl: 'https://app.devsuite.example/path',
    nodeEnv: 'production',
  });

  assert.deepEqual([...trusted], ['https://app.devsuite.example']);
});

test('resolveTrustedDesktopOrigins falls back to localhost in non-production', () => {
  const trusted = resolveTrustedDesktopOrigins({
    webUrl: undefined,
    nodeEnv: 'development',
  });

  assert.equal(trusted.has('http://localhost:5173'), true);
});

test('resolveTrustedDesktopOrigins does not trust localhost by default in production', () => {
  const trusted = resolveTrustedDesktopOrigins({
    webUrl: undefined,
    nodeEnv: 'production',
  });

  assert.equal(trusted.size, 0);
});

test('resolveTrustedDesktopOrigins rejects opaque null origin from data: URLs', () => {
  const trusted = resolveTrustedDesktopOrigins({
    webUrl: 'data:text/html;charset=utf-8,%3Ch1%3Etest%3C/h1%3E',
    nodeEnv: 'development',
  });

  // data: URLs produce opaque origin "null" which must not be trusted.
  assert.equal(trusted.has('null'), false);
  assert.equal(trusted.size, 0);
});

test('shouldExposeDesktopApis allows internal widget window', () => {
  const allowed = shouldExposeDesktopApis({
    currentOrigin: 'https://untrusted.example',
    currentHash: '#devsuite-widget',
    trustedOrigins: new Set(),
  });

  assert.equal(allowed, true);
});

test('shouldExposeDesktopApis allows trusted origin and blocks untrusted origin', () => {
  const trustedOrigins = new Set(['https://app.devsuite.example']);

  assert.equal(
    shouldExposeDesktopApis({
      currentOrigin: 'https://app.devsuite.example',
      currentHash: '',
      trustedOrigins,
    }),
    true
  );

  assert.equal(
    shouldExposeDesktopApis({
      currentOrigin: 'https://malicious.example',
      currentHash: '',
      trustedOrigins,
    }),
    false
  );
});
