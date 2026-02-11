import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { ensureDefaultListId } from './projectTaskLists';
import { ensureDefaultProjectId } from './projects';
import { ensureDefaultRateCardId } from './lib/billing';

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

function normalizeGithubOrgLogins(values: string[]): string[] {
  const unique = new Set<string>();

  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      continue;
    }

    if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(normalized)) {
      throw new Error(`Invalid GitHub org login: ${value}`);
    }

    unique.add(normalized);
  }

  return Array.from(unique);
}

export const create = mutation({
  args: {
    name: v.string(),
    githubOrgLogins: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const now = Date.now();
    const githubOrgLogins = normalizeGithubOrgLogins(
      args.githubOrgLogins ?? []
    );
    const companyId = await ctx.db.insert('companies', {
      name: args.name,
      userId,
      isDeleted: false,
      metadata: {
        githubOrgLogins,
      },
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert('integrationAuditEvents', {
      companyId,
      userId,
      integration: 'github',
      action: 'github_org_mapping_created',
      metadata: {
        githubOrgLogins,
      },
      createdAt: now,
    });

    const defaultProjectId = await ensureDefaultProjectId(ctx, companyId);
    await ensureDefaultListId(ctx, companyId, defaultProjectId);
    await ensureDefaultRateCardId(ctx, companyId);

    return companyId;
  },
});

export const update = mutation({
  args: {
    id: v.id('companies'),
    name: v.string(),
    githubOrgLogins: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const company = await ctx.db.get(args.id);

    if (!company) {
      throw new Error('Company not found');
    }

    if (company.userId !== userId) {
      throw new Error('Unauthorized');
    }

    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error('Company name cannot be empty');
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
      name: trimmedName,
    };

    if (args.githubOrgLogins !== undefined) {
      const githubOrgLogins = normalizeGithubOrgLogins(args.githubOrgLogins);
      const metadata =
        company.metadata && typeof company.metadata === 'object'
          ? (company.metadata as Record<string, unknown>)
          : {};
      const previousGithubOrgLogins = Array.isArray(
        (metadata as { githubOrgLogins?: unknown }).githubOrgLogins
      )
        ? ((metadata as { githubOrgLogins: unknown[] }).githubOrgLogins.filter(
            value => typeof value === 'string'
          ) as string[])
        : [];

      updates.metadata = {
        ...metadata,
        githubOrgLogins,
      };

      await ctx.db.insert('integrationAuditEvents', {
        companyId: company._id,
        userId,
        integration: 'github',
        action: 'github_org_mapping_updated',
        metadata: {
          previousGithubOrgLogins,
          githubOrgLogins,
        },
        createdAt: Date.now(),
      });
    }

    await ctx.db.patch(args.id, updates);
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
