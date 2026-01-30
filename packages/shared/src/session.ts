/**
 * Session types and schemas for DevSuite
 *
 * Sessions are the primary source of truth for time tracking.
 * A session may touch multiple tasks or none (exploratory work).
 */

import { z } from 'zod';
import {
  type CompanyId,
  type SessionId,
  type TaskId,
  type Timestamp,
  type SoftDeletable,
  type Timestamped,
  companyIdSchema,
  sessionIdSchema,
  taskIdSchema,
  timestampSchema,
  softDeletableSchema,
  timestampedSchema,
} from './base';

// ============================================================================
// Session Entity
// ============================================================================

/**
 * A work session representing a block of focused work time.
 * Sessions are company-scoped and may optionally link to tasks.
 */
export type Session = {
  /** Unique identifier */
  id: SessionId;
  /** Company this session belongs to (tenant isolation) */
  companyId: CompanyId;
  /** When the session started (Unix ms) */
  startTime: Timestamp;
  /** When the session ended (Unix ms). Undefined/null for active sessions. */
  endTime: Timestamp | null;
  /** Optional summary of work done */
  summary: string | null;
  /** Task IDs worked on during this session. Can be empty for exploratory work. */
  taskIds: TaskId[];
} & SoftDeletable &
  Timestamped;

/**
 * Zod schema for Session entity
 */
export const sessionSchema = z
  .object({
    id: sessionIdSchema,
    companyId: companyIdSchema,
    startTime: timestampSchema,
    endTime: timestampSchema.nullable(),
    summary: z.string().nullable(),
    taskIds: z.array(taskIdSchema),
  })
  .merge(softDeletableSchema)
  .merge(timestampedSchema);

// ============================================================================
// Session Input Types
// ============================================================================

/**
 * Input for creating a new session
 */
export type CreateSessionInput = {
  /** Company this session belongs to */
  companyId: CompanyId;
  /** When the session started */
  startTime: Timestamp;
  /** When the session ended (omit for active session) */
  endTime?: Timestamp | null;
  /** Optional summary */
  summary?: string | null;
  /** Task IDs to associate with this session */
  taskIds?: TaskId[];
};

/**
 * Zod schema for creating a session
 */
export const createSessionInputSchema = z.object({
  companyId: companyIdSchema,
  startTime: timestampSchema,
  endTime: timestampSchema.nullable().optional(),
  summary: z.string().max(5000).nullable().optional(),
  taskIds: z.array(taskIdSchema).optional(),
});

/**
 * Input for updating an existing session
 */
export type UpdateSessionInput = {
  /** End time (set to close an active session) */
  endTime?: Timestamp | null;
  /** Updated summary */
  summary?: string | null;
  /** Replace task IDs (full replacement, not merge) */
  taskIds?: TaskId[];
};

/**
 * Zod schema for updating a session
 */
export const updateSessionInputSchema = z.object({
  endTime: timestampSchema.nullable().optional(),
  summary: z.string().max(5000).nullable().optional(),
  taskIds: z.array(taskIdSchema).optional(),
});

// ============================================================================
// SessionTask Junction Entity
// ============================================================================

/**
 * Junction type representing the relationship between a session and a task.
 * Provides additional metadata about work done on a specific task within a session.
 */
export type SessionTask = {
  /** The session this record belongs to */
  sessionId: SessionId;
  /** The task worked on */
  taskId: TaskId;
  /** Optional notes about work done on this task during the session */
  notes: string | null;
  /** Time distribution as percentage (0-100) or null if not tracked */
  timeDistribution: number | null;
} & Timestamped;

/**
 * Zod schema for SessionTask junction entity
 */
export const sessionTaskSchema = z
  .object({
    sessionId: sessionIdSchema,
    taskId: taskIdSchema,
    notes: z.string().max(5000).nullable(),
    timeDistribution: z.number().min(0).max(100).nullable(),
  })
  .merge(timestampedSchema);

// ============================================================================
// SessionTask Input Types
// ============================================================================

/**
 * Input for creating a session-task relationship
 */
export type CreateSessionTaskInput = {
  /** The session to link */
  sessionId: SessionId;
  /** The task to link */
  taskId: TaskId;
  /** Optional notes */
  notes?: string | null;
  /** Time distribution percentage */
  timeDistribution?: number | null;
};

/**
 * Zod schema for creating a session-task relationship
 */
export const createSessionTaskInputSchema = z.object({
  sessionId: sessionIdSchema,
  taskId: taskIdSchema,
  notes: z.string().max(5000).nullable().optional(),
  timeDistribution: z.number().min(0).max(100).nullable().optional(),
});

/**
 * Input for updating a session-task relationship
 */
export type UpdateSessionTaskInput = {
  /** Updated notes */
  notes?: string | null;
  /** Updated time distribution */
  timeDistribution?: number | null;
};

/**
 * Zod schema for updating a session-task relationship
 */
export const updateSessionTaskInputSchema = z.object({
  notes: z.string().max(5000).nullable().optional(),
  timeDistribution: z.number().min(0).max(100).nullable().optional(),
});
