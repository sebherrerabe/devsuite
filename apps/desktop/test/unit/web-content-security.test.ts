import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeHttpOrigin,
  resolveAllowedDesktopNavigationOrigins,
  shouldAllowInAppNavigation,
  shouldOpenInExternalBrowser,
} from '../../src/web-content-security.js';

test('normalizeHttpOrigin keeps only http/https origins', () => {
  assert.equal(
    normalizeHttpOrigin('https://devsuite.example/settings'),
    'https://devsuite.example'
  );
  assert.equal(normalizeHttpOrigin('file:///tmp/test.html'), null);
  assert.equal(normalizeHttpOrigin('not a url'), null);
});

test('resolveAllowedDesktopNavigationOrigins merges primary and additional origins', () => {
  const origins = resolveAllowedDesktopNavigationOrigins({
    webUrl: 'https://app.devsuite.example',
    nodeEnv: 'production',
    additionalOriginsCsv:
      'https://login.example.com, https://idp.example.com/path',
  });

  assert.equal(origins.has('https://app.devsuite.example'), true);
  assert.equal(origins.has('https://login.example.com'), true);
  assert.equal(origins.has('https://idp.example.com'), true);
});

test('shouldAllowInAppNavigation allows trusted origins and internal bootstrap pages', () => {
  const allowedOrigins = new Set(['https://app.devsuite.example']);

  assert.equal(
    shouldAllowInAppNavigation({
      url: 'https://app.devsuite.example/sessions',
      allowedOrigins,
    }),
    true
  );
  assert.equal(
    shouldAllowInAppNavigation({
      url: 'data:text/html;charset=utf-8,hello',
      allowedOrigins,
    }),
    true
  );
  assert.equal(
    shouldAllowInAppNavigation({
      url: 'about:blank',
      allowedOrigins,
    }),
    true
  );
  assert.equal(
    shouldAllowInAppNavigation({
      url: 'devsuite://app/settings/profile',
      allowedOrigins,
    }),
    true
  );
  assert.equal(
    shouldAllowInAppNavigation({
      url: 'https://malicious.example/phish',
      allowedOrigins,
    }),
    false
  );
});

test('shouldOpenInExternalBrowser flags non-trusted http/https urls only', () => {
  const allowedOrigins = new Set(['https://app.devsuite.example']);

  assert.equal(
    shouldOpenInExternalBrowser({
      url: 'https://malicious.example',
      allowedOrigins,
    }),
    true
  );
  assert.equal(
    shouldOpenInExternalBrowser({
      url: 'https://app.devsuite.example/help',
      allowedOrigins,
    }),
    false
  );
  assert.equal(
    shouldOpenInExternalBrowser({
      url: 'file:///tmp/example.txt',
      allowedOrigins,
    }),
    false
  );
});
