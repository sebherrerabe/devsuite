/**
 * Task management functions for DevSuite
 *
 * Enforces invariants:
 * - Company scoping: all tasks belong to a company
 * - Tasks are always project-scoped
 * - Parent/child relationships maintain same project and list scope
 * - No cross-project moves
 * - Max depth = 3
 * - Prevent cycles
 * - Subtree soft delete
 */

import { mutation, query } from './_generated/server';
import type { QueryCtx, MutationCtx } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import {
  requireCompanyId,
  assertCompanyScoped,
  createSoftDeletePatch,
  createRestorePatch,
} from './lib/helpers';
import { ensureDefaultListId } from './projectTaskLists';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a sortKey for a new task.
 * For MVP, uses timestamp-based approach. Can be upgraded to LexoRank later.
 *
 * @param ctx - Database context
 * @param parentTaskId - Parent task ID (null for top-level)
 * @param companyId - Company ID
 * @param projectId - Project ID
 * @returns Sort key string
 */
async function generateSortKey(
  ctx: QueryCtx | MutationCtx,
  parentTaskId: Id<'tasks'> | null,
  companyId: Id<'companies'>,
  projectId: Id<'projects'>,
  listId: Id<'project_task_lists'>
): Promise<string> {
  // Find siblings (tasks with same parent and project/company scope)
  const siblings = await ctx.db
    .query('tasks')
    .withIndex(
      'by_companyId_projectId_listId_parentTaskId_deletedAt',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q: any) =>
        q
          .eq('companyId', companyId)
          .eq('projectId', projectId)
          .eq('listId', listId)
          .eq('parentTaskId', parentTaskId)
          .eq('deletedAt', null)
    )
    .order('desc')
    .first();

  if (!siblings) {
    // First sibling: use timestamp as base
    return Date.now().toString();
  }

  // Generate a key after the last sibling
  // Simple approach: append a small increment
  const lastKey = siblings.sortKey;
  const lastNum = parseFloat(lastKey) || 0;
  return (lastNum + 1).toString();
}

/**
 * Calculate the depth of a task in the hierarchy.
 *
 * @param ctx - Database context
 * @param taskId - Task ID
 * @returns Depth (0 = top-level, 1 = child of top-level, etc.)
 */
async function calculateDepth(
  ctx: QueryCtx | MutationCtx,
  taskId: Id<'tasks'>
): Promise<number> {
  const task = await ctx.db.get(taskId);
  if (!task || !task.parentTaskId) {
    return 0;
  }
  return 1 + (await calculateDepth(ctx, task.parentTaskId));
}

/**
 * Check if moving a task to a new parent would create a cycle.
 *
 * @param ctx - Database context
 * @param taskId - Task to move
 * @param newParentId - Proposed new parent ID (null for top-level)
 * @returns true if cycle would be created
 */
async function wouldCreateCycle(
  ctx: QueryCtx | MutationCtx,
  taskId: Id<'tasks'>,
  newParentId: Id<'tasks'> | null
): Promise<boolean> {
  if (newParentId === null) {
    return false; // Moving to top-level never creates a cycle
  }

  // Check if newParentId is taskId or any descendant of taskId
  let current: Id<'tasks'> | null = newParentId;
  const visited = new Set<Id<'tasks'>>();

  while (current !== null) {
    if (current === taskId) {
      return true; // Cycle detected
    }
    if (visited.has(current)) {
      // Safety check: prevent infinite loops
      return true;
    }
    visited.add(current);

    const parent: { parentTaskId: Id<'tasks'> | null } | null =
      await ctx.db.get(current);
    current = parent?.parentTaskId ?? null;
  }

  return false;
}

/**
 * Get all descendant task IDs (recursive).
 * Includes deleted tasks when includeDeleted is true (for restore operations).
 *
 * @param ctx - Database context
 * @param taskId - Root task ID
 * @param includeDeleted - Whether to include deleted tasks
 * @returns Array of descendant task IDs (including self)
 */
async function getDescendantIds(
  ctx: QueryCtx | MutationCtx,
  taskId: Id<'tasks'>,
  includeDeleted: boolean = false
): Promise<Id<'tasks'>[]> {
  const descendants: Id<'tasks'>[] = [taskId];
  let children = ctx.db
    .query('tasks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex('by_parentTaskId', (q: any) => q.eq('parentTaskId', taskId));

  if (!includeDeleted) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    children = children.filter((q: any) => q.eq(q.field('deletedAt'), null));
  }

  const childrenList = await children.collect();

  for (const child of childrenList) {
    const childDescendants = await getDescendantIds(
      ctx,
      child._id,
      includeDeleted
    );
    descendants.push(...childDescendants);
  }

  return descendants;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all tasks for a project (flat list, client builds tree).
 */
export const getProjectTasks = query({
  args: {
    companyId: v.id('companies'),
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);

    // Verify project belongs to company
    const project = await ctx.db.get(args.projectId);
    assertCompanyScoped(project, companyId, 'projects');

    return await ctx.db
      .query('tasks')
      .withIndex('by_companyId_projectId_deletedAt', q =>
        q
          .eq('companyId', companyId)
          .eq('projectId', args.projectId)
          .eq('deletedAt', null)
      )
      .collect();
  },
});

/**
 * Get all tasks for a company (flat list, client builds tree).
 */
export const getCompanyTasks = query({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);

    return await ctx.db
      .query('tasks')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', companyId).eq('deletedAt', null)
      )
      .collect();
  },
});

/**
 * List all tasks for a company (including project tasks).
 * Useful for global search.
 */
export const listAllTasks = query({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);

    return await ctx.db
      .query('tasks')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', companyId).eq('deletedAt', null)
      )
      .collect();
  },
});

/**
 * Get a single task by ID.
 */
export const get = query({
  args: {
    companyId: v.id('companies'),
    taskId: v.id('tasks'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const task = await ctx.db.get(args.taskId);
    assertCompanyScoped(task, companyId, 'tasks');
    return task;
  },
});

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Create a new task.
 */
export const createTask = mutation({
  args: {
    companyId: v.id('companies'),
    projectId: v.id('projects'),
    parentTaskId: v.union(v.id('tasks'), v.null()),
    listId: v.optional(v.id('project_task_lists')),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal('todo'),
        v.literal('in_progress'),
        v.literal('blocked'),
        v.literal('done'),
        v.literal('cancelled')
      )
    ),
    dueDate: v.union(v.number(), v.null()),
    complexityScore: v.union(v.number(), v.null()),
    notesMarkdown: v.union(v.string(), v.null()),
    tagIds: v.optional(v.array(v.id('tags'))),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const listIdInput = args.listId ?? null;
    let resolvedListId: Id<'project_task_lists'> | null = null;

    // Validate project
    const project = await ctx.db.get(args.projectId);
    assertCompanyScoped(project, companyId, 'projects');

    // Validate parent if provided
    if (args.parentTaskId !== null) {
      const parent = await ctx.db.get(args.parentTaskId);
      assertCompanyScoped(parent, companyId, 'tasks');

      // Validate scope match: parent and new task must have same projectId
      if (parent.projectId !== args.projectId) {
        throw new Error(
          'Parent and child tasks must have matching project scope'
        );
      }

      const parentListId = parent.listId ?? null;
      if (!parentListId) {
        const defaultListId = await ensureDefaultListId(
          ctx,
          companyId,
          parent.projectId
        );
        await ctx.db.patch(parent._id, {
          listId: defaultListId,
          updatedAt: Date.now(),
        });
        resolvedListId = defaultListId;
      } else {
        resolvedListId = parentListId;
      }

      if (listIdInput && resolvedListId && listIdInput !== resolvedListId) {
        throw new Error('Child tasks must inherit the parent list');
      }

      // Check depth
      const parentDepth = await calculateDepth(ctx, args.parentTaskId);
      if (parentDepth >= 2) {
        throw new Error('Maximum depth (3) reached. Cannot create child task.');
      }
    }

    if (args.parentTaskId === null) {
      if (listIdInput) {
        const list = await ctx.db.get(listIdInput);
        assertCompanyScoped(list, companyId, 'project_task_lists');
        if (list.projectId !== args.projectId) {
          throw new Error('List does not belong to the specified project');
        }
        if (list.deletedAt !== null) {
          throw new Error('List is deleted');
        }
        resolvedListId = listIdInput;
      } else {
        resolvedListId = await ensureDefaultListId(
          ctx,
          companyId,
          args.projectId
        );
      }
    }

    if (!resolvedListId) {
      throw new Error('Task list could not be resolved');
    }

    // Validate complexityScore range
    if (
      args.complexityScore !== null &&
      (args.complexityScore < 1 || args.complexityScore > 10)
    ) {
      throw new Error('complexityScore must be between 1 and 10');
    }

    // Generate sortKey
    const sortKey = await generateSortKey(
      ctx,
      args.parentTaskId,
      companyId,
      args.projectId,
      resolvedListId
    );

    const now = Date.now();
    const insertData: {
      companyId: Id<'companies'>;
      projectId: Id<'projects'>;
      listId: Id<'project_task_lists'>;
      parentTaskId: Id<'tasks'> | null;
      title: string;
      description?: string;
      status: 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
      sortKey: string;
      dueDate: number | null;
      complexityScore: number | null;
      notesMarkdown: string | null;
      tagIds: Id<'tags'>[];
      metadata: Record<string, never>;
      createdAt: number;
      updatedAt: number;
      deletedAt: null;
    } = {
      companyId,
      projectId: args.projectId,
      listId: resolvedListId,
      parentTaskId: args.parentTaskId,
      title: args.title.trim(),
      status: args.status ?? 'todo',
      sortKey,
      dueDate: args.dueDate,
      complexityScore: args.complexityScore,
      notesMarkdown: args.notesMarkdown,
      tagIds: args.tagIds ?? [],
      metadata: {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    if (args.description) {
      insertData.description = args.description.trim();
    }
    const taskId = await ctx.db.insert('tasks', insertData);

    return taskId;
  },
});

/**
 * Update a task.
 */
export const updateTask = mutation({
  args: {
    companyId: v.id('companies'),
    taskId: v.id('tasks'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal('todo'),
        v.literal('in_progress'),
        v.literal('blocked'),
        v.literal('done'),
        v.literal('cancelled')
      )
    ),
    dueDate: v.optional(v.union(v.number(), v.null())),
    complexityScore: v.optional(v.union(v.number(), v.null())),
    notesMarkdown: v.optional(v.union(v.string(), v.null())),
    tagIds: v.optional(v.array(v.id('tags'))),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const task = await ctx.db.get(args.taskId);
    assertCompanyScoped(task, companyId, 'tasks');

    // Validate complexityScore range if provided
    if (
      args.complexityScore !== undefined &&
      args.complexityScore !== null &&
      (args.complexityScore < 1 || args.complexityScore > 10)
    ) {
      throw new Error('complexityScore must be between 1 and 10');
    }

    const updates: {
      title?: string;
      description?: string;
      status?: 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
      dueDate?: number | null;
      complexityScore?: number | null;
      notesMarkdown?: string | null;
      tagIds?: Id<'tags'>[];
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) {
      updates.title = args.title.trim();
    }
    if (args.description !== undefined) {
      updates.description = args.description?.trim();
    }
    if (args.status !== undefined) {
      updates.status = args.status;
    }
    if (args.dueDate !== undefined) {
      updates.dueDate = args.dueDate;
    }
    if (args.complexityScore !== undefined) {
      updates.complexityScore = args.complexityScore;
    }
    if (args.notesMarkdown !== undefined) {
      updates.notesMarkdown = args.notesMarkdown;
    }
    if (args.tagIds !== undefined) {
      updates.tagIds = args.tagIds;
    }

    await ctx.db.patch(args.taskId, updates);
    return args.taskId;
  },
});

/**
 * Move/reparent/reorder a task.
 * Handles reparenting, reordering within siblings, and prevents invalid moves.
 */
export const moveTask = mutation({
  args: {
    companyId: v.id('companies'),
    taskId: v.id('tasks'),
    newParentId: v.union(v.id('tasks'), v.null()),
    newListId: v.optional(v.id('project_task_lists')),
    newSortKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const task = await ctx.db.get(args.taskId);
    assertCompanyScoped(task, companyId, 'tasks');

    const listIdInput = args.newListId ?? null;
    let resolvedListId = task.listId ?? null;

    if (
      listIdInput &&
      task.listId &&
      listIdInput !== task.listId &&
      args.newParentId !== null
    ) {
      throw new Error('Tasks moved across lists must be unlinked from parent');
    }

    if (listIdInput) {
      const list = await ctx.db.get(listIdInput);
      assertCompanyScoped(list, companyId, 'project_task_lists');
      if (list.projectId !== task.projectId) {
        throw new Error('List does not belong to the specified project');
      }
      if (list.deletedAt !== null) {
        throw new Error('List is deleted');
      }
      resolvedListId = listIdInput;
    }

    // If newParentId is provided, validate it
    if (args.newParentId !== null) {
      const newParent = await ctx.db.get(args.newParentId);
      assertCompanyScoped(newParent, companyId, 'tasks');

      // Prevent cross-project moves
      if (task.projectId !== newParent.projectId) {
        throw new Error('Cannot move task across projects');
      }

      // Check for cycles
      if (await wouldCreateCycle(ctx, args.taskId, args.newParentId)) {
        throw new Error('Cannot move task: would create a cycle');
      }

      // Check depth
      const newParentDepth = await calculateDepth(ctx, args.newParentId);
      if (newParentDepth >= 2) {
        throw new Error('Maximum depth (3) reached. Cannot move task here.');
      }

      const parentListId = newParent.listId ?? null;
      if (!parentListId) {
        if (!newParent.projectId) {
          throw new Error('Parent task is missing project');
        }
        const defaultListId = await ensureDefaultListId(
          ctx,
          companyId,
          newParent.projectId
        );
        await ctx.db.patch(newParent._id, {
          listId: defaultListId,
          updatedAt: Date.now(),
        });
        resolvedListId = defaultListId;
      } else if (parentListId) {
        if (listIdInput && parentListId !== listIdInput) {
          throw new Error('Child tasks must inherit the parent list');
        }
        resolvedListId = parentListId;
      }
    } else {
      // Moving to top-level: validate scope match (task's projectId stays same)
      // This is already enforced by the fact that we're not changing projectId
    }

    if (!resolvedListId) {
      if (!task.projectId) {
        throw new Error('Task is missing project');
      }
      resolvedListId = await ensureDefaultListId(
        ctx,
        companyId,
        task.projectId
      );
    }

    // Generate sortKey if not provided
    let sortKey = args.newSortKey;
    if (!sortKey) {
      if (!task.projectId) {
        throw new Error('Task is missing project');
      }
      sortKey = await generateSortKey(
        ctx,
        args.newParentId,
        companyId,
        task.projectId,
        resolvedListId
      );
    }

    await ctx.db.patch(args.taskId, {
      parentTaskId: args.newParentId,
      listId: resolvedListId,
      sortKey,
      updatedAt: Date.now(),
    });

    return args.taskId;
  },
});

/**
 * Soft delete a task and all its descendants (subtree).
 */
export const softDeleteTaskSubtree = mutation({
  args: {
    companyId: v.id('companies'),
    taskId: v.id('tasks'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const task = await ctx.db.get(args.taskId);
    assertCompanyScoped(task, companyId, 'tasks');

    // Get all descendants
    const descendantIds = await getDescendantIds(ctx, args.taskId);

    // Soft delete all descendants
    const now = Date.now();
    const patch = createSoftDeletePatch(now);
    for (const id of descendantIds) {
      await ctx.db.patch(id, patch);
    }

    return {
      deletedCount: descendantIds.length,
      taskIds: descendantIds,
    };
  },
});

/**
 * Restore a soft-deleted task subtree (session-only undo).
 * Clears deletedAt for the task and all its descendants.
 */
export const undoRestoreTaskSubtree = mutation({
  args: {
    companyId: v.id('companies'),
    taskId: v.id('tasks'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const task = await ctx.db.get(args.taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    if (task.companyId !== companyId) {
      throw new Error('Task does not belong to company');
    }

    if (task.deletedAt === null) {
      throw new Error('Task is not deleted');
    }

    // Get all descendants (including deleted ones)
    const descendantIds = await getDescendantIds(ctx, args.taskId, true);

    // Restore all descendants that are deleted
    const now = Date.now();
    const patch = createRestorePatch(now);
    for (const id of descendantIds) {
      const desc = await ctx.db.get(id);
      if (desc && desc.deletedAt !== null) {
        await ctx.db.patch(id, patch);
      }
    }

    return {
      restoredCount: descendantIds.length,
      taskIds: descendantIds,
    };
  },
});
