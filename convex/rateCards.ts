import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';
import {
  assertCompanyScoped,
  requireCompanyId,
  assertNotDeleted,
} from './lib/helpers';
import { getDefaultRateCard } from './lib/billing';
import { assertModuleEnabled } from './lib/moduleAccess';

type DbCtx = QueryCtx | MutationCtx;

/**
 * Get the current user ID from the auth context.
 * Throws if the user is not authenticated.
 */
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
  await assertModuleEnabled(ctx, companyId, 'invoicing', userId);
}

export const getDefault = query({
  args: { companyId: v.id('companies') },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    return await getDefaultRateCard(ctx, companyId);
  },
});

export const setDefault = mutation({
  args: {
    companyId: v.id('companies'),
    hourlyRateCents: v.number(),
    currency: v.string(),
    roundingIncrementMinutes: v.number(),
    roundingMode: v.union(
      v.literal('floor'),
      v.literal('ceil'),
      v.literal('nearest')
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const existing = await getDefaultRateCard(ctx, companyId);
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        hourlyRateCents: args.hourlyRateCents,
        currency: args.currency,
        roundingIncrementMinutes: args.roundingIncrementMinutes,
        roundingMode: args.roundingMode,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert('rateCards', {
      companyId,
      name: 'Default Rate',
      hourlyRateCents: args.hourlyRateCents,
      currency: args.currency,
      roundingIncrementMinutes: args.roundingIncrementMinutes,
      roundingMode: args.roundingMode,
      description: 'Default billing rate',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  },
});

export const getProjectRate = query({
  args: { companyId: v.id('companies'), projectId: v.id('projects') },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const project = await ctx.db.get(args.projectId);
    assertCompanyScoped(project, companyId, 'projects');
    assertNotDeleted(project, 'projects');

    const defaultRate = await getDefaultRateCard(ctx, companyId);
    const rateCardId = project.rateCardId ?? defaultRate?._id ?? null;
    const rateCard = rateCardId ? await ctx.db.get(rateCardId) : null;

    return {
      project,
      rateCard,
      isDefault: rateCard ? rateCard.isDefault : false,
    };
  },
});

export const setProjectRate = mutation({
  args: {
    companyId: v.id('companies'),
    projectId: v.id('projects'),
    useDefault: v.optional(v.boolean()),
    hourlyRateCents: v.optional(v.number()),
    currency: v.optional(v.string()),
    roundingIncrementMinutes: v.optional(v.number()),
    roundingMode: v.optional(
      v.union(v.literal('floor'), v.literal('ceil'), v.literal('nearest'))
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const project = await ctx.db.get(args.projectId);
    assertCompanyScoped(project, companyId, 'projects');
    assertNotDeleted(project, 'projects');

    if (args.useDefault) {
      await ctx.db.patch(project._id, {
        rateCardId: null,
        updatedAt: Date.now(),
      });
      return { projectId: project._id, rateCardId: null };
    }

    if (
      args.hourlyRateCents === undefined ||
      args.currency === undefined ||
      args.roundingIncrementMinutes === undefined ||
      args.roundingMode === undefined
    ) {
      throw new Error('Rate override requires all rate fields');
    }

    const now = Date.now();
    let rateCardId = project.rateCardId ?? null;

    if (rateCardId) {
      const existing = await ctx.db.get(rateCardId);
      if (existing && !existing.isDefault) {
        await ctx.db.patch(rateCardId, {
          hourlyRateCents: args.hourlyRateCents,
          currency: args.currency,
          roundingIncrementMinutes: args.roundingIncrementMinutes,
          roundingMode: args.roundingMode,
          updatedAt: now,
        });
        return { projectId: project._id, rateCardId };
      }
    }

    rateCardId = await ctx.db.insert('rateCards', {
      companyId,
      name: `${project.name} Rate`,
      hourlyRateCents: args.hourlyRateCents,
      currency: args.currency,
      roundingIncrementMinutes: args.roundingIncrementMinutes,
      roundingMode: args.roundingMode,
      description: `Rate override for project ${project.name}`,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await ctx.db.patch(project._id, {
      rateCardId,
      updatedAt: now,
    });

    return { projectId: project._id, rateCardId };
  },
});
