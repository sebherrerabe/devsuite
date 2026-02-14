/**
 * PR Review management functions for DevSuite
 *
 * Enforces invariants:
 * - Company scoping: all reviews belong to a company
 * - Repository scoping: review repository must belong to the same company
 * - No hard deletes (soft delete only)
 */

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import {
  assertCompanyScoped,
  createSoftDeletePatch,
  requireCompanyId,
} from './lib/helpers';
import { insertPerformanceSignal } from './lib/performanceSignalIngestion';
import { assertModuleEnabled } from './lib/moduleAccess';

// ============================================================================
// Query Functions
// ============================================================================

/**
 * List PR reviews for a company (optionally filtered by repository/date range).
 */
export const listPRReviews = query({
  args: {
    companyId: v.id('companies'),
    repositoryId: v.optional(v.id('repositories')),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    await assertModuleEnabled(ctx, companyId, 'pr_reviews');

    if (args.repositoryId) {
      const repo = await ctx.db.get(args.repositoryId);
      assertCompanyScoped(repo, companyId, 'repositories');
    }

    const reviews = args.repositoryId
      ? await ctx.db
          .query('prReviews')
          .withIndex('by_repositoryId_deletedAt_createdAt', q =>
            q.eq('repositoryId', args.repositoryId!).eq('deletedAt', null)
          )
          .order('desc')
          .collect()
      : await ctx.db
          .query('prReviews')
          .withIndex('by_companyId_deletedAt_createdAt', q =>
            q.eq('companyId', companyId).eq('deletedAt', null)
          )
          .order('desc')
          .collect();

    const filteredByCompany = args.repositoryId
      ? reviews.filter(review => review.companyId === companyId)
      : reviews;

    const filteredByDate =
      args.startDate || args.endDate
        ? filteredByCompany.filter(review => {
            if (args.startDate && review.createdAt < args.startDate) {
              return false;
            }
            if (args.endDate && review.createdAt > args.endDate) {
              return false;
            }
            return true;
          })
        : filteredByCompany;

    return filteredByDate;
  },
});

/**
 * Get a single PR review (company-scoped).
 */
export const getPRReview = query({
  args: {
    companyId: v.id('companies'),
    reviewId: v.id('prReviews'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    await assertModuleEnabled(ctx, companyId, 'pr_reviews');
    const review = await ctx.db.get(args.reviewId);
    assertCompanyScoped(review, companyId, 'prReviews');
    return review;
  },
});

/**
 * List PR reviews associated with a task.
 */
export const listPRReviewsByTask = query({
  args: {
    companyId: v.id('companies'),
    taskId: v.id('tasks'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    await assertModuleEnabled(ctx, companyId, 'pr_reviews');

    const task = await ctx.db.get(args.taskId);
    assertCompanyScoped(task, companyId, 'tasks');

    return await ctx.db
      .query('prReviews')
      .withIndex('by_taskId_deletedAt_createdAt', q =>
        q.eq('taskId', args.taskId).eq('deletedAt', null)
      )
      .order('desc')
      .collect();
  },
});

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Create a new PR review (metadata only; content optional).
 */
export const createPRReview = mutation({
  args: {
    companyId: v.id('companies'),
    repositoryId: v.id('repositories'),
    taskId: v.optional(v.union(v.id('tasks'), v.null())),
    prUrl: v.string(),
    baseBranch: v.string(),
    headBranch: v.string(),
    title: v.optional(v.string()),
    contentMarkdown: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    await assertModuleEnabled(ctx, companyId, 'pr_reviews');
    const repository = await ctx.db.get(args.repositoryId);
    assertCompanyScoped(repository, companyId, 'repositories');

    if (args.taskId) {
      const task = await ctx.db.get(args.taskId);
      assertCompanyScoped(task, companyId, 'tasks');
    }

    const now = Date.now();
    const trimmedTitle = args.title?.trim();
    const reviewDoc: {
      companyId: Id<'companies'>;
      repositoryId: Id<'repositories'>;
      taskId: Id<'tasks'> | null;
      prUrl: string;
      baseBranch: string;
      headBranch: string;
      contentMarkdown: string;
      title?: string;
      createdAt: number;
      updatedAt: number;
      deletedAt: null;
    } = {
      companyId,
      repositoryId: args.repositoryId,
      taskId: args.taskId ?? null,
      prUrl: args.prUrl.trim(),
      baseBranch: args.baseBranch.trim(),
      headBranch: args.headBranch.trim(),
      contentMarkdown: args.contentMarkdown ?? '',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    if (trimmedTitle) {
      reviewDoc.title = trimmedTitle;
    }

    const reviewId = await ctx.db.insert('prReviews', reviewDoc);

    if (args.taskId) {
      await insertPerformanceSignal(ctx, {
        companyId,
        type: 'pr_reviews_completed',
        value: 1,
        entityType: 'task',
        entityId: args.taskId,
        timestamp: now,
      });
    }

    return reviewId;
  },
});

/**
 * Update an existing PR review (metadata and/or content).
 */
export const updatePRReview = mutation({
  args: {
    companyId: v.id('companies'),
    reviewId: v.id('prReviews'),
    repositoryId: v.optional(v.id('repositories')),
    taskId: v.optional(v.union(v.id('tasks'), v.null())),
    prUrl: v.optional(v.string()),
    baseBranch: v.optional(v.string()),
    headBranch: v.optional(v.string()),
    title: v.optional(v.string()),
    contentMarkdown: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    await assertModuleEnabled(ctx, companyId, 'pr_reviews');
    const review = await ctx.db.get(args.reviewId);
    assertCompanyScoped(review, companyId, 'prReviews');

    if (args.repositoryId) {
      const repository = await ctx.db.get(args.repositoryId);
      assertCompanyScoped(repository, companyId, 'repositories');
    }

    if (args.taskId) {
      const task = await ctx.db.get(args.taskId);
      assertCompanyScoped(task, companyId, 'tasks');
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.repositoryId !== undefined) {
      updates.repositoryId = args.repositoryId;
    }
    if (args.taskId !== undefined) {
      updates.taskId = args.taskId;
    }
    if (args.prUrl !== undefined) {
      updates.prUrl = args.prUrl.trim();
    }
    if (args.baseBranch !== undefined) {
      updates.baseBranch = args.baseBranch.trim();
    }
    if (args.headBranch !== undefined) {
      updates.headBranch = args.headBranch.trim();
    }
    if (args.title !== undefined) {
      updates.title = args.title.trim();
    }
    if (args.contentMarkdown !== undefined) {
      updates.contentMarkdown = args.contentMarkdown;
    }
    await ctx.db.patch(args.reviewId, updates);
    return args.reviewId;
  },
});

/**
 * Soft delete a PR review (no hard deletes).
 */
export const softDeletePRReview = mutation({
  args: {
    companyId: v.id('companies'),
    reviewId: v.id('prReviews'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    await assertModuleEnabled(ctx, companyId, 'pr_reviews');
    const review = await ctx.db.get(args.reviewId);
    assertCompanyScoped(review, companyId, 'prReviews');

    await ctx.db.patch(args.reviewId, createSoftDeletePatch());
    return args.reviewId;
  },
});
