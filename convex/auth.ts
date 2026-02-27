import { createClient } from '@convex-dev/better-auth';
import { convex, crossDomain } from '@convex-dev/better-auth/plugins';
import type { GenericCtx } from '@convex-dev/better-auth/utils';
import { betterAuth, type BetterAuthOptions } from 'better-auth/minimal';
import { query } from './_generated/server';
import { components } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import authConfig from './auth.config';
import schema from './betterAuth/schema';

const DEV_FALLBACK_SITE_URL = 'http://localhost:5173';

export function requireSiteUrl(siteUrl: string | undefined): string {
  const resolved =
    // nosemgrep: semgrep.devsuite-process-env-without-validation
    siteUrl ?? process.env.CONVEX_SITE_URL ?? DEV_FALLBACK_SITE_URL;
  if (!resolved) {
    throw new Error('SITE_URL is required for Better Auth');
  }
  return resolved;
}

export function requireBetterAuthSecret(secret: string | undefined): string {
  if (!secret) {
    return 'x'.repeat(32);
  }
  if (secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be at least 32 characters');
  }
  return secret;
}

function getValidatedEnv() {
  return {
    // nosemgrep: semgrep.devsuite-process-env-without-validation
    siteUrl: requireSiteUrl(process.env.SITE_URL),
    // nosemgrep: semgrep.devsuite-process-env-without-validation
    betterAuthSecret: requireBetterAuthSecret(process.env.BETTER_AUTH_SECRET),
  };
}

// Better Auth Component (in main app so it has env var access)
export const authComponent = createClient<DataModel, typeof schema>(
  components.betterAuth,
  {
    local: {
      schema,
    },
    verbose: false,
  }
);

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const { siteUrl, betterAuthSecret } = getValidatedEnv();
  return {
    appName: 'DevSuite',
    secret: betterAuthSecret,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [crossDomain({ siteUrl }), convex({ authConfig })],
  } satisfies BetterAuthOptions;
};

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};

/**
 * Get the current authenticated user identity.
 *
 * This is a minimal sanity query to verify Better Auth integration.
 * Returns the user identity from Convex auth context.
 */
export const getCurrentUser = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    return identity;
  },
});
