/**
 * Project task list management for DevSuite
 *
 * Lists are project-scoped, company-scoped, and soft-deleted only.
 */

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import {
  assertCompanyScoped,
  createSoftDeletePatch,
  requireCompanyId,
} from './lib/helpers';

const DEFAULT_LIST_NAME = 'Inbox';

async function generateSortKey(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<'projects'>
): Promise<string> {
  const lists = await ctx.db
    .query('project_task_lists')
    .withIndex('by_projectId_deletedAt', q =>
      q.eq('projectId', projectId).eq('deletedAt', null)
    )
    .collect();

  if (lists.length === 0) {
    return Date.now().toString();
  }

  const last = lists.sort((a, b) => a.sortKey.localeCompare(b.sortKey)).pop();
  const lastKey = last?.sortKey ?? '0';
  const lastNum = parseFloat(lastKey) || 0;
  return (lastNum + 1).toString();
}

async function getDefaultList(
  ctx: QueryCtx | MutationCtx,
  companyId: Id<'companies'>,
  projectId: Id<'projects'>
) {
  const defaults = await ctx.db
    .query('project_task_lists')
    .withIndex('by_projectId_deletedAt', q =>
      q.eq('projectId', projectId).eq('deletedAt', null)
    )
    .filter(q => q.eq(q.field('isDefault'), true))
    .collect();

  const list = defaults[0] ?? null;
  if (list) {
    assertCompanyScoped(list, companyId, 'project_task_lists');
  }
  return list;
}

export async function ensureDefaultListId(
  ctx: MutationCtx,
  companyId: Id<'companies'>,
  projectId: Id<'projects'>
): Promise<Id<'project_task_lists'>> {
  const existing = await getDefaultList(ctx, companyId, projectId);
  if (existing) return existing._id;

  const sortKey = await generateSortKey(ctx, projectId);
  const now = Date.now();
  return await ctx.db.insert('project_task_lists', {
    companyId,
    projectId,
    name: DEFAULT_LIST_NAME,
    sortKey,
    isDefault: true,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

// ============================================================================
// Query Functions
// ============================================================================

export const listByProject = query({
  args: {
    companyId: v.id('companies'),
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);

    const project = await ctx.db.get(args.projectId);
    assertCompanyScoped(project, companyId, 'projects');

    const lists = await ctx.db
      .query('project_task_lists')
      .withIndex('by_projectId_deletedAt', q =>
        q.eq('projectId', args.projectId).eq('deletedAt', null)
      )
      .collect();

    return lists.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  },
});

export const listByCompany = query({
  args: {
    companyId: v.id('companies'),
    projectIds: v.optional(v.array(v.id('projects'))),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);

    let lists = await ctx.db
      .query('project_task_lists')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', companyId).eq('deletedAt', null)
      )
      .collect();

    if (args.projectIds) {
      if (args.projectIds.length === 0) {
        return [];
      }
      const projectIdSet = new Set(args.projectIds);
      lists = lists.filter(list => projectIdSet.has(list.projectId));
    }

    return lists.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  },
});

// ============================================================================
// Mutation Functions
// ============================================================================

export const createList = mutation({
  args: {
    companyId: v.id('companies'),
    projectId: v.id('projects'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);

    const project = await ctx.db.get(args.projectId);
    assertCompanyScoped(project, companyId, 'projects');

    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error('List name cannot be empty');
    }

    const existing = await ctx.db
      .query('project_task_lists')
      .withIndex('by_projectId_deletedAt', q =>
        q.eq('projectId', args.projectId).eq('deletedAt', null)
      )
      .collect();

    const normalized = trimmedName.toLowerCase();
    if (existing.some(list => list.name.trim().toLowerCase() === normalized)) {
      throw new Error(`List with name "${trimmedName}" already exists`);
    }

    const sortKey = await generateSortKey(ctx, args.projectId);
    const now = Date.now();
    return await ctx.db.insert('project_task_lists', {
      companyId,
      projectId: args.projectId,
      name: trimmedName,
      sortKey,
      isDefault: false,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  },
});

export const updateList = mutation({
  args: {
    companyId: v.id('companies'),
    listId: v.id('project_task_lists'),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const list = await ctx.db.get(args.listId);
    assertCompanyScoped(list, companyId, 'project_task_lists');

    const updates: {
      name?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (!trimmedName) {
        throw new Error('List name cannot be empty');
      }

      const existing = await ctx.db
        .query('project_task_lists')
        .withIndex('by_projectId_deletedAt', q =>
          q.eq('projectId', list.projectId).eq('deletedAt', null)
        )
        .collect();

      const normalized = trimmedName.toLowerCase();
      if (
        existing.some(
          candidate =>
            candidate._id !== args.listId &&
            candidate.name.trim().toLowerCase() === normalized
        )
      ) {
        throw new Error(`List with name "${trimmedName}" already exists`);
      }

      updates.name = trimmedName;
    }

    await ctx.db.patch(args.listId, updates);
    return args.listId;
  },
});

export const moveList = mutation({
  args: {
    companyId: v.id('companies'),
    listId: v.id('project_task_lists'),
    newSortKey: v.string(),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const list = await ctx.db.get(args.listId);
    assertCompanyScoped(list, companyId, 'project_task_lists');

    await ctx.db.patch(args.listId, {
      sortKey: args.newSortKey,
      updatedAt: Date.now(),
    });

    return args.listId;
  },
});

export const softDeleteList = mutation({
  args: {
    companyId: v.id('companies'),
    listId: v.id('project_task_lists'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const list = await ctx.db.get(args.listId);
    assertCompanyScoped(list, companyId, 'project_task_lists');

    if (list.isDefault) {
      throw new Error('Default list cannot be deleted');
    }

    const defaultListId = await ensureDefaultListId(
      ctx,
      companyId,
      list.projectId
    );

    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_companyId_projectId_listId_deletedAt', q =>
        q
          .eq('companyId', companyId)
          .eq('projectId', list.projectId)
          .eq('listId', list._id)
          .eq('deletedAt', null)
      )
      .collect();

    for (const task of tasks) {
      await ctx.db.patch(task._id, {
        listId: defaultListId,
        updatedAt: Date.now(),
      });
    }

    const patch = createSoftDeletePatch();
    await ctx.db.patch(args.listId, patch);

    return args.listId;
  },
});

// ============================================================================
// Backfill / Migration
// ============================================================================

export const backfillDefaultListsForCompany = mutation({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);

    const projects = await ctx.db
      .query('projects')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', companyId).eq('deletedAt', null)
      )
      .collect();

    let listsCreated = 0;
    let tasksUpdated = 0;

    for (const project of projects) {
      const existingDefault = await getDefaultList(ctx, companyId, project._id);
      const defaultListId =
        existingDefault?._id ??
        (await ensureDefaultListId(ctx, companyId, project._id));
      if (!existingDefault) {
        listsCreated++;
      }

      const tasks = await ctx.db
        .query('tasks')
        .withIndex('by_companyId_projectId_deletedAt', q =>
          q
            .eq('companyId', companyId)
            .eq('projectId', project._id)
            .eq('deletedAt', null)
        )
        .collect();

      for (const task of tasks) {
        if (!task.listId) {
          await ctx.db.patch(task._id, {
            listId: defaultListId,
            updatedAt: Date.now(),
          });
          tasksUpdated++;
        }
      }

      void defaultListId;
    }

    return { listsCreated, tasksUpdated };
  },
});
