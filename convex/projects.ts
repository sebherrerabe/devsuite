import { mutation, query } from './_generated/server';
import type { QueryCtx, MutationCtx } from './_generated/server';
import { v } from 'convex/values';
import {
  assertCompanyScoped,
  assertFound,
  createSoftDeletePatch,
} from './lib/helpers';

/**
 * User identity type from Convex auth
 */
interface UserIdentity {
  subject: string;
}

/**
 * Get the current user ID from the auth context.
 * Throws if the user is not authenticated.
 */
async function getUserId(ctx: {
  auth: { getUserIdentity: () => Promise<UserIdentity | null> };
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Unauthorized');
  }
  return identity.subject;
}

/**
 * Generate a URL-friendly slug from a project name.
 *
 * Rules:
 * - Convert to lowercase
 * - Replace spaces and special chars with hyphens
 * - Remove consecutive hyphens
 * - Trim hyphens from start/end
 * - Limit length to 100 chars
 *
 * @param name - Project name
 * @returns URL-friendly slug
 */
function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/-+/g, '-') // Collapse consecutive hyphens
      .replace(/^-|-$/g, '') // Trim hyphens from start/end
      .slice(0, 100) || // Limit length
    'project'
  ); // Fallback if empty
}

/**
 * Check if a project name already exists in the company (case-insensitive).
 *
 * @param ctx - Database context (QueryCtx or MutationCtx)
 * @param companyId - Company ID
 * @param name - Project name to check
 * @param excludeId - Optional project ID to exclude from check (for updates)
 * @returns true if name exists, false otherwise
 */
async function nameExists(
  ctx: QueryCtx | MutationCtx,
  companyId: string,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const normalizedName = name.trim().toLowerCase();

  const query = ctx.db
    .query('projects')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex('by_companyId_deletedAt', (q: any) =>
      q.eq('companyId', companyId).eq('deletedAt', null)
    );

  const existing = await query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((q: any) => {
      const nameLower = q.field('name').toLowerCase();
      const nameMatch = q.eq(nameLower, normalizedName);
      if (excludeId) {
        return q.and(nameMatch, q.neq(q.field('_id'), excludeId));
      }
      return nameMatch;
    })
    .first();

  return existing !== null;
}

/**
 * Create a new project.
 *
 * Enforces:
 * - Company scoping (user must own company)
 * - Name uniqueness per company (case-insensitive)
 * - Auto-generates slug from name
 */
export const createProject = mutation({
  args: {
    companyId: v.id('companies'),
    name: v.string(),
    description: v.optional(v.string()),
    repositoryIds: v.optional(v.array(v.id('repositories'))),
    color: v.optional(v.string()),
    isFavorite: v.optional(v.boolean()),
    isPinned: v.optional(v.boolean()),
    notesMarkdown: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify user owns this company
    const company = await ctx.db.get(args.companyId);
    if (!company || company.userId !== userId) {
      throw new Error('Company not found or access denied');
    }

    // Validate name
    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new Error('Project name cannot be empty');
    }
    if (trimmedName.length > 255) {
      throw new Error('Project name cannot exceed 255 characters');
    }

    // Check name uniqueness (case-insensitive)
    const nameAlreadyExists = await nameExists(
      ctx,
      args.companyId,
      trimmedName
    );
    if (nameAlreadyExists) {
      throw new Error(
        `A project with the name "${trimmedName}" already exists in this company`
      );
    }

    // Generate slug
    const slug = generateSlug(trimmedName);

    // Validate repository IDs belong to company
    if (args.repositoryIds && args.repositoryIds.length > 0) {
      for (const repoId of args.repositoryIds) {
        const repo = await ctx.db.get(repoId);
        if (!repo || repo.companyId !== args.companyId) {
          throw new Error(
            `Repository ${repoId} does not belong to this company`
          );
        }
      }
    }

    const now = Date.now();
    const projectId = await ctx.db.insert('projects', {
      companyId: args.companyId,
      name: trimmedName,
      ...(args.description && { description: args.description.trim() }),
      repositoryIds: args.repositoryIds ?? [],
      slug,
      ...(args.color && { color: args.color }),
      isFavorite: args.isFavorite ?? false,
      isPinned: args.isPinned ?? false,
      notesMarkdown: args.notesMarkdown ?? null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    return projectId;
  },
});

/**
 * Update a project.
 *
 * Enforces:
 * - Company scoping (user must own company)
 * - Name uniqueness per company if name changes (case-insensitive)
 * - Slug regenerated if name changes
 */
export const updateProject = mutation({
  args: {
    id: v.id('projects'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    repositoryIds: v.optional(v.array(v.id('repositories'))),
    color: v.optional(v.string()),
    isFavorite: v.optional(v.boolean()),
    isPinned: v.optional(v.boolean()),
    notesMarkdown: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const project = await ctx.db.get(args.id);
    assertFound(project, 'Project');

    // Verify user owns this project via company ownership
    const company = await ctx.db.get(project.companyId);
    if (!company || company.userId !== userId) {
      throw new Error('Project not found or access denied');
    }

    assertCompanyScoped(project, project.companyId, 'Project');

    const updates: {
      updatedAt: number;
      name?: string;
      description?: string | undefined;
      repositoryIds?: import('./_generated/dataModel').Id<'repositories'>[];
      slug?: string;
      color?: string | undefined;
      isFavorite?: boolean;
      isPinned?: boolean;
      notesMarkdown?: string | null;
    } = {
      updatedAt: Date.now(),
    };

    // Handle name change (with uniqueness check and slug regeneration)
    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (trimmedName.length === 0) {
        throw new Error('Project name cannot be empty');
      }
      if (trimmedName.length > 255) {
        throw new Error('Project name cannot exceed 255 characters');
      }

      // Check uniqueness if name changed (case-insensitive)
      const nameChanged =
        trimmedName.toLowerCase() !== project.name.toLowerCase();
      if (nameChanged) {
        const nameAlreadyExists = await nameExists(
          ctx,
          project.companyId,
          trimmedName,
          args.id
        );
        if (nameAlreadyExists) {
          throw new Error(
            `A project with the name "${trimmedName}" already exists in this company`
          );
        }
        updates.name = trimmedName;
        updates.slug = generateSlug(trimmedName);
      }
    }

    // Handle description
    if (args.description !== undefined) {
      updates.description = args.description.trim() || undefined;
    }

    // Handle repository IDs (validate they belong to company)
    if (args.repositoryIds !== undefined) {
      for (const repoId of args.repositoryIds) {
        const repo = await ctx.db.get(repoId);
        if (!repo || repo.companyId !== project.companyId) {
          throw new Error(
            `Repository ${repoId} does not belong to this company`
          );
        }
      }
      updates.repositoryIds = args.repositoryIds;
    }

    // Handle UX fields
    if (args.color !== undefined) {
      updates.color = args.color || undefined;
    }
    if (args.isFavorite !== undefined) {
      updates.isFavorite = args.isFavorite;
    }
    if (args.isPinned !== undefined) {
      updates.isPinned = args.isPinned;
    }

    // Handle notes
    if (args.notesMarkdown !== undefined) {
      updates.notesMarkdown = args.notesMarkdown || null;
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

/**
 * Get a project by ID.
 *
 * Enforces:
 * - Company scoping (user must own company)
 * - Returns null if project is deleted
 */
export const getProject = query({
  args: { id: v.id('projects') },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const project = await ctx.db.get(args.id);
    if (!project) {
      return null;
    }

    // Verify user owns this project via company ownership
    const company = await ctx.db.get(project.companyId);
    if (!company || company.userId !== userId) {
      return null; // Don't leak existence
    }

    // Return null if deleted
    if (project.deletedAt !== null) {
      return null;
    }

    return project;
  },
});

/**
 * List projects for a company.
 *
 * @param includeArchived - If true, includes soft-deleted projects
 * @returns List of projects (active or including archived based on flag)
 */
export const listProjects = query({
  args: {
    companyId: v.id('companies'),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify user owns this company
    const company = await ctx.db.get(args.companyId);
    if (!company || company.userId !== userId) {
      throw new Error('Company not found or access denied');
    }

    // If including archived, query by companyId only (no deletedAt filter)
    if (args.includeArchived) {
      return await ctx.db
        .query('projects')
        .withIndex('by_companyId', q => q.eq('companyId', args.companyId))
        .collect();
    }

    // Otherwise, only return active (non-deleted) projects
    return await ctx.db
      .query('projects')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', args.companyId).eq('deletedAt', null)
      )
      .collect();
  },
});

/**
 * Soft-delete a project.
 *
 * Enforces:
 * - Company scoping (user must own company)
 * - Soft delete only (sets deletedAt timestamp)
 */
export const softDeleteProject = mutation({
  args: { id: v.id('projects') },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const project = await ctx.db.get(args.id);
    assertFound(project, 'Project');

    // Verify user owns this project via company ownership
    const company = await ctx.db.get(project.companyId);
    if (!company || company.userId !== userId) {
      throw new Error('Project not found or access denied');
    }

    assertCompanyScoped(project, project.companyId, 'Project');

    // Soft delete
    await ctx.db.patch(args.id, createSoftDeletePatch());

    return args.id;
  },
});
