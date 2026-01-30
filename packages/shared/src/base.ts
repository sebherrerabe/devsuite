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
 * Uses `deletedAt` as the source of truth:
 * - undefined = not deleted
 * - number (timestamp) = deleted at that time
 *
 * This avoids duplication compared to having both `isDeleted` and `deletedAt`.
 */
export type SoftDeletable = {
  deletedAt: Timestamp | undefined;
};

/**
 * Zod schema for soft deletable pattern
 */
export const softDeletableSchema = z.object({
  deletedAt: timestampSchema.optional(),
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
 * Zod schema for SessionId
 */
export const sessionIdSchema = idSchema.transform(val => val as SessionId);

/**
 * Zod schema for PRReviewId
 */
export const prReviewIdSchema = idSchema.transform(val => val as PRReviewId);
