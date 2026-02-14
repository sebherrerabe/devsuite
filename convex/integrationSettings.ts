import {
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';
import { requireCompanyId } from './lib/helpers';

type IntegrationName = 'github' | 'notion';
type Ctx = QueryCtx | MutationCtx;

const integrationInput = v.union(v.literal('github'), v.literal('notion'));

async function getUserId(ctx: Ctx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Unauthorized');
  }
  return identity.subject;
}

async function assertCompanyAccess(
  ctx: Ctx,
  companyId: Id<'companies'>,
  userId: string
): Promise<void> {
  const company = await ctx.db.get(companyId);
  if (!company || company.isDeleted || company.deletedAt !== null) {
    throw new Error('Company not found');
  }
  if (company.userId !== userId) {
    throw new Error('Unauthorized');
  }
}

async function getSetting(
  ctx: Ctx,
  companyId: Id<'companies'>,
  userId: string,
  integration: IntegrationName
) {
  return await ctx.db
    .query('integrationSettings')
    .withIndex('by_companyId_userId_integration_deletedAt', q =>
      q
        .eq('companyId', companyId)
        .eq('userId', userId)
        .eq('integration', integration)
        .eq('deletedAt', null)
    )
    .first();
}

function buildResponse(
  rows: Array<{ integration: IntegrationName; enabled: boolean }>,
  companyId: Id<'companies'>,
  userId: string
) {
  let github = false;
  let notion = false;

  for (const row of rows) {
    if (row.integration === 'github') {
      github = row.enabled;
    }
    if (row.integration === 'notion') {
      notion = row.enabled;
    }
  }

  return {
    companyId,
    userId,
    github,
    notion,
  };
}

async function listCompanyUserSettings(
  ctx: Ctx,
  companyId: Id<'companies'>,
  userId: string
) {
  return await ctx.db
    .query('integrationSettings')
    .withIndex('by_companyId_userId_deletedAt', q =>
      q.eq('companyId', companyId).eq('userId', userId).eq('deletedAt', null)
    )
    .collect();
}

export const getForCompany = query({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const settings = await listCompanyUserSettings(ctx, companyId, userId);
    return buildResponse(settings, companyId, userId);
  },
});

export const setEnabled = mutation({
  args: {
    companyId: v.id('companies'),
    integration: integrationInput,
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const now = Date.now();
    const existing = await getSetting(ctx, companyId, userId, args.integration);

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('integrationSettings', {
        companyId,
        userId,
        integration: args.integration,
        enabled: args.enabled,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    }

    await ctx.db.insert('integrationAuditEvents', {
      companyId,
      userId,
      integration: args.integration,
      action: args.enabled ? 'integration_enabled' : 'integration_disabled',
      metadata: {
        integration: args.integration,
        enabled: args.enabled,
      },
      createdAt: now,
    });

    const settings = await listCompanyUserSettings(ctx, companyId, userId);
    return buildResponse(settings, companyId, userId);
  },
});

export const isEnabledForCompanyUser = internalQuery({
  args: {
    userId: v.string(),
    companyId: v.id('companies'),
    integration: integrationInput,
  },
  handler: async (ctx, args) => {
    const setting = await getSetting(
      ctx,
      args.companyId,
      args.userId,
      args.integration
    );
    return setting?.enabled === true;
  },
});

export const listEnabledCompanyIdsForUser = internalQuery({
  args: {
    userId: v.string(),
    integration: integrationInput,
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query('integrationSettings')
      .withIndex('by_userId_integration_enabled_deletedAt', q =>
        q
          .eq('userId', args.userId)
          .eq('integration', args.integration)
          .eq('enabled', true)
          .eq('deletedAt', null)
      )
      .collect();

    return settings.map(setting => setting.companyId);
  },
});
