/**
 * JWKS maintenance for Better Auth.
 *
 * When BETTER_AUTH_SECRET changes, existing JWKS keys cannot be decrypted.
 * Run this mutation to clear the jwks table so Better Auth can generate fresh keys.
 *
 * Usage: npx convex run --component betterAuth jwks:clearAll
 */
import { mutation } from './_generated/server';

export const clearAll = mutation({
  args: {},
  handler: async ctx => {
    const docs = await ctx.db.query('jwks').collect();
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: docs.length };
  },
});
