import assert from 'node:assert/strict';
import test from 'node:test';

import { loadConfig } from './config.js';

const VALID_BASE64_KEY = Buffer.alloc(32, 1).toString('base64');

function createBaseEnv(): Record<string, string> {
  return {
    NODE_ENV: 'development',
    DEVSUITE_GH_SERVICE_ENCRYPTION_KEY: VALID_BASE64_KEY,
  };
}

test('loadConfig: requires service token outside development', () => {
  const env = {
    ...createBaseEnv(),
    NODE_ENV: 'test',
  };

  assert.throws(
    () => loadConfig(env),
    /Missing DEVSUITE_GH_SERVICE_TOKEN in non-development environments/
  );
});

test('loadConfig: allows missing service token in development', () => {
  const config = loadConfig(createBaseEnv());
  assert.equal(config.serviceToken, null);
});

test('loadConfig: rejects invalid legacy key map JSON', () => {
  const env = {
    ...createBaseEnv(),
    DEVSUITE_GH_SERVICE_ENCRYPTION_LEGACY_KEYS: '{invalid-json}',
  };

  assert.throws(
    () => loadConfig(env),
    /DEVSUITE_GH_SERVICE_ENCRYPTION_LEGACY_KEYS must be valid JSON/
  );
});

test('loadConfig: parses legacy key map', () => {
  const legacyKey = Buffer.alloc(32, 2).toString('base64');
  const env = {
    ...createBaseEnv(),
    DEVSUITE_GH_SERVICE_ENCRYPTION_LEGACY_KEYS: JSON.stringify({
      v1: legacyKey,
    }),
  };

  const config = loadConfig(env);
  assert.equal(config.encryptionLegacyKeys.v1, legacyKey);
});
