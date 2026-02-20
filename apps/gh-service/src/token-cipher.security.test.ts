import assert from 'node:assert/strict';
import test from 'node:test';

import { TokenCipher } from './token-cipher.js';

const KEY_V1 = Buffer.alloc(32, 1).toString('base64');
const KEY_V2 = Buffer.alloc(32, 2).toString('base64');

test('TokenCipher: encrypt uses active key version', () => {
  const cipher = TokenCipher.fromBase64(KEY_V2, { keyVersion: 'v2' });
  const encrypted = cipher.encrypt('token');
  assert.ok(encrypted.startsWith('v2:'));
});

test('TokenCipher: decrypt supports legacy key versions', () => {
  const oldCipher = TokenCipher.fromBase64(KEY_V1, { keyVersion: 'v1' });
  const encryptedWithOldKey = oldCipher.encrypt('token-from-v1');

  const currentCipher = TokenCipher.fromBase64(KEY_V2, {
    keyVersion: 'v2',
    legacyKeys: {
      v1: KEY_V1,
    },
  });

  assert.equal(currentCipher.decrypt(encryptedWithOldKey), 'token-from-v1');
});

test('TokenCipher: rejects invalid key version labels', () => {
  assert.throws(
    () =>
      TokenCipher.fromBase64(KEY_V1, {
        keyVersion: 'v2:bad',
      }),
    /DEVSUITE_GH_SERVICE_ENCRYPTION_KEY_VERSION contains invalid characters/
  );
});
