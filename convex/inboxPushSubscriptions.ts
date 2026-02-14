import {
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';

interface UserIdentity {
  subject: string;
}

type DbCtx = QueryCtx | MutationCtx;

async function getUserId(ctx: DbCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Unauthorized');
  }
  return (identity as UserIdentity).subject;
}

async function assertCompanyAccess(
  ctx: DbCtx,
  companyId: Id<'companies'>,
  userId: string
) {
  const company = await ctx.db.get(companyId);
  if (
    !company ||
    company.userId !== userId ||
    company.isDeleted ||
    company.deletedAt !== null
  ) {
    throw new Error('Company not found or access denied');
  }
}

const subscriptionInput = v.object({
  endpoint: v.string(),
  expirationTime: v.union(v.number(), v.null()),
  keys: v.object({
    p256dh: v.string(),
    auth: v.string(),
  }),
  userAgent: v.optional(v.union(v.string(), v.null())),
});

export const upsertForCurrentUser = mutation({
  args: {
    companyId: v.id('companies'),
    subscription: subscriptionInput,
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    await assertCompanyAccess(ctx, args.companyId, userId);

    const endpoint = args.subscription.endpoint.trim();
    const p256dh = args.subscription.keys.p256dh.trim();
    const auth = args.subscription.keys.auth.trim();
    if (!endpoint || !p256dh || !auth) {
      throw new Error('Invalid push subscription payload');
    }

    const now = Date.now();
    const existing = await ctx.db
      .query('inboxPushSubscriptions')
      .withIndex('by_companyId_endpoint_deletedAt', q =>
        q
          .eq('companyId', args.companyId)
          .eq('endpoint', endpoint)
          .eq('deletedAt', null)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId,
        p256dh,
        auth,
        expirationTime: args.subscription.expirationTime,
        userAgent: args.subscription.userAgent ?? null,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert('inboxPushSubscriptions', {
      companyId: args.companyId,
      userId,
      endpoint,
      p256dh,
      auth,
      expirationTime: args.subscription.expirationTime,
      userAgent: args.subscription.userAgent ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  },
});

export const removeForCurrentUser = mutation({
  args: {
    companyId: v.id('companies'),
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    await assertCompanyAccess(ctx, args.companyId, userId);

    const endpoint = args.endpoint.trim();
    if (!endpoint) {
      return { removed: 0 };
    }

    const activeForUser = await ctx.db
      .query('inboxPushSubscriptions')
      .withIndex('by_companyId_userId_deletedAt', q =>
        q
          .eq('companyId', args.companyId)
          .eq('userId', userId)
          .eq('deletedAt', null)
      )
      .collect();

    const now = Date.now();
    let removed = 0;

    for (const subscription of activeForUser) {
      if (subscription.endpoint !== endpoint) {
        continue;
      }
      await ctx.db.patch(subscription._id, {
        deletedAt: now,
        updatedAt: now,
      });
      removed += 1;
    }

    return { removed };
  },
});

export const listActiveForCompany = internalQuery({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('inboxPushSubscriptions')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', args.companyId).eq('deletedAt', null)
      )
      .collect();
  },
});

export const softDeleteById = internalMutation({
  args: {
    id: v.id('inboxPushSubscriptions'),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.id);
    if (!subscription || subscription.deletedAt !== null) {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return args.id;
  },
});
