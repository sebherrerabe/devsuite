import './env.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { TokenCipher } from './token-cipher.js';
import { ConvexBackendClient } from './convex-backend-client.js';
import { NotionConnectionManager } from './notion-connection-manager.js';
import { createNotionServiceServer } from './server.js';

const config = loadConfig();
const logger = createLogger(
  config.nodeEnv === 'development' ? 'debug' : 'info'
);
const tokenCipher = TokenCipher.fromBase64(config.encryptionKey, {
  keyVersion: config.encryptionKeyVersion,
  legacyKeys: config.encryptionLegacyKeys,
});
const backendClient =
  config.convexSiteUrl && config.backendToken
    ? new ConvexBackendClient(config.convexSiteUrl, config.backendToken)
    : null;

const notionConnectionManager = new NotionConnectionManager(
  config.dataDir,
  tokenCipher,
  logger,
  {
    oauthClientId: config.notionOauthClientId,
    oauthClientSecret: config.notionOauthClientSecret,
    oauthRedirectUri: config.notionOauthRedirectUri,
    backendClient,
  }
);
await notionConnectionManager.initialize();

const server = createNotionServiceServer(
  config,
  logger,
  notionConnectionManager,
  backendClient
);

server.listen(config.port, config.host, () => {
  logger.info('DevSuite Notion service started', {
    host: config.host,
    port: config.port,
    serviceTokenConfigured: Boolean(config.serviceToken),
    backendTokenConfigured: Boolean(config.backendToken),
    convexConfigured: Boolean(config.convexSiteUrl),
    oauthConfigured: Boolean(
      config.notionOauthClientId &&
      config.notionOauthClientSecret &&
      config.notionOauthRedirectUri
    ),
    dataDir: config.dataDir,
  });
});

process.on('SIGINT', () => {
  logger.info('Shutting down Notion service');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logger.info('Shutting down Notion service');
  server.close(() => {
    process.exit(0);
  });
});
