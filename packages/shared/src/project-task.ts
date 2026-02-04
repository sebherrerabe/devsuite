/**
 * Project and Task types for DevSuite
 *
 * This module provides:
 * - ExternalLink types for referencing external systems (no mirroring)
 * - Tag entity types (company-managed)
 * - Project entity types
 * - Task entity types with hierarchical support
 */

import { z } from 'zod';
import {
  companyIdSchema,
  convexDocBaseSchema,
  externalLinkIdSchema,
  projectIdSchema,
  projectTaskListIdSchema,
  repositoryIdSchema,
  tagIdSchema,
  taskIdSchema,
  softDeletableSchema,
  timestampSchema,
  timestampedSchema,
} from './base';

// ============================================================================
// External Link Types
// ============================================================================

/**
 * Types of external systems that can be linked to tasks.
 * These are references only - we do NOT mirror external data.
 */
export const externalLinkTypeValues = [
  'github_pr',
  'github_issue',
  'notion',
  'ticktick',
  'url',
] as const;

export type ExternalLinkType = (typeof externalLinkTypeValues)[number];

/**
 * Zod schema for ExternalLinkType
 */
export const externalLinkTypeSchema = z.enum(externalLinkTypeValues);

/**
 * External link - a reference to an external system.
 *
 * IMPORTANT: This is a reference, not a copy. We store:
 * - type: which system it's from
 * - title: user-provided label for display
 * - identifier: the unique ID in that system (optional)
 * - url: direct link to view in the external system
 */
export const externalLinkSchema = z
  .object({
    id: externalLinkIdSchema,
    companyId: companyIdSchema,
    taskId: taskIdSchema,
    type: externalLinkTypeSchema,
    /** Direct URL to the external resource */
    url: z.string().url(),
    /** User-provided title (required) */
    title: z.string().min(1),
    /** System-specific identifier (e.g., "123" for PR #123, Notion page ID) */
    identifier: z.string().min(1).optional(),
    /** Arbitrary metadata (JSON-serializable) */
    metadata: z.record(z.unknown()).nullable().optional(),
  })
  .merge(timestampedSchema)
  .merge(softDeletableSchema);

export type ExternalLink = z.infer<typeof externalLinkSchema>;

/**
 * Convex document shape for ExternalLink (raw DB document).
 * Uses `_id` / `_creationTime` instead of `id`.
 */
export const externalLinkDocSchema = convexDocBaseSchema
  .extend({
    _id: externalLinkIdSchema,
    companyId: companyIdSchema,
    taskId: taskIdSchema,
    type: externalLinkTypeSchema,
    url: z.string().url(),
    title: z.string().min(1),
    identifier: z.string().min(1).optional(),
    metadata: z.unknown().optional(),
  })
  .merge(timestampedSchema)
  .merge(softDeletableSchema);

export type ExternalLinkDoc = z.infer<typeof externalLinkDocSchema>;

/**
 * Schema for creating a new ExternalLink
 */
export const createExternalLinkInputSchema = z.object({
  companyId: companyIdSchema,
  taskId: taskIdSchema,
  type: externalLinkTypeSchema,
  url: z.string().url(),
  title: z.string().min(1),
  identifier: z.string().min(1).optional(),
});

export type CreateExternalLinkInput = z.infer<
  typeof createExternalLinkInputSchema
>;

/**
 * Schema for updating an ExternalLink
 */
export const updateExternalLinkInputSchema = z.object({
  title: z.string().min(1).optional(),
  url: z.string().url().optional(),
  identifier: z.string().min(1).optional(),
});

export type UpdateExternalLinkInput = z.infer<
  typeof updateExternalLinkInputSchema
>;

// ============================================================================
// Tag Types
// ============================================================================

/**
 * Tag entity Zod schema
 */
export const tagSchema = z
  .object({
    id: tagIdSchema,
    companyId: companyIdSchema,
    name: z.string().min(1).max(255),
    color: z.string().nullable(),
    /** Arbitrary metadata (JSON-serializable) */
    metadata: z.record(z.unknown()).nullable().optional(),
  })
  .merge(timestampedSchema)
  .merge(softDeletableSchema);

export type Tag = z.infer<typeof tagSchema>;

/**
 * Convex document shape for Tag (raw DB document).
 * Uses `_id` / `_creationTime` instead of `id`.
 */
export const tagDocSchema = convexDocBaseSchema
  .extend({
    _id: tagIdSchema,
    companyId: companyIdSchema,
    name: z.string().min(1).max(255),
    color: z.string().nullable(),
    metadata: z.unknown().optional(),
  })
  .merge(timestampedSchema)
  .merge(softDeletableSchema);

export type TagDoc = z.infer<typeof tagDocSchema>;

/**
 * Schema for creating a new Tag
 */
export const createTagInputSchema = z.object({
  companyId: companyIdSchema,
  name: z.string().min(1).max(255),
  color: z.string().nullable(),
});

export type CreateTagInput = z.infer<typeof createTagInputSchema>;

/**
 * Schema for updating a Tag
 */
export const updateTagInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  color: z.string().nullable().optional(),
});

export type UpdateTagInput = z.infer<typeof updateTagInputSchema>;

// ============================================================================
// Task Status
// ============================================================================

/**
 * Task status values
 */
export const taskStatusValues = [
  'todo',
  'in_progress',
  'blocked',
  'done',
  'cancelled',
] as const;

export type TaskStatus = (typeof taskStatusValues)[number];

/**
 * Zod schema for TaskStatus
 */
export const taskStatusSchema = z.enum(taskStatusValues);

// ============================================================================
// Project Types
// ============================================================================

/**
 * Project entity Zod schema (schema-first approach)
 *
 * Projects are company-scoped and can be linked to repositories.
 * Repository linking is by ID only (no circular deps).
 */
export const projectSchema = z
  .object({
    id: projectIdSchema,
    companyId: companyIdSchema,
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    /** Auto-generated slug */
    slug: z.string().min(1).max(100).optional(),
    /** Project color (hex or name) */
    color: z.string().optional(),
    /** Whether the project is pinned in the UI */
    isPinned: z.boolean().optional(),
    /** Whether the project is marked as favorite */
    isFavorite: z.boolean().optional(),
    /** Whether the project is the default for the company */
    isDefault: z.boolean(),
    /** Markdown notes/scratchpad */
    notesMarkdown: z.string().nullable(),
    /** IDs of linked repositories */
    repositoryIds: z.array(repositoryIdSchema),
    /** Arbitrary metadata (JSON-serializable) */
    metadata: z.record(z.unknown()),
  })
  .merge(timestampedSchema)
  .merge(softDeletableSchema);

/**
 * Project entity type (inferred from schema)
 */
export type Project = z.infer<typeof projectSchema>;

/**
 * Convex document shape for Project (raw DB document).
 * Uses `_id` / `_creationTime` instead of `id`.
 */
export const projectDocSchema = convexDocBaseSchema
  .extend({
    _id: projectIdSchema,
    companyId: companyIdSchema,
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    repositoryIds: z.array(repositoryIdSchema),
    slug: z.string().min(1).max(100).optional(),
    color: z.string().optional(),
    isFavorite: z.boolean().optional(),
    isPinned: z.boolean().optional(),
    isDefault: z.boolean(),
    notesMarkdown: z.string().nullable(),
    metadata: z.unknown(),
  })
  .merge(timestampedSchema)
  .merge(softDeletableSchema);

export type ProjectDoc = z.infer<typeof projectDocSchema>;

/**
 * Schema for creating a new Project
 *
 * - id, timestamps, and deletedAt are generated server-side
 * - companyId is required (company scoping invariant)
 */
export const createProjectInputSchema = z.object({
  companyId: companyIdSchema,
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  repositoryIds: z.array(repositoryIdSchema).optional(),
  color: z.string().optional(),
  isPinned: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  notesMarkdown: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

/**
 * Schema for updating a Project
 *
 * - All fields optional (partial update)
 * - id and timestamps cannot be updated directly
 * - companyId is immutable to maintain tenant isolation
 */
export const updateProjectInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  repositoryIds: z.array(repositoryIdSchema).optional(),
  color: z.string().optional(),
  isPinned: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  notesMarkdown: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;

// ============================================================================
// Task Types
// ============================================================================

/**
 * Task entity Zod schema (schema-first approach)
 *
 * Tasks are the primary unit of work in DevSuite.
 * - Supports hierarchy via parentTaskId (optional, null for top-level)
 * - External systems are referenced via external_links (not mirrored)
 * - Company-scoped and always project-scoped
 */
export const taskSchema = z
  .object({
    id: taskIdSchema,
    companyId: companyIdSchema,
    projectId: projectIdSchema,
    listId: projectTaskListIdSchema,
    /** Parent task ID for hierarchy (null for top-level tasks) */
    parentTaskId: taskIdSchema.nullable(),
    title: z.string().min(1).max(500),
    description: z.string().max(10000).optional(),
    status: taskStatusSchema,
    /** Complexity score from 1 to 10 */
    complexityScore: z.number().int().min(1).max(10).nullable(),
    /** Ordering key among siblings */
    sortKey: z.string().min(1),
    /** Due date timestamp (ms) */
    dueDate: timestampSchema.nullable(),
    /** Markdown notes/scratchpad */
    notesMarkdown: z.string().nullable(),
    /** Managed tag references */
    tagIds: z.array(tagIdSchema),
    /** Arbitrary metadata (JSON-serializable) */
    metadata: z.record(z.unknown()),
  })
  .merge(timestampedSchema)
  .merge(softDeletableSchema);

/**
 * Task entity type (inferred from schema)
 */
export type Task = z.infer<typeof taskSchema>;

/**
 * Convex document shape for Task (raw DB document).
 * Uses `_id` / `_creationTime` instead of `id`.
 */
export const taskDocSchema = convexDocBaseSchema
  .extend({
    _id: taskIdSchema,
    companyId: companyIdSchema,
    projectId: projectIdSchema,
    listId: projectTaskListIdSchema,
    parentTaskId: taskIdSchema.nullable(),
    title: z.string().min(1).max(500),
    description: z.string().max(10000).optional(),
    status: taskStatusSchema,
    sortKey: z.string().min(1),
    dueDate: timestampSchema.nullable(),
    complexityScore: z.number().int().min(1).max(10).nullable(),
    notesMarkdown: z.string().nullable(),
    tagIds: z.array(tagIdSchema),
    metadata: z.unknown(),
  })
  .merge(timestampedSchema)
  .merge(softDeletableSchema);

export type TaskDoc = z.infer<typeof taskDocSchema>;

/**
 * Schema for creating a new Task
 */
export const createTaskInputSchema = z.object({
  companyId: companyIdSchema,
  projectId: projectIdSchema,
  listId: projectTaskListIdSchema.optional(),
  parentTaskId: taskIdSchema.nullable(),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  status: taskStatusSchema.optional(),
  complexityScore: z.number().int().min(1).max(10).nullable(),
  dueDate: timestampSchema.nullable(),
  notesMarkdown: z.string().nullable(),
  tagIds: z.array(tagIdSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

/**
 * Schema for updating a Task
 */
export const updateTaskInputSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  status: taskStatusSchema.optional(),
  complexityScore: z.number().int().min(1).max(10).nullable().optional(),
  dueDate: timestampSchema.nullable().optional(),
  notesMarkdown: z.string().nullable().optional(),
  tagIds: z.array(tagIdSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;
