import './env.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { NotionConnectionStore } from './notion-connection-store.js';
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
  const store = new NotionConnectionStore(config.dataDir);
  await store.initialize();

  const connections = await store.list();
  let rotated = 0;
  let skipped = 0;
  let failed = 0;

  for (const connection of connections) {
    const accessVersion = getTokenVersion(connection.encryptedAccessToken);
    const refreshVersion = getTokenVersion(connection.encryptedRefreshToken);
    const needsAccessRotation =
      !!connection.encryptedAccessToken && accessVersion !== cipher.version;
    const needsRefreshRotation =
      !!connection.encryptedRefreshToken && refreshVersion !== cipher.version;

    if (!needsAccessRotation && !needsRefreshRotation) {
      skipped += 1;
      continue;
    }

    try {
      const nextAccessToken = connection.encryptedAccessToken
        ? needsAccessRotation
          ? cipher.encrypt(cipher.decrypt(connection.encryptedAccessToken))
          : connection.encryptedAccessToken
        : null;
      const nextRefreshToken = connection.encryptedRefreshToken
        ? needsRefreshRotation
          ? cipher.encrypt(cipher.decrypt(connection.encryptedRefreshToken))
          : connection.encryptedRefreshToken
        : null;

      await store.upsert(connection.userId, connection.companyId, current => ({
        ...(current ?? connection),
        encryptedAccessToken: nextAccessToken,
        encryptedRefreshToken: nextRefreshToken,
        tokenVersion: cipher.version,
        updatedAt: Date.now(),
      }));
      rotated += 1;
    } catch (error) {
      failed += 1;
      logger.warn('failed to rotate encrypted notion token', {
        user: maskUserId(connection.userId),
        companyId: connection.companyId,
        accessVersion,
        refreshVersion,
        error: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }

  logger.info('notion token key rotation finished', {
    connectionsConsidered: connections.length,
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
