import { z } from 'zod';
import os from 'node:os';
import path from 'node:path';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DEVSUITE_NOTION_SERVICE_HOST: z.string().default('0.0.0.0'),
  DEVSUITE_NOTION_SERVICE_PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(8791),
  DEVSUITE_NOTION_SERVICE_TOKEN: z.string().trim().min(16).optional(),
  DEVSUITE_NOTION_SERVICE_CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173'),
  DEVSUITE_NOTION_SERVICE_DATA_DIR: z.string().trim().min(1).optional(),
  DEVSUITE_NOTION_SERVICE_ENCRYPTION_KEY: z.string().trim().min(1),
  DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN: z.string().trim().min(16).optional(),
  DEVSUITE_NOTION_OAUTH_CLIENT_ID: z.string().trim().min(1).optional(),
  DEVSUITE_NOTION_OAUTH_CLIENT_SECRET: z.string().trim().min(1).optional(),
  DEVSUITE_NOTION_OAUTH_REDIRECT_URI: z.string().trim().url().optional(),
  DEVSUITE_NOTION_POST_AUTH_REDIRECT_URL: z.string().trim().url().optional(),
  DEVSUITE_NOTION_WEBHOOK_VERIFICATION_TOKEN: z
    .string()
    .trim()
    .min(1)
    .optional(),
  DEVSUITE_CONVEX_SITE_URL: z.string().trim().url().optional(),
});

export interface NotionServiceConfig {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  serviceToken: string | null;
  corsOrigins: string[];
  dataDir: string;
  encryptionKey: string;
  backendToken: string | null;
  notionOauthClientId: string | null;
  notionOauthClientSecret: string | null;
  notionOauthRedirectUri: string | null;
  notionPostAuthRedirectUrl: string | null;
  notionWebhookVerificationToken: string | null;
  convexSiteUrl: string | null;
}

export function loadConfig(
  rawEnv: Record<string, string | undefined> = process.env
): NotionServiceConfig {
  const parsed = envSchema.parse(rawEnv);

  if (
    parsed.NODE_ENV === 'production' &&
    !parsed.DEVSUITE_NOTION_SERVICE_TOKEN
  ) {
    throw new Error('Missing DEVSUITE_NOTION_SERVICE_TOKEN in production');
  }

  const corsOrigins = parsed.DEVSUITE_NOTION_SERVICE_CORS_ORIGINS.split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  const dataDir =
    parsed.DEVSUITE_NOTION_SERVICE_DATA_DIR ??
    path.join(os.homedir(), '.devsuite', 'notion-service');

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.DEVSUITE_NOTION_SERVICE_HOST,
    port: parsed.DEVSUITE_NOTION_SERVICE_PORT,
    serviceToken: parsed.DEVSUITE_NOTION_SERVICE_TOKEN ?? null,
    corsOrigins,
    dataDir,
    encryptionKey: parsed.DEVSUITE_NOTION_SERVICE_ENCRYPTION_KEY,
    backendToken: parsed.DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN ?? null,
    notionOauthClientId: parsed.DEVSUITE_NOTION_OAUTH_CLIENT_ID ?? null,
    notionOauthClientSecret: parsed.DEVSUITE_NOTION_OAUTH_CLIENT_SECRET ?? null,
    notionOauthRedirectUri: parsed.DEVSUITE_NOTION_OAUTH_REDIRECT_URI ?? null,
    notionPostAuthRedirectUrl:
      parsed.DEVSUITE_NOTION_POST_AUTH_REDIRECT_URL ?? null,
    notionWebhookVerificationToken:
      parsed.DEVSUITE_NOTION_WEBHOOK_VERIFICATION_TOKEN ?? null,
    convexSiteUrl: parsed.DEVSUITE_CONVEX_SITE_URL ?? null,
  };
}
