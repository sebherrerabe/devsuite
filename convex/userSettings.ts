import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';
import { requireCompanyId } from './lib/helpers';

type DbCtx = QueryCtx | MutationCtx;

async function getUserId(ctx: DbCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Unauthorized');
  }
  return identity.subject;
}

async function assertCompanyAccess(
  ctx: DbCtx,
  companyId: Id<'companies'>,
  userId: string
) {
  const company = await ctx.db.get(companyId);
  if (!company || company.userId !== userId) {
    throw new Error('Company not found or access denied');
  }
}

export const get = query({
  args: { companyId: v.id('companies') },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    return await ctx.db
      .query('userSettings')
      .withIndex('by_companyId_userId', q =>
        q.eq('companyId', companyId).eq('userId', userId)
      )
      .filter(q => q.eq(q.field('deletedAt'), null))
      .first();
  },
});

export const update = mutation({
  args: { companyId: v.id('companies'), timezone: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const existing = await ctx.db
      .query('userSettings')
      .withIndex('by_companyId_userId', q =>
        q.eq('companyId', companyId).eq('userId', userId)
      )
      .filter(q => q.eq(q.field('deletedAt'), null))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        timezone: args.timezone,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert('userSettings', {
      companyId,
      userId,
      timezone: args.timezone,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  },
});
