import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isDesktopPermissionAllowed,
  normalizePermissionName,
  shouldGrantDesktopPermission,
} from '../../src/desktop-permissions.js';

test('normalizePermissionName lowercases and trims values', () => {
  assert.equal(
    normalizePermissionName('  Clipboard-Sanitized-Write  '),
    'clipboard-sanitized-write'
  );
});

test('isDesktopPermissionAllowed allows only explicit safe permission set', () => {
  assert.equal(isDesktopPermissionAllowed('clipboard-sanitized-write'), true);
  assert.equal(isDesktopPermissionAllowed('notifications'), false);
  assert.equal(isDesktopPermissionAllowed('clipboard-read'), false);
});

test('shouldGrantDesktopPermission requires both allowed permission and trusted origin', () => {
  const allowedOrigins = new Set(['https://app.devsuite.example']);

  assert.equal(
    shouldGrantDesktopPermission({
      permission: 'clipboard-sanitized-write',
      requestingOrigin: 'https://app.devsuite.example/settings',
      allowedOrigins,
    }),
    true
  );

  assert.equal(
    shouldGrantDesktopPermission({
      permission: 'clipboard-sanitized-write',
      requestingOrigin: 'https://untrusted.example',
      allowedOrigins,
    }),
    false
  );

  assert.equal(
    shouldGrantDesktopPermission({
      permission: 'notifications',
      requestingOrigin: 'https://app.devsuite.example',
      allowedOrigins,
    }),
    false
  );
});
