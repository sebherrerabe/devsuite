import { z } from 'zod';
import os from 'node:os';
import path from 'node:path';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DEVSUITE_GH_SERVICE_HOST: z.string().default('0.0.0.0'),
  DEVSUITE_GH_SERVICE_PORT: z.coerce.number().int().positive().default(8790),
  DEVSUITE_GH_SERVICE_TOKEN: z.string().trim().min(16).optional(),
  DEVSUITE_GH_SERVICE_USER_TOKEN_SECRET: z.string().trim().min(16).optional(),
  DEVSUITE_GH_SERVICE_CORS_ORIGINS: z.string().default('http://localhost:5173'),
  DEVSUITE_GH_SERVICE_DATA_DIR: z.string().trim().min(1).optional(),
  DEVSUITE_GH_SERVICE_ENCRYPTION_KEY: z.string().trim().min(1),
  DEVSUITE_GH_SERVICE_ENCRYPTION_KEY_VERSION: z.string().trim().default('v1'),
  DEVSUITE_GH_SERVICE_ENCRYPTION_LEGACY_KEYS: z.string().trim().optional(),
  DEVSUITE_GH_SERVICE_BACKEND_TOKEN: z.string().trim().min(16).optional(),
  DEVSUITE_GH_SERVICE_NOTIFICATION_POLL_ENABLED: z
    .enum(['true', 'false'])
    .default('true'),
  DEVSUITE_GH_SERVICE_NOTIFICATION_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(10_000)
    .optional(),
  DEVSUITE_GH_SERVICE_NOTIFICATION_BATCH_SIZE: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50),
  DEVSUITE_GH_OAUTH_CLIENT_ID: z
    .string()
    .trim()
    .min(1)
    .default('178c6fc778ccc68e1d6a'),
  DEVSUITE_GH_OAUTH_SCOPES: z
    .string()
    .trim()
    .default('repo,read:org,gist,notifications'),
  DEVSUITE_CONVEX_SITE_URL: z.string().trim().url().optional(),
});

export interface GhServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  serviceToken: string | null;
  userTokenSecret: string | null;
  corsOrigins: string[];
  dataDir: string;
  encryptionKey: string;
  encryptionKeyVersion: string;
  encryptionLegacyKeys: Record<string, string>;
  backendToken: string | null;
  notificationPollEnabled: boolean;
  notificationPollIntervalMs: number;
  notificationBatchSize: number;
  oauthClientId: string;
  oauthScopes: string[];
  convexSiteUrl: string | null;
}

export function loadConfig(
  rawEnv: Record<string, string | undefined> = process.env
): GhServiceConfig {
  const parsed = envSchema.parse(rawEnv);

  if (parsed.NODE_ENV !== 'development' && !parsed.DEVSUITE_GH_SERVICE_TOKEN) {
    throw new Error(
      'Missing DEVSUITE_GH_SERVICE_TOKEN in non-development environments'
    );
  }

  const corsOrigins = parsed.DEVSUITE_GH_SERVICE_CORS_ORIGINS.split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  const oauthScopes = parsed.DEVSUITE_GH_OAUTH_SCOPES.split(',')
    .map(scope => scope.trim())
    .filter(Boolean);
  if (oauthScopes.length === 0) {
    throw new Error('DEVSUITE_GH_OAUTH_SCOPES must include at least one scope');
  }

  const dataDir =
    parsed.DEVSUITE_GH_SERVICE_DATA_DIR ??
    path.join(os.homedir(), '.devsuite', 'gh-service');
  let encryptionLegacyKeys: Record<string, string> = {};
  if (parsed.DEVSUITE_GH_SERVICE_ENCRYPTION_LEGACY_KEYS) {
    let parsedLegacy: unknown;
    try {
      parsedLegacy = JSON.parse(
        parsed.DEVSUITE_GH_SERVICE_ENCRYPTION_LEGACY_KEYS
      );
    } catch {
      throw new Error(
        'DEVSUITE_GH_SERVICE_ENCRYPTION_LEGACY_KEYS must be valid JSON'
      );
    }
    if (
      !parsedLegacy ||
      typeof parsedLegacy !== 'object' ||
      Array.isArray(parsedLegacy)
    ) {
      throw new Error(
        'DEVSUITE_GH_SERVICE_ENCRYPTION_LEGACY_KEYS must be an object map'
      );
    }

    encryptionLegacyKeys = Object.fromEntries(
      Object.entries(parsedLegacy).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === 'string' && typeof entry[1] === 'string'
      )
    );
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.DEVSUITE_GH_SERVICE_HOST,
    port: parsed.DEVSUITE_GH_SERVICE_PORT,
    serviceToken: parsed.DEVSUITE_GH_SERVICE_TOKEN ?? null,
    userTokenSecret: parsed.DEVSUITE_GH_SERVICE_USER_TOKEN_SECRET ?? null,
    corsOrigins,
    dataDir,
    encryptionKey: parsed.DEVSUITE_GH_SERVICE_ENCRYPTION_KEY,
    encryptionKeyVersion: parsed.DEVSUITE_GH_SERVICE_ENCRYPTION_KEY_VERSION,
    encryptionLegacyKeys,
    backendToken: parsed.DEVSUITE_GH_SERVICE_BACKEND_TOKEN ?? null,
    notificationPollEnabled:
      parsed.DEVSUITE_GH_SERVICE_NOTIFICATION_POLL_ENABLED !== 'false',
    notificationPollIntervalMs:
      parsed.DEVSUITE_GH_SERVICE_NOTIFICATION_POLL_INTERVAL_MS ??
      (parsed.NODE_ENV === 'production' ? 300_000 : 60_000),
    notificationBatchSize: parsed.DEVSUITE_GH_SERVICE_NOTIFICATION_BATCH_SIZE,
    oauthClientId: parsed.DEVSUITE_GH_OAUTH_CLIENT_ID,
    oauthScopes,
    convexSiteUrl: parsed.DEVSUITE_CONVEX_SITE_URL ?? null,
  };
}
