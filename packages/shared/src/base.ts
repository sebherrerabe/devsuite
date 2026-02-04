/**
 * Base types and utilities for DevSuite
 *
 * This module provides foundational types used across all entities:
 * - Branded ID types for type safety
 * - Timestamp types
 * - Soft delete patterns
 * - Timestamped patterns
 * - Pagination types
 * - Result type for error handling
 */

import { z } from 'zod';

// ============================================================================
// Branded ID Types
// ============================================================================

/**
 * Branded string type for Company IDs
 */
export type CompanyId = string & { __brand: 'CompanyId' };

/**
 * Branded string type for Repository IDs
 */
export type RepositoryId = string & { __brand: 'RepositoryId' };

/**
 * Branded string type for Project IDs
 */
export type ProjectId = string & { __brand: 'ProjectId' };

/**
 * Branded string type for Task IDs
 */
export type TaskId = string & { __brand: 'TaskId' };

/**
 * Branded string type for Project Task List IDs
 */
export type ProjectTaskListId = string & { __brand: 'ProjectTaskListId' };

/**
 * Branded string type for Tag IDs
 */
export type TagId = string & { __brand: 'TagId' };

/**
 * Branded string type for External Link IDs
 */
export type ExternalLinkId = string & { __brand: 'ExternalLinkId' };

/**
 * Branded string type for Session IDs
 */
export type SessionId = string & { __brand: 'SessionId' };

/**
 * Branded string type for PR Review IDs
 */
export type PRReviewId = string & { __brand: 'PRReviewId' };

// ============================================================================
// Timestamp Types
// ============================================================================

/**
 * Unix timestamp in milliseconds
 */
export type Timestamp = number;

/**
 * Zod schema for Unix timestamp (milliseconds)
 */
export const timestampSchema = z.number().int().nonnegative();

// ============================================================================
// Soft Delete Pattern
// ============================================================================

/**
 * Soft deletable entity pattern.
 * Uses `deletedAt` as the source of truth (Convex convention):
 * - null / undefined = not deleted (active)
 * - number (timestamp ms) = deleted at that time
 */
export type SoftDeletable = {
  deletedAt?: Timestamp | null;
};

/**
 * Zod schema for soft deletable pattern
 */
export const softDeletableSchema = z.object({
  deletedAt: timestampSchema.nullable().optional(),
});

// ============================================================================
// Timestamped Pattern
// ============================================================================

/**
 * Entity with creation and update timestamps
 */
export type Timestamped = {
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/**
 * Zod schema for timestamped pattern
 */
export const timestampedSchema = z.object({
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Pagination request parameters
 */
export type PaginatedRequest = {
  /**
   * Number of items per page
   * @default 20
   */
  limit?: number;
  /**
   * Pagination cursor (opaque string for cursor-based pagination)
   * If not provided, starts from the beginning
   */
  cursor?: string;
};

/**
 * Paginated response with cursor-based pagination
 */
export type PaginatedResponse<T> = {
  items: T[];
  /**
   * Cursor for the next page. If undefined, there are no more items.
   */
  nextCursor: string | undefined;
  /**
   * Whether there are more items available
   */
  hasMore: boolean;
};

/**
 * Zod schema for paginated request
 */
export const paginatedRequestSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

// ============================================================================
// Result Type for Error Handling
// ============================================================================

/**
 * Result type for operations that can succeed or fail.
 * Similar to Rust's Result<T, E> or functional Either pattern.
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Create a successful result
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Create a failed result
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Check if a result is successful
 */
export function isOk<T, E>(
  result: Result<T, E>
): result is { ok: true; value: T } {
  return result.ok === true;
}

/**
 * Check if a result is an error
 */
export function isErr<T, E>(
  result: Result<T, E>
): result is { ok: false; error: E } {
  return result.ok === false;
}

// ============================================================================
// ID Schema Helpers
// ============================================================================

/**
 * Zod schema for branded ID strings
 */
export const idSchema = z.string().min(1);

// ============================================================================
// Convex Document Base Shape
// ============================================================================

/**
 * Minimal base shape for a Convex document.
 *
 * Note:
 * - Convex documents use `_id` (not `id`).
 * - Many app-facing DTOs convert `_id` -> `id` for ergonomic usage.
 */
export type ConvexDocBase<TId extends string = string> = {
  _id: TId;
  _creationTime: Timestamp;
};

/**
 * Zod schema for the minimal Convex document base shape.
 *
 * Table-specific schemas should typically override `_id` with a branded ID schema.
 */
export const convexDocBaseSchema = z.object({
  _id: idSchema,
  _creationTime: timestampSchema,
});

/**
 * Zod schema for CompanyId
 * Uses transform to cast to branded type after validation
 */
export const companyIdSchema = idSchema.transform(val => val as CompanyId);

/**
 * Zod schema for RepositoryId
 */
export const repositoryIdSchema = idSchema.transform(
  val => val as RepositoryId
);

/**
 * Zod schema for ProjectId
 */
export const projectIdSchema = idSchema.transform(val => val as ProjectId);

/**
 * Zod schema for TaskId
 */
export const taskIdSchema = idSchema.transform(val => val as TaskId);

/**
 * Zod schema for ProjectTaskListId
 */
export const projectTaskListIdSchema = idSchema.transform(
  val => val as ProjectTaskListId
);

/**
 * Zod schema for TagId
 */
export const tagIdSchema = idSchema.transform(val => val as TagId);

/**
 * Zod schema for ExternalLinkId
 */
export const externalLinkIdSchema = idSchema.transform(
  val => val as ExternalLinkId
);

/**
 * Zod schema for SessionId
 */
export const sessionIdSchema = idSchema.transform(val => val as SessionId);

/**
 * Zod schema for PRReviewId
 */
export const prReviewIdSchema = idSchema.transform(val => val as PRReviewId);
