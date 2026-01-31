/**
 * Tag management functions for DevSuite
 *
 * Tags are company-scoped managed entities that tasks reference.
 * This enables consistent naming and future renames without rewriting task data.
 */

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import {
  requireCompanyId,
  assertCompanyScoped,
  createSoftDeletePatch,
} from './lib/helpers';

// ============================================================================
// Query Functions
// ============================================================================

/**
 * List all active tags for a company.
 */
export const listTagsByCompany = query({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);

    return await ctx.db
      .query('tags')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', companyId).eq('deletedAt', null)
      )
      .collect();
  },
});

/**
 * Get a single tag by ID.
 */
export const get = query({
  args: {
    companyId: v.id('companies'),
    tagId: v.id('tags'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const tag = await ctx.db.get(args.tagId);
    assertCompanyScoped(tag, companyId, 'tags');
    return tag;
  },
});

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Create a new tag.
 */
export const createTag = mutation({
  args: {
    companyId: v.id('companies'),
    name: v.string(),
    color: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);

    // Validate name is not empty
    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new Error('Tag name cannot be empty');
    }

    // Check for duplicate name within company (case-sensitive for MVP)
    // Note: Convex doesn't support case-insensitive queries natively.
    // For MVP, we do case-sensitive matching. Can be enhanced later with normalized name field.
    const existing = await ctx.db
      .query('tags')
      .withIndex('by_companyId_name_deletedAt', q =>
        q
          .eq('companyId', companyId)
          .eq('name', trimmedName)
          .eq('deletedAt', null)
      )
      .first();

    if (existing) {
      throw new Error(`Tag with name "${trimmedName}" already exists`);
    }

    const now = Date.now();
    const tagId = await ctx.db.insert('tags', {
      companyId,
      name: trimmedName,
      color: args.color,
      metadata: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    return tagId;
  },
});

/**
 * Update a tag.
 */
export const updateTag = mutation({
  args: {
    companyId: v.id('companies'),
    tagId: v.id('tags'),
    name: v.optional(v.string()),
    color: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const tag = await ctx.db.get(args.tagId);
    assertCompanyScoped(tag, companyId, 'tags');

    const updates: {
      name?: string;
      color?: string | null;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (trimmedName.length === 0) {
        throw new Error('Tag name cannot be empty');
      }

      // Check for duplicate name (excluding this tag, case-sensitive for MVP)
      const existing = await ctx.db
        .query('tags')
        .withIndex('by_companyId_name_deletedAt', q =>
          q
            .eq('companyId', companyId)
            .eq('name', trimmedName)
            .eq('deletedAt', null)
        )
        .filter(q => q.neq(q.field('_id'), args.tagId))
        .first();

      if (existing) {
        throw new Error(`Tag with name "${trimmedName}" already exists`);
      }

      updates.name = trimmedName;
    }

    if (args.color !== undefined) {
      updates.color = args.color;
    }

    await ctx.db.patch(args.tagId, updates);
    return args.tagId;
  },
});

/**
 * Soft delete a tag.
 */
export const softDeleteTag = mutation({
  args: {
    companyId: v.id('companies'),
    tagId: v.id('tags'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const tag = await ctx.db.get(args.tagId);
    assertCompanyScoped(tag, companyId, 'tags');

    // Note: We don't check if tasks are using this tag.
    // Tasks can reference deleted tags (they just won't show up in tag lists).
    // This allows for "archive tag but keep historical references" pattern.

    const patch = createSoftDeletePatch();
    await ctx.db.patch(args.tagId, patch);

    return args.tagId;
  },
});
