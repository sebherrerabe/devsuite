import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';
import { requireCompanyId } from './lib/helpers';
import {
  moduleFlagsValidator,
  normalizeUserModuleFlagOverrides,
} from './lib/moduleAccess';

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

function normalizeUserModuleFlagsForStorage(value: unknown) {
  const normalized = normalizeUserModuleFlagOverrides(value);
  if (normalized.projects === false) {
    normalized.sessions = false;
    normalized.performance = false;
    normalized.invoicing = false;
  }
  if (normalized.sessions === false) {
    normalized.invoicing = false;
  }
  return normalized;
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
      .first()
      .then(settings =>
        settings
          ? {
              ...settings,
              moduleFlags: normalizeUserModuleFlagsForStorage(
                settings.moduleFlags
              ),
            }
          : null
      );
  },
});

export const update = mutation({
  args: {
    companyId: v.id('companies'),
    timezone: v.optional(v.string()),
    moduleFlags: v.optional(moduleFlagsValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    if (args.timezone === undefined && args.moduleFlags === undefined) {
      throw new Error('No settings provided');
    }

    const existing = await ctx.db
      .query('userSettings')
      .withIndex('by_companyId_userId', q =>
        q.eq('companyId', companyId).eq('userId', userId)
      )
      .filter(q => q.eq(q.field('deletedAt'), null))
      .first();

    const now = Date.now();
    if (existing) {
      const updates: {
        timezone?: string;
        moduleFlags?: ReturnType<typeof normalizeUserModuleFlagsForStorage>;
        updatedAt: number;
      } = {
        updatedAt: now,
      };
      if (args.timezone !== undefined) {
        updates.timezone = args.timezone;
      }
      if (args.moduleFlags !== undefined) {
        updates.moduleFlags = normalizeUserModuleFlagsForStorage(
          args.moduleFlags
        );
      }
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    return await ctx.db.insert('userSettings', {
      companyId,
      userId,
      timezone: args.timezone ?? 'UTC',
      moduleFlags:
        args.moduleFlags === undefined
          ? {}
          : normalizeUserModuleFlagsForStorage(args.moduleFlags),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  },
});
