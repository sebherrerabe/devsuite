/**
 * External link management functions for DevSuite
 *
 * External links are normalized references to external systems (GitHub, Notion, etc.).
 * Title is user-provided in MVP (required field).
 */

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import {
  requireCompanyId,
  assertCompanyScoped,
  createSoftDeletePatch,
} from './lib/helpers';

// ============================================================================
// Query Functions
// ============================================================================

/**
 * List all active external links for a task.
 */
export const listExternalLinksByTask = query({
  args: {
    companyId: v.id('companies'),
    taskId: v.id('tasks'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);

    // Verify task belongs to company
    const task = await ctx.db.get(args.taskId);
    assertCompanyScoped(task, companyId, 'tasks');

    return await ctx.db
      .query('external_links')
      .withIndex('by_companyId_taskId_deletedAt', q =>
        q
          .eq('companyId', companyId)
          .eq('taskId', args.taskId)
          .eq('deletedAt', null)
      )
      .collect();
  },
});

/**
 * Get a single external link by ID.
 */
export const get = query({
  args: {
    companyId: v.id('companies'),
    linkId: v.id('external_links'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const link = await ctx.db.get(args.linkId);
    assertCompanyScoped(link, companyId, 'external_links');
    return link;
  },
});

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Add an external link to a task.
 */
export const addExternalLink = mutation({
  args: {
    companyId: v.id('companies'),
    taskId: v.id('tasks'),
    type: v.union(
      v.literal('github_pr'),
      v.literal('github_issue'),
      v.literal('notion'),
      v.literal('ticktick'),
      v.literal('url')
    ),
    url: v.string(),
    title: v.string(),
    identifier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);

    // Verify task belongs to company
    const task = await ctx.db.get(args.taskId);
    assertCompanyScoped(task, companyId, 'tasks');

    // Validate title is not empty
    const trimmedTitle = args.title.trim();
    if (trimmedTitle.length === 0) {
      throw new Error('External link title is required');
    }

    // Validate URL format
    const trimmedUrl = args.url.trim();
    if (
      !trimmedUrl.startsWith('http://') &&
      !trimmedUrl.startsWith('https://')
    ) {
      throw new Error('URL must start with http:// or https://');
    }

    const now = Date.now();
    const insertData: {
      companyId: Id<'companies'>;
      taskId: Id<'tasks'>;
      type: 'github_pr' | 'github_issue' | 'notion' | 'ticktick' | 'url';
      url: string;
      title: string;
      identifier?: string;
      metadata: null;
      createdAt: number;
      updatedAt: number;
      deletedAt: null;
    } = {
      companyId,
      taskId: args.taskId,
      type: args.type,
      url: trimmedUrl,
      title: trimmedTitle,
      metadata: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    if (args.identifier) {
      insertData.identifier = args.identifier.trim();
    }
    const linkId = await ctx.db.insert('external_links', insertData);

    return linkId;
  },
});

/**
 * Update an external link.
 */
export const updateExternalLink = mutation({
  args: {
    companyId: v.id('companies'),
    linkId: v.id('external_links'),
    title: v.optional(v.string()),
    url: v.optional(v.string()),
    identifier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const link = await ctx.db.get(args.linkId);
    assertCompanyScoped(link, companyId, 'external_links');

    const updates: {
      title?: string;
      url?: string;
      identifier?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) {
      const trimmedTitle = args.title.trim();
      if (trimmedTitle.length === 0) {
        throw new Error('External link title is required');
      }
      updates.title = trimmedTitle;
    }

    if (args.url !== undefined) {
      const trimmedUrl = args.url.trim();
      if (
        !trimmedUrl.startsWith('http://') &&
        !trimmedUrl.startsWith('https://')
      ) {
        throw new Error('URL must start with http:// or https://');
      }
      updates.url = trimmedUrl;
    }

    if (args.identifier !== undefined) {
      updates.identifier = args.identifier.trim();
    }

    await ctx.db.patch(args.linkId, updates);
    return args.linkId;
  },
});

/**
 * Remove (soft delete) an external link.
 */
export const removeExternalLink = mutation({
  args: {
    companyId: v.id('companies'),
    linkId: v.id('external_links'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const link = await ctx.db.get(args.linkId);
    assertCompanyScoped(link, companyId, 'external_links');

    const patch = createSoftDeletePatch();
    await ctx.db.patch(args.linkId, patch);

    return args.linkId;
  },
});
