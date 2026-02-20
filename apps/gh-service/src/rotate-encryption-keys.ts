import './env.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { ConnectionStore } from './connection-store.js';
import { TokenCipher } from './token-cipher.js';
import { maskUserId } from './logging-utils.js';

function getTokenVersion(payload: string | null): string | null {
  if (!payload) {
    return null;
  }
  const [version] = payload.split(':');
  return version ?? null;
}

async function main() {
  const config = loadConfig();
  const logger = createLogger('info');
  const cipher = TokenCipher.fromBase64(config.encryptionKey, {
    keyVersion: config.encryptionKeyVersion,
    legacyKeys: config.encryptionLegacyKeys,
  });
  const store = new ConnectionStore(config.dataDir);
  await store.initialize();

  const users = await store.list();
  let rotated = 0;
  let skipped = 0;
  let failed = 0;

  for (const record of users) {
    if (!record.encryptedToken) {
      skipped += 1;
      continue;
    }

    const sourceVersion = getTokenVersion(record.encryptedToken);
    if (sourceVersion === cipher.version) {
      skipped += 1;
      continue;
    }

    try {
      const plaintext = cipher.decrypt(record.encryptedToken);
      const rotatedToken = cipher.encrypt(plaintext);
      await store.upsert(record.userId, current => ({
        ...(current ?? record),
        encryptedToken: rotatedToken,
        tokenVersion: cipher.version,
        updatedAt: Date.now(),
      }));
      rotated += 1;
    } catch (error) {
      failed += 1;
      logger.warn('failed to rotate encrypted gh token', {
        user: maskUserId(record.userId),
        version: sourceVersion,
        error: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }

  logger.info('gh token key rotation finished', {
    usersConsidered: users.length,
    rotated,
    skipped,
    failed,
    targetVersion: cipher.version,
  });

  if (failed > 0) {
    process.exitCode = 1;
  }
}

await main();
