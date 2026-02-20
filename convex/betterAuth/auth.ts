import { createClient } from '@convex-dev/better-auth';
import { convex, crossDomain } from '@convex-dev/better-auth/plugins';
import type { GenericCtx } from '@convex-dev/better-auth/utils';
import { betterAuth, type BetterAuthOptions } from 'better-auth/minimal';
import { components } from '../_generated/api';
import type { DataModel } from '../_generated/dataModel';
import authConfig from '../auth.config';
import schema from './schema';

export function requireSiteUrl(siteUrl: string | undefined): string {
  if (!siteUrl) {
    throw new Error('SITE_URL is required for Better Auth');
  }
  return siteUrl;
}

export function requireBetterAuthSecret(secret: string | undefined): string {
  if (!secret || secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be at least 32 characters');
  }
  return secret;
}

const siteUrl = requireSiteUrl(process.env.SITE_URL);
const betterAuthSecret = requireBetterAuthSecret(
  process.env.BETTER_AUTH_SECRET
);

// Better Auth Component
export const authComponent = createClient<DataModel, typeof schema>(
  components.betterAuth,
  {
    local: {
      schema,
    },
    verbose: false,
  }
);

// Better Auth Options
export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
    appName: 'DevSuite',
    secret: betterAuthSecret,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      // Required for client-side frameworks (e.g. React SPA).
      crossDomain({ siteUrl }),
      // Required for Convex compatibility.
      convex({ authConfig }),
    ],
  } satisfies BetterAuthOptions;
};

// For `@better-auth/cli`
export const options = createAuthOptions({} as GenericCtx<DataModel>);

// Better Auth Instance
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};
