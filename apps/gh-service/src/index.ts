import './env.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createGhServiceServer } from './server.js';
import { ConnectionManager } from './connection-manager.js';
import { TokenCipher } from './token-cipher.js';
import { ConvexBackendClient } from './convex-backend-client.js';
import { NotificationPoller } from './notification-poller.js';

const config = loadConfig();
const logger = createLogger(
  config.nodeEnv === 'development' ? 'debug' : 'info'
);
const tokenCipher = TokenCipher.fromBase64(config.encryptionKey, {
  keyVersion: config.encryptionKeyVersion,
  legacyKeys: config.encryptionLegacyKeys,
});
const connectionManager = new ConnectionManager(
  config.dataDir,
  tokenCipher,
  logger,
  {
    oauthClientId: config.oauthClientId,
    oauthScopes: config.oauthScopes,
  }
);
await connectionManager.initialize();

const backendClient =
  config.convexSiteUrl && config.backendToken
    ? new ConvexBackendClient(config.convexSiteUrl, config.backendToken)
    : null;
const server = createGhServiceServer(
  config,
  logger,
  connectionManager,
  backendClient
);
let notificationPoller: NotificationPoller | null = null;

if (config.notificationPollEnabled && backendClient) {
  notificationPoller = new NotificationPoller({
    connectionManager,
    backendClient,
    logger,
    intervalMs: config.notificationPollIntervalMs,
    batchSize: config.notificationBatchSize,
  });
  notificationPoller.start();
} else if (config.notificationPollEnabled) {
  logger.warn(
    'Notification polling disabled because backend config is incomplete',
    {
      convexConfigured: Boolean(config.convexSiteUrl),
      backendTokenConfigured: Boolean(config.backendToken),
    }
  );
}

server.listen(config.port, config.host, () => {
  logger.info('DevSuite GH service started', {
    host: config.host,
    port: config.port,
    convexConfigured: Boolean(config.convexSiteUrl),
    serviceTokenConfigured: Boolean(config.serviceToken),
    backendTokenConfigured: Boolean(config.backendToken),
    notificationPollEnabled: config.notificationPollEnabled,
    notificationPollIntervalMs: config.notificationPollIntervalMs,
    notificationBatchSize: config.notificationBatchSize,
    oauthClientId: config.oauthClientId,
    oauthScopeCount: config.oauthScopes.length,
    dataDir: config.dataDir,
  });
});

process.on('SIGINT', () => {
  logger.info('Shutting down GH service');
  notificationPoller?.stop();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logger.info('Shutting down GH service');
  notificationPoller?.stop();
  server.close(() => {
    process.exit(0);
  });
});
