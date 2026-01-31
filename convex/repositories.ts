import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { RepositoryProvider } from '@devsuite/shared';

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

export const getByCompany = query({
  args: { companyId: v.id('companies') },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify user owns this company
    const company = await ctx.db.get(args.companyId);
    if (!company || company.userId !== userId) {
      throw new Error('Company not found or access denied');
    }

    return await ctx.db
      .query('repositories')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', args.companyId).eq('deletedAt', null)
      )
      .collect();
  },
});

export const create = mutation({
  args: {
    companyId: v.id('companies'),
    name: v.string(),
    url: v.string(),
    provider: v.optional(
      v.union(
        v.literal('github'),
        v.literal('gitlab'),
        v.literal('bitbucket'),
        v.literal('azure_devops'),
        v.literal('other')
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify user owns this company
    const company = await ctx.db.get(args.companyId);
    if (!company || company.userId !== userId) {
      throw new Error('Company not found or access denied');
    }

    // Validate URL format (basic validation)
    if (!args.url.startsWith('http://') && !args.url.startsWith('https://')) {
      throw new Error(
        'Invalid URL format - must start with http:// or https://'
      );
    }

    // Check for uniqueness within company
    const existing = await ctx.db
      .query('repositories')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', args.companyId).eq('deletedAt', null)
      )
      .filter(q => q.eq(q.field('url'), args.url))
      .first();

    if (existing) {
      throw new Error('Repository URL already exists in this company');
    }

    const now = Date.now();
    const repositoryId = await ctx.db.insert('repositories', {
      companyId: args.companyId,
      name: args.name.trim(),
      url: args.url.trim(),
      provider: args.provider || 'other',
      metadata: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    return repositoryId;
  },
});

export const update = mutation({
  args: {
    id: v.id('repositories'),
    name: v.optional(v.string()),
    url: v.optional(v.string()),
    provider: v.optional(
      v.union(
        v.literal('github'),
        v.literal('gitlab'),
        v.literal('bitbucket'),
        v.literal('azure_devops'),
        v.literal('other')
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const repository = await ctx.db.get(args.id);
    if (!repository) {
      throw new Error('Repository not found');
    }

    // Verify user owns this repository via company ownership
    const company = await ctx.db.get(repository.companyId);
    if (!company || company.userId !== userId) {
      throw new Error('Repository not found or access denied');
    }

    if (repository.deletedAt !== null) {
      throw new Error('Repository is deleted');
    }

    // Validate URL format if provided
    if (args.url) {
      if (!args.url.startsWith('http://') && !args.url.startsWith('https://')) {
        throw new Error(
          'Invalid URL format - must start with http:// or https://'
        );
      }

      // Check for uniqueness within company (excluding this repository)
      const existing = await ctx.db
        .query('repositories')
        .withIndex('by_companyId_deletedAt', q =>
          q.eq('companyId', repository.companyId).eq('deletedAt', null)
        )
        .filter(q => q.eq(q.field('url'), args.url))
        .filter(q => q.neq(q.field('_id'), args.id))
        .first();

      if (existing) {
        throw new Error('Repository URL already exists in this company');
      }
    }

    const updates: {
      updatedAt: number;
      name?: string;
      url?: string;
      provider?: RepositoryProvider;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name.trim();
    }
    if (args.url !== undefined) {
      updates.url = args.url.trim();
    }
    if (args.provider !== undefined) {
      updates.provider = args.provider;
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

export const remove = mutation({
  args: { id: v.id('repositories') },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const repository = await ctx.db.get(args.id);
    if (!repository) {
      throw new Error('Repository not found');
    }

    // Verify user owns this repository via company ownership
    const company = await ctx.db.get(repository.companyId);
    if (!company || company.userId !== userId) {
      throw new Error('Repository not found or access denied');
    }

    if (repository.deletedAt !== null) {
      throw new Error('Repository is already deleted');
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return args.id;
  },
});
