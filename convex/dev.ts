/**
 * Development utilities for DevSuite Convex backend
 *
 * These utilities are ONLY available in development environments.
 * They provide seed data and reset functionality for testing.
 *
 * IMPORTANT: These functions use soft delete only - no hard deletes.
 */

import { mutation } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { createSoftDeletePatch } from './lib/helpers';
import { ensureDefaultListId } from './projectTaskLists';
import { ensureDefaultProjectId } from './projects';

// ============================================================================
// Dev Environment Guard
// ============================================================================

/**
 * Check if dev utilities are enabled.
 *
 * Dev utilities are enabled when:
 * - `DEV_ALLOW_SEED` environment variable is set to 'true' in Convex Cloud
 * - OR we're in a development deployment (not production)
 *
 * @returns true if dev utilities should be available
 */
function isDevModeEnabled(): boolean {
  // Check Convex environment variable
  const devAllowSeed = process.env.DEV_ALLOW_SEED;
  if (devAllowSeed === 'true') {
    return true;
  }

  // In production, always disable
  // In development deployments, allow (Convex Cloud dev deployments are safe)
  // This is a safety measure - prefer explicit DEV_ALLOW_SEED=true for clarity
  return false;
}

/**
 * Assert that dev mode is enabled, throw if not.
 */
function assertDevMode(): void {
  if (!isDevModeEnabled()) {
    throw new Error(
      'Dev utilities are disabled. Set DEV_ALLOW_SEED=true in Convex Cloud environment variables to enable.'
    );
  }
}

// ============================================================================
// Seed Data
// ============================================================================

/**
 * Seed minimal demo data for a company.
 *
 * Creates:
 * - A default rate card
 * - A sample project
 * - A sample repository
 *
 * This is a minimal seed - feature modules can extend with more data.
 */
export const seed = mutation({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    assertDevMode();

    const companyId = args.companyId;
    const now = Date.now();

    // Verify company exists and is not deleted
    const company = await ctx.db.get(companyId);
    if (!company || company.deletedAt !== null) {
      throw new Error('Company not found or deleted');
    }

    const results: {
      rateCardId?: Id<'rateCards'>;
      repositoryId?: Id<'repositories'>;
      projectId?: Id<'projects'>;
    } = {};

    const defaultProjectId = await ensureDefaultProjectId(ctx, companyId);
    await ensureDefaultListId(ctx, companyId, defaultProjectId);

    // Create a default rate card
    const rateCardId = await ctx.db.insert('rateCards', {
      companyId,
      name: 'Default Rate',
      hourlyRateCents: 10000, // $100/hour
      currency: 'USD',
      description: 'Default rate card for demo',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    results.rateCardId = rateCardId;

    // Create a sample repository
    const repositoryId = await ctx.db.insert('repositories', {
      companyId,
      name: 'demo-repo',
      url: 'https://github.com/example/demo-repo',
      provider: 'github',
      metadata: {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    results.repositoryId = repositoryId;

    // Create a sample project
    const projectId = await ctx.db.insert('projects', {
      companyId,
      name: 'Demo Project',
      description: 'A sample project for development',
      repositoryIds: [repositoryId],
      slug: 'demo-project',
      isDefault: false,
      notesMarkdown: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    results.projectId = projectId;

    await ensureDefaultListId(ctx, companyId, projectId);

    return {
      success: true,
      seeded: results,
    };
  },
});

// ============================================================================
// Reset Data (Soft Delete All)
// ============================================================================

/**
 * Reset all domain data for a company by soft-deleting everything.
 *
 * This function:
 * - Soft-deletes all company-scoped entities (repositories, projects, tasks, etc.)
 * - Does NOT hard delete anything (enforces DevSuite invariant)
 * - Does NOT delete the company itself
 *
 * Use this to reset a dev environment while preserving audit trails.
 */
export const resetCompanyData = mutation({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    assertDevMode();

    const companyId = args.companyId;
    const now = Date.now();
    const deletePatch = createSoftDeletePatch(now);

    const results: {
      repositories: number;
      projects: number;
      tasks: number;
      sessions: number;
      inboxItems: number;
      prReviews: number;
      performanceSignals: number;
      invoices: number;
      rateCards: number;
    } = {
      repositories: 0,
      projects: 0,
      tasks: 0,
      sessions: 0,
      inboxItems: 0,
      prReviews: 0,
      performanceSignals: 0,
      invoices: 0,
      rateCards: 0,
    };

    // Soft delete all repositories
    const repositories = await ctx.db
      .query('repositories')
      .withIndex('by_companyId', q => q.eq('companyId', companyId))
      .filter(q => q.eq(q.field('deletedAt'), null))
      .collect();
    for (const repo of repositories) {
      await ctx.db.patch(repo._id, deletePatch);
      results.repositories++;
    }

    // Soft delete all non-default projects
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_companyId', q => q.eq('companyId', companyId))
      .filter(q => q.eq(q.field('deletedAt'), null))
      .collect();
    for (const project of projects) {
      if (project.isDefault) {
        continue;
      }
      await ctx.db.patch(project._id, deletePatch);
      results.projects++;
    }

    // Soft delete all tasks (via projectId, need to get projects first)
    // Note: Tasks are scoped via project, so we need to get all project IDs first
    const allProjects = await ctx.db
      .query('projects')
      .withIndex('by_companyId', q => q.eq('companyId', companyId))
      .collect();
    const projectIds = allProjects.map(p => p._id);

    for (const projectId of projectIds) {
      const tasks = await ctx.db
        .query('tasks')
        .withIndex('by_projectId', q => q.eq('projectId', projectId))
        .filter(q => q.eq(q.field('deletedAt'), null))
        .collect();
      for (const task of tasks) {
        await ctx.db.patch(task._id, deletePatch);
        results.tasks++;
      }
    }

    // Soft delete all sessions
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_companyId', q => q.eq('companyId', companyId))
      .filter(q => q.eq(q.field('deletedAt'), null))
      .collect();
    for (const session of sessions) {
      await ctx.db.patch(session._id, deletePatch);
      results.sessions++;
    }

    // Soft delete all inboxItems
    const inboxItems = await ctx.db
      .query('inboxItems')
      .withIndex('by_companyId', q => q.eq('companyId', companyId))
      .filter(q => q.eq(q.field('deletedAt'), null))
      .collect();
    for (const item of inboxItems) {
      await ctx.db.patch(item._id, deletePatch);
      results.inboxItems++;
    }

    // Soft delete all prReviews
    const prReviews = await ctx.db
      .query('prReviews')
      .withIndex('by_companyId', q => q.eq('companyId', companyId))
      .filter(q => q.eq(q.field('deletedAt'), null))
      .collect();
    for (const review of prReviews) {
      await ctx.db.patch(review._id, deletePatch);
      results.prReviews++;
    }

    // Soft delete all performanceSignals
    const performanceSignals = await ctx.db
      .query('performanceSignals')
      .withIndex('by_companyId', q => q.eq('companyId', companyId))
      .filter(q => q.eq(q.field('deletedAt'), null))
      .collect();
    for (const signal of performanceSignals) {
      await ctx.db.patch(signal._id, deletePatch);
      results.performanceSignals++;
    }

    // Soft delete all invoices
    const invoices = await ctx.db
      .query('invoices')
      .withIndex('by_companyId', q => q.eq('companyId', companyId))
      .filter(q => q.eq(q.field('deletedAt'), null))
      .collect();
    for (const invoice of invoices) {
      await ctx.db.patch(invoice._id, deletePatch);
      results.invoices++;
    }

    // Soft delete all rateCards
    const rateCards = await ctx.db
      .query('rateCards')
      .withIndex('by_companyId', q => q.eq('companyId', companyId))
      .filter(q => q.eq(q.field('deletedAt'), null))
      .collect();
    for (const rateCard of rateCards) {
      await ctx.db.patch(rateCard._id, deletePatch);
      results.rateCards++;
    }

    return {
      success: true,
      deleted: results,
    };
  },
});
