import { query } from './_generated/server';

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
