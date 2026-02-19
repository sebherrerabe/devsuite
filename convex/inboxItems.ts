import { mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import type { FunctionReference } from 'convex/server';
import type { Doc, Id } from './_generated/dataModel';
import { assertNotDeleted } from './lib/helpers';

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

async function assertCompanyAccess(
  ctx: {
    db: {
      get: <T extends keyof DocTableMap>(id: Id<T>) => Promise<Doc<T> | null>;
    };
    auth: { getUserIdentity: () => Promise<UserIdentity | null> };
  },
  companyId: Id<'companies'>
) {
  const userId = await getUserId(ctx);
  const company = await ctx.db.get(companyId);
  if (!company || company.userId !== userId || company.isDeleted) {
    throw new Error('Company not found or access denied');
  }
}

type DocTableMap = {
  companies: Doc<'companies'>;
  inboxItems: Doc<'inboxItems'>;
};

const inboxItemTypeValidator = v.union(
  v.literal('notification'),
  v.literal('pr_review'),
  v.literal('mention'),
  v.literal('issue'),
  v.literal('comment'),
  v.literal('ci_status')
);

const inboxItemSourceValidator = v.union(
  v.literal('github'),
  v.literal('notion'),
  v.literal('internal')
);

const inboxItemContentValidator = v.object({
  title: v.string(),
  body: v.optional(v.string()),
  url: v.optional(v.string()),
  externalId: v.optional(v.string()),
  metadata: v.optional(v.any()),
});

const pushDeliveryApi = (
  internal as unknown as {
    inboxPushDelivery: {
      sendToCompanySubscribers: FunctionReference<
        'action',
        'internal',
        {
          companyId: Id<'companies'>;
          inboxItemId: Id<'inboxItems'>;
        },
        unknown
      >;
    };
  }
).inboxPushDelivery;

export const listInboxItems = query({
  args: {
    companyId: v.id('companies'),
    unreadOnly: v.optional(v.boolean()),
    includeArchived: v.optional(v.boolean()),
    source: v.optional(inboxItemSourceValidator),
    type: v.optional(inboxItemTypeValidator),
    limit: v.optional(v.number()),
    excludePrivate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await assertCompanyAccess(ctx, args.companyId);

    const unreadOnly = args.unreadOnly ?? false;
    const includeArchived = args.includeArchived ?? false;
    const excludePrivate = args.excludePrivate ?? false;
    const limit = args.limit ?? 200;

    const items = await ctx.db
      .query('inboxItems')
      .withIndex('by_companyId', q => q.eq('companyId', args.companyId))
      .collect();

    return items
      .filter(item => item.deletedAt === null)
      .filter(item => (includeArchived ? true : item.isArchived === false))
      .filter(item => (unreadOnly ? item.isRead === false : true))
      .filter(item => (args.source ? item.source === args.source : true))
      .filter(item => (args.type ? item.type === args.type : true))
      .filter(item => (excludePrivate ? item.isPrivate !== true : true))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, Math.max(1, Math.min(500, limit)));
  },
});

export const getUnreadCount = query({
  args: { companyId: v.id('companies') },
  handler: async (ctx, args) => {
    await assertCompanyAccess(ctx, args.companyId);

    const items = await ctx.db
      .query('inboxItems')
      .withIndex('by_companyId_isRead', q =>
        q.eq('companyId', args.companyId).eq('isRead', false)
      )
      .collect();

    return items.filter(item => item.deletedAt === null && !item.isArchived)
      .length;
  },
});

export const upsertInboxItem = mutation({
  args: {
    companyId: v.id('companies'),
    type: inboxItemTypeValidator,
    source: inboxItemSourceValidator,
    content: inboxItemContentValidator,
    isPrivate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await assertCompanyAccess(ctx, args.companyId);

    const externalId = args.content.externalId?.trim();
    if (!externalId) {
      throw new Error('content.externalId is required for upsert');
    }

    const title = args.content.title.trim();
    if (!title) {
      throw new Error('content.title is required');
    }

    const now = Date.now();

    const candidates = await ctx.db
      .query('inboxItems')
      .withIndex('by_companyId', q => q.eq('companyId', args.companyId))
      .collect();

    const existing = candidates.find(
      item =>
        item.source === args.source && item.content?.externalId === externalId
    );

    const nextContent = {
      ...args.content,
      title,
      externalId,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        type: args.type,
        source: args.source,
        content: nextContent,
        isRead: false,
        isArchived: false,
        isPrivate: args.isPrivate ?? existing.isPrivate,
        deletedAt: null,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(
        0,
        pushDeliveryApi.sendToCompanySubscribers,
        {
          companyId: args.companyId,
          inboxItemId: existing._id,
        }
      );
      return existing._id;
    }

    const inboxItemId = await ctx.db.insert('inboxItems', {
      companyId: args.companyId,
      type: args.type,
      source: args.source,
      content: nextContent,
      isRead: false,
      isArchived: false,
      isPrivate: args.isPrivate ?? false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await ctx.scheduler.runAfter(0, pushDeliveryApi.sendToCompanySubscribers, {
      companyId: args.companyId,
      inboxItemId: inboxItemId,
    });

    return inboxItemId;
  },
});

export const markAsRead = mutation({
  args: { companyId: v.id('companies'), id: v.id('inboxItems') },
  handler: async (ctx, args) => {
    await assertCompanyAccess(ctx, args.companyId);

    const item = await ctx.db.get(args.id);
    assertNotDeleted(item, 'InboxItem');
    if (item.companyId !== args.companyId) {
      throw new Error('InboxItem does not belong to company');
    }

    await ctx.db.patch(args.id, { isRead: true, updatedAt: Date.now() });
    return args.id;
  },
});

export const markAsUnread = mutation({
  args: { companyId: v.id('companies'), id: v.id('inboxItems') },
  handler: async (ctx, args) => {
    await assertCompanyAccess(ctx, args.companyId);

    const item = await ctx.db.get(args.id);
    assertNotDeleted(item, 'InboxItem');
    if (item.companyId !== args.companyId) {
      throw new Error('InboxItem does not belong to company');
    }

    await ctx.db.patch(args.id, { isRead: false, updatedAt: Date.now() });
    return args.id;
  },
});

export const archive = mutation({
  args: { companyId: v.id('companies'), id: v.id('inboxItems') },
  handler: async (ctx, args) => {
    await assertCompanyAccess(ctx, args.companyId);

    const item = await ctx.db.get(args.id);
    assertNotDeleted(item, 'InboxItem');
    if (item.companyId !== args.companyId) {
      throw new Error('InboxItem does not belong to company');
    }

    await ctx.db.patch(args.id, { isArchived: true, updatedAt: Date.now() });
    return args.id;
  },
});

export const unarchive = mutation({
  args: { companyId: v.id('companies'), id: v.id('inboxItems') },
  handler: async (ctx, args) => {
    await assertCompanyAccess(ctx, args.companyId);

    const item = await ctx.db.get(args.id);
    assertNotDeleted(item, 'InboxItem');
    if (item.companyId !== args.companyId) {
      throw new Error('InboxItem does not belong to company');
    }

    await ctx.db.patch(args.id, { isArchived: false, updatedAt: Date.now() });
    return args.id;
  },
});

export const bulkUpdate = mutation({
  args: {
    companyId: v.id('companies'),
    ids: v.array(v.id('inboxItems')),
    isRead: v.optional(v.boolean()),
    isArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await assertCompanyAccess(ctx, args.companyId);

    if (args.isRead === undefined && args.isArchived === undefined) {
      throw new Error('At least one field must be updated');
    }

    const now = Date.now();
    let updated = 0;

    for (const id of args.ids) {
      const item = await ctx.db.get(id);
      assertNotDeleted(item, 'InboxItem');
      if (item.companyId !== args.companyId) {
        throw new Error('InboxItem does not belong to company');
      }

      await ctx.db.patch(id, {
        ...(args.isRead === undefined ? {} : { isRead: args.isRead }),
        ...(args.isArchived === undefined
          ? {}
          : { isArchived: args.isArchived }),
        updatedAt: now,
      });
      updated++;
    }

    return { updated };
  },
});
