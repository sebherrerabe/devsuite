/**
 * Project and Task types for DevSuite
 *
 * This module provides:
 * - ExternalLink types for referencing external systems (no mirroring)
 * - Project entity types
 * - Task entity types with hierarchical support
 */

import { z } from 'zod';
import {
  companyIdSchema,
  projectIdSchema,
  repositoryIdSchema,
  taskIdSchema,
  softDeletableSchema,
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
 * - identifier: the unique ID in that system (e.g., PR number, Notion page ID)
 * - url: direct link to view in the external system
 *
 * We do NOT store titles, descriptions, or other data that could become stale.
 */
export const externalLinkSchema = z.object({
  type: externalLinkTypeSchema,
  /** System-specific identifier (e.g., "123" for PR #123, Notion page ID) */
  identifier: z.string().min(1),
  /** Direct URL to the external resource */
  url: z.string().url(),
});

export type ExternalLink = z.infer<typeof externalLinkSchema>;

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
// Task Complexity
// ============================================================================

/**
 * Task complexity levels
 */
export const taskComplexityValues = [
  'trivial',
  'small',
  'medium',
  'large',
  'epic',
] as const;

export type TaskComplexity = (typeof taskComplexityValues)[number];

/**
 * Zod schema for TaskComplexity
 */
export const taskComplexitySchema = z.enum(taskComplexityValues);

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
 * - External systems are referenced via externalLinks (not mirrored)
 * - Company-scoped via project relationship
 */
export const taskSchema = z
  .object({
    id: taskIdSchema,
    projectId: projectIdSchema,
    /** Parent task ID for hierarchy (undefined for top-level tasks) */
    parentTaskId: taskIdSchema.optional(),
    title: z.string().min(1).max(500),
    description: z.string().max(10000).optional(),
    status: taskStatusSchema,
    complexity: taskComplexitySchema.optional(),
    /** Tags for categorization */
    tags: z.array(z.string().min(1).max(50)),
    /** Links to external systems (GitHub PRs, Notion pages, etc.) */
    externalLinks: z.array(externalLinkSchema),
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
 * Schema for creating a new Task
 *
 * - id, timestamps, and deletedAt are generated server-side
 * - projectId is required (company scoping via project)
 * - status defaults to 'todo' if not provided
 */
export const createTaskInputSchema = z.object({
  projectId: projectIdSchema,
  parentTaskId: taskIdSchema.optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  status: taskStatusSchema.optional(),
  complexity: taskComplexitySchema.optional(),
  tags: z.array(z.string().min(1).max(50)).optional(),
  externalLinks: z.array(externalLinkSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

/**
 * Schema for updating a Task
 *
 * - All fields optional (partial update)
 * - id and timestamps cannot be updated directly
 * - projectId is immutable (use move operation if needed)
 * - parentTaskId can be set to null to move to top-level
 */
export const updateTaskInputSchema = z.object({
  parentTaskId: taskIdSchema.nullable().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  status: taskStatusSchema.optional(),
  complexity: taskComplexitySchema.nullable().optional(),
  tags: z.array(z.string().min(1).max(50)).optional(),
  externalLinks: z.array(externalLinkSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;
