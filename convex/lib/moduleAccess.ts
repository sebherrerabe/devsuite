import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { v } from 'convex/values';
import {
  type AppModule,
  type ModuleFlagOverrides,
  type ModuleFlags,
  DEFAULT_MODULE_FLAGS,
  normalizeModuleFlagOverrides,
  normalizeModuleFlags,
  resolveEffectiveModuleFlags,
} from '@devsuite/shared';

type DbCtx = QueryCtx | MutationCtx;

interface UserIdentity {
  subject: string;
}

export const moduleFlagsValidator = v.object({
  projects: v.optional(v.boolean()),
  sessions: v.optional(v.boolean()),
  performance: v.optional(v.boolean()),
  pr_reviews: v.optional(v.boolean()),
  invoicing: v.optional(v.boolean()),
});

export type CompanyModuleAccess = {
  userId: string;
  company: {
    _id: Id<'companies'>;
    userId: string;
    isDeleted: boolean;
    moduleFlags?: unknown;
  };
  userSettings: { moduleFlags?: unknown } | null;
  companyDefaults: ModuleFlags;
  userOverrides: ModuleFlagOverrides;
  effective: ModuleFlags;
};

async function getUserId(ctx: DbCtx) {
  const identity = (await ctx.auth.getUserIdentity()) as UserIdentity | null;
  if (!identity) {
    throw new Error('Unauthorized');
  }
  return identity.subject;
}

export function normalizeCompanyModuleFlags(value: unknown): ModuleFlags {
  return normalizeModuleFlags(value, DEFAULT_MODULE_FLAGS);
}

export function normalizeUserModuleFlagOverrides(
  value: unknown
): ModuleFlagOverrides {
  return normalizeModuleFlagOverrides(value);
}

export function computeEffectiveModuleFlags(
  companyDefaults: ModuleFlags,
  userOverrides: ModuleFlagOverrides
): ModuleFlags {
  return resolveEffectiveModuleFlags(companyDefaults, userOverrides);
}

export async function getCompanyModuleAccess(
  ctx: DbCtx,
  companyId: Id<'companies'>,
  explicitUserId?: string
): Promise<CompanyModuleAccess> {
  const userId = explicitUserId ?? (await getUserId(ctx));
  const company = await ctx.db.get(companyId);
  if (!company || company.userId !== userId || company.isDeleted) {
    throw new Error('Company not found or access denied');
  }

  const userSettings = await ctx.db
    .query('userSettings')
    .withIndex('by_companyId_userId', q =>
      q.eq('companyId', companyId).eq('userId', userId)
    )
    .filter(q => q.eq(q.field('deletedAt'), null))
    .first();

  const companyDefaults = normalizeCompanyModuleFlags(company.moduleFlags);
  const userOverrides = normalizeUserModuleFlagOverrides(
    userSettings?.moduleFlags
  );
  const effective = computeEffectiveModuleFlags(companyDefaults, userOverrides);

  return {
    userId,
    company,
    userSettings,
    companyDefaults,
    userOverrides,
    effective,
  };
}

export async function assertModuleEnabled(
  ctx: DbCtx,
  companyId: Id<'companies'>,
  module: AppModule,
  explicitUserId?: string
): Promise<CompanyModuleAccess> {
  const moduleAccess = await getCompanyModuleAccess(
    ctx,
    companyId,
    explicitUserId
  );
  if (!moduleAccess.effective[module]) {
    throw new Error(`MODULE_DISABLED:${module}`);
  }
  return moduleAccess;
}
