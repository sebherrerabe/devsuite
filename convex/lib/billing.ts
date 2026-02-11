/**
 * Billing helpers for rate configuration.
 */

import type { Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

export type RateCardConfig = {
  hourlyRateCents: number;
  currency: string;
  roundingIncrementMinutes: number;
  roundingMode: 'floor' | 'ceil' | 'nearest';
};

const DEFAULT_RATE_CONFIG: RateCardConfig = {
  hourlyRateCents: 0,
  currency: 'USD',
  roundingIncrementMinutes: 60,
  roundingMode: 'floor',
};

export async function getDefaultRateCard(
  ctx: QueryCtx,
  companyId: Id<'companies'>
) {
  return await ctx.db
    .query('rateCards')
    .withIndex('by_companyId_isDefault', q =>
      q.eq('companyId', companyId).eq('isDefault', true)
    )
    .filter(q => q.eq(q.field('deletedAt'), null))
    .first();
}

export async function ensureDefaultRateCardId(
  ctx: MutationCtx,
  companyId: Id<'companies'>,
  overrides?: Partial<RateCardConfig>
): Promise<Id<'rateCards'>> {
  const existing = await ctx.db
    .query('rateCards')
    .withIndex('by_companyId_isDefault', q =>
      q.eq('companyId', companyId).eq('isDefault', true)
    )
    .filter(q => q.eq(q.field('deletedAt'), null))
    .first();

  if (existing) {
    return existing._id;
  }

  const now = Date.now();
  const config = { ...DEFAULT_RATE_CONFIG, ...(overrides ?? {}) };

  return await ctx.db.insert('rateCards', {
    companyId,
    name: 'Default Rate',
    hourlyRateCents: config.hourlyRateCents,
    currency: config.currency,
    roundingIncrementMinutes: config.roundingIncrementMinutes,
    roundingMode: config.roundingMode,
    description: 'Default billing rate',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}
