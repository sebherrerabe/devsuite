import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { ensureDefaultListId } from './projectTaskLists';
import { ensureDefaultProjectId } from './projects';

/**
 * User identity type from Convex auth
 */
interface UserIdentity {
  subject: string;
}

/**
 * Get the current user ID from the auth context.
 * Throws if the user is not authenticated.
 */
async function getUserId(ctx: {
  auth: { getUserIdentity: () => Promise<UserIdentity | null> };
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Unauthorized');
  }
  return identity.subject;
}

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const now = Date.now();
    const companyId = await ctx.db.insert('companies', {
      name: args.name,
      userId,
      isDeleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const defaultProjectId = await ensureDefaultProjectId(ctx, companyId);
    await ensureDefaultListId(ctx, companyId, defaultProjectId);

    return companyId;
  },
});

export const update = mutation({
  args: { id: v.id('companies'), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const company = await ctx.db.get(args.id);

    if (!company) {
      throw new Error('Company not found');
    }

    if (company.userId !== userId) {
      throw new Error('Unauthorized');
    }

    await ctx.db.patch(args.id, {
      name: args.name,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id('companies') },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const company = await ctx.db.get(args.id);

    if (!company) {
      throw new Error('Company not found');
    }

    if (company.userId !== userId) {
      throw new Error('Unauthorized');
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      isDeleted: true,
      deletedAt: now,
      updatedAt: now,
    });
  },
});

export const list = query({
  args: {},
  handler: async ctx => {
    const userId = await getUserId(ctx);

    return await ctx.db
      .query('companies')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .filter(q => q.eq(q.field('isDeleted'), false))
      .collect();
  },
});

export const get = query({
  args: { id: v.id('companies') },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const company = await ctx.db.get(args.id);

    if (!company || company.userId !== userId || company.isDeleted) {
      return null;
    }

    return company;
  },
});
