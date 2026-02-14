import { query } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import {
  computeEffectiveModuleFlags,
  normalizeCompanyModuleFlags,
  normalizeUserModuleFlagOverrides,
} from './lib/moduleAccess';

interface UserIdentity {
  subject: string;
}

async function getUserId(ctx: {
  auth: { getUserIdentity: () => Promise<UserIdentity | null> };
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Unauthorized');
  }
  return identity.subject;
}

export const bootstrap = query({
  args: {
    preferredCompanyId: v.optional(v.id('companies')),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const companies = await ctx.db
      .query('companies')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .filter(q => q.eq(q.field('isDeleted'), false))
      .collect();

    const normalizedCompanies = companies.map(company => {
      const moduleFlags = normalizeCompanyModuleFlags(company.moduleFlags);
      return { ...company, moduleFlags };
    });

    const currentCompany =
      normalizedCompanies.find(
        company => company._id === args.preferredCompanyId
      ) ??
      normalizedCompanies[0] ??
      null;

    if (!currentCompany) {
      return {
        companies: normalizedCompanies,
        currentCompany: null,
        userSettings: null,
        moduleAccess: null,
      };
    }

    const userSettings = await ctx.db
      .query('userSettings')
      .withIndex('by_companyId_userId', q =>
        q.eq('companyId', currentCompany._id).eq('userId', userId)
      )
      .filter(q => q.eq(q.field('deletedAt'), null))
      .first();

    const userOverrides = normalizeUserModuleFlagOverrides(
      userSettings?.moduleFlags
    );
    const effective = computeEffectiveModuleFlags(
      currentCompany.moduleFlags,
      userOverrides
    );

    return {
      companies: normalizedCompanies,
      currentCompany,
      userSettings: userSettings
        ? {
            ...userSettings,
            moduleFlags: userOverrides,
          }
        : null,
      moduleAccess: {
        companyDefaults: currentCompany.moduleFlags,
        userOverrides,
        effective,
      },
    };
  },
});

export const getModuleAccess = query({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const company = await ctx.db.get(args.companyId);
    if (!company || company.userId !== userId || company.isDeleted) {
      throw new Error('Company not found or access denied');
    }

    const userSettings = await ctx.db
      .query('userSettings')
      .withIndex('by_companyId_userId', q =>
        q.eq('companyId', args.companyId).eq('userId', userId)
      )
      .filter(q => q.eq(q.field('deletedAt'), null))
      .first();

    const companyDefaults = normalizeCompanyModuleFlags(company.moduleFlags);
    const userOverrides = normalizeUserModuleFlagOverrides(
      userSettings?.moduleFlags
    );
    const effective = computeEffectiveModuleFlags(
      companyDefaults,
      userOverrides
    );

    return {
      companyId: args.companyId as Id<'companies'>,
      companyDefaults,
      userOverrides,
      effective,
    };
  },
});
