/**
 * Session types and schemas for DevSuite
 *
 * Sessions are event-based: events are the source of truth.
 * Durations and summaries are derived from the event log.
 */

import { z } from 'zod';
import {
  type CompanyId,
  type SessionId,
  type ProjectId,
  type Timestamp,
  type SoftDeletable,
  type Timestamped,
  companyIdSchema,
  sessionIdSchema,
  taskIdSchema,
  projectIdSchema,
  timestampSchema,
  softDeletableSchema,
  timestampedSchema,
  idSchema,
} from './base';
import { type UserId, userIdSchema } from './company';

// ============================================================================
// Session Status + Cancel Modes
// ============================================================================

/**
 * Session status values
 */
export const sessionStatusValues = [
  'RUNNING',
  'PAUSED',
  'FINISHED',
  'CANCELLED',
] as const;

export type SessionStatus = (typeof sessionStatusValues)[number];

/**
 * Zod schema for SessionStatus
 */
export const sessionStatusSchema = z.enum(sessionStatusValues);

/**
 * Cancellation modes for a session
 */
export const sessionCancelModeValues = ['DISCARD', 'KEEP_EXCLUDED'] as const;

export type SessionCancelMode = (typeof sessionCancelModeValues)[number];

/**
 * Zod schema for SessionCancelMode
 */
export const sessionCancelModeSchema = z.enum(sessionCancelModeValues);

// ============================================================================
// Session Entity
// ============================================================================

/**
 * A work session representing a block of time tracking.
 *
 * Sessions are company-scoped and derived from events.
 */
export type Session = {
  /** Unique identifier */
  id: SessionId;
  /** Company this session belongs to (tenant isolation) */
  companyId: CompanyId;
  /** User who created the session */
  createdBy: UserId;
  /** Current status */
  status: SessionStatus;
  /** Session start timestamp (Unix ms) */
  startAt: Timestamp;
  /** Session end timestamp (Unix ms) */
  endAt: Timestamp | null;
  /** Cancellation mode (if cancelled) */
  cancelMode: SessionCancelMode | null;
  /** Timestamp when cancelled (if cancelled) */
  cancelledAt: Timestamp | null;
  /** Timestamp when discarded (if discard mode) */
  discardedAt: Timestamp | null;
  /** Optional summary of work completed */
  summary: string | null;
  /** Project IDs associated with this session (denormalized/derived) */
  projectIds: ProjectId[];
  /** Excluded from summaries (true for cancelled/discarded) */
  isExcludedFromSummaries: boolean;
} & Timestamped &
  SoftDeletable;

/**
 * Zod schema for Session entity
 */
export const sessionSchema = z
  .object({
    id: sessionIdSchema,
    companyId: companyIdSchema,
    createdBy: userIdSchema,
    status: sessionStatusSchema,
    startAt: timestampSchema,
    endAt: timestampSchema.nullable(),
    cancelMode: sessionCancelModeSchema.nullable(),
    cancelledAt: timestampSchema.nullable(),
    discardedAt: timestampSchema.nullable(),
    summary: z.string().max(5000).nullable(),
    projectIds: z.array(projectIdSchema),
    isExcludedFromSummaries: z.boolean(),
  })
  .merge(timestampedSchema)
  .merge(softDeletableSchema);

// ============================================================================
// Session Event Types + Payloads
// ============================================================================

/**
 * Branded string type for SessionEvent IDs
 */
export type SessionEventId = string & { __brand: 'SessionEventId' };

/**
 * Zod schema for SessionEventId
 */
export const sessionEventIdSchema = idSchema.transform(
  val => val as SessionEventId
);

/**
 * Event type values for the session event log
 */
export const sessionEventTypeValues = [
  'SESSION_STARTED',
  'SESSION_PAUSED',
  'SESSION_RESUMED',
  'SESSION_FINISHED',
  'SESSION_CANCELLED',
  'TASK_ACTIVATED',
  'TASK_DEACTIVATED',
  'TASK_MARKED_DONE',
  'TASK_RESET',
  'STEP_LOGGED',
  'PROJECT_ASSIGNED_TO_SESSION',
  'PROJECT_UNASSIGNED_FROM_SESSION',
] as const;

export type SessionEventType = (typeof sessionEventTypeValues)[number];

/**
 * Zod schema for SessionEventType
 */
export const sessionEventTypeSchema = z.enum(sessionEventTypeValues);

const emptyPayloadSchema = z.object({}).strict();

/**
 * Payload for SESSION_STARTED
 */
export const sessionStartedPayloadSchema = z.object({
  projectIds: z.array(projectIdSchema).optional(),
});

export type SessionStartedPayload = z.infer<typeof sessionStartedPayloadSchema>;

/**
 * Payload for SESSION_CANCELLED
 */
export const sessionCancelledPayloadSchema = z.object({
  cancelMode: sessionCancelModeSchema,
});

export type SessionCancelledPayload = z.infer<
  typeof sessionCancelledPayloadSchema
>;

/**
 * Payload for TASK_ACTIVATED / TASK_DEACTIVATED / TASK_MARKED_DONE
 */
export const sessionTaskEventPayloadSchema = z.object({
  taskId: taskIdSchema,
});

export type SessionTaskEventPayload = z.infer<
  typeof sessionTaskEventPayloadSchema
>;

/**
 * Payload for STEP_LOGGED
 */
export const sessionStepLoggedPayloadSchema = z.object({
  text: z.string().min(1).max(5000),
  taskId: taskIdSchema.optional(),
});

export type SessionStepLoggedPayload = z.infer<
  typeof sessionStepLoggedPayloadSchema
>;

/**
 * Payload for PROJECT_ASSIGNED_TO_SESSION / PROJECT_UNASSIGNED_FROM_SESSION
 */
export const sessionProjectEventPayloadSchema = z.object({
  projectId: projectIdSchema,
});

export type SessionProjectEventPayload = z.infer<
  typeof sessionProjectEventPayloadSchema
>;

// ============================================================================
// Session Events (discriminated union)
// ============================================================================

const sessionEventBaseSchema = z.object({
  id: sessionEventIdSchema,
  companyId: companyIdSchema,
  sessionId: sessionIdSchema,
  actorId: userIdSchema,
  timestamp: timestampSchema,
  clientTimestamp: timestampSchema.nullable().optional(),
  createdAt: timestampSchema,
});

export const sessionStartedEventSchema = sessionEventBaseSchema.extend({
  type: z.literal('SESSION_STARTED'),
  payload: sessionStartedPayloadSchema,
});

export const sessionPausedEventSchema = sessionEventBaseSchema.extend({
  type: z.literal('SESSION_PAUSED'),
  payload: emptyPayloadSchema,
});

export const sessionResumedEventSchema = sessionEventBaseSchema.extend({
  type: z.literal('SESSION_RESUMED'),
  payload: emptyPayloadSchema,
});

export const sessionFinishedEventSchema = sessionEventBaseSchema.extend({
  type: z.literal('SESSION_FINISHED'),
  payload: emptyPayloadSchema,
});

export const sessionCancelledEventSchema = sessionEventBaseSchema.extend({
  type: z.literal('SESSION_CANCELLED'),
  payload: sessionCancelledPayloadSchema,
});

export const taskActivatedEventSchema = sessionEventBaseSchema.extend({
  type: z.literal('TASK_ACTIVATED'),
  payload: sessionTaskEventPayloadSchema,
});

export const taskDeactivatedEventSchema = sessionEventBaseSchema.extend({
  type: z.literal('TASK_DEACTIVATED'),
  payload: sessionTaskEventPayloadSchema,
});

export const taskMarkedDoneEventSchema = sessionEventBaseSchema.extend({
  type: z.literal('TASK_MARKED_DONE'),
  payload: sessionTaskEventPayloadSchema,
});

export const taskResetEventSchema = sessionEventBaseSchema.extend({
  type: z.literal('TASK_RESET'),
  payload: sessionTaskEventPayloadSchema,
});

export const stepLoggedEventSchema = sessionEventBaseSchema.extend({
  type: z.literal('STEP_LOGGED'),
  payload: sessionStepLoggedPayloadSchema,
});

export const projectAssignedEventSchema = sessionEventBaseSchema.extend({
  type: z.literal('PROJECT_ASSIGNED_TO_SESSION'),
  payload: sessionProjectEventPayloadSchema,
});

export const projectUnassignedEventSchema = sessionEventBaseSchema.extend({
  type: z.literal('PROJECT_UNASSIGNED_FROM_SESSION'),
  payload: sessionProjectEventPayloadSchema,
});

/**
 * Zod schema for SessionEvent (discriminated union)
 */
export const sessionEventSchema = z.discriminatedUnion('type', [
  sessionStartedEventSchema,
  sessionPausedEventSchema,
  sessionResumedEventSchema,
  sessionFinishedEventSchema,
  sessionCancelledEventSchema,
  taskActivatedEventSchema,
  taskDeactivatedEventSchema,
  taskMarkedDoneEventSchema,
  taskResetEventSchema,
  stepLoggedEventSchema,
  projectAssignedEventSchema,
  projectUnassignedEventSchema,
]);

export type SessionEvent = z.infer<typeof sessionEventSchema>;

// ============================================================================
// Derived Summaries (DTOs)
// ============================================================================

/**
 * Duration summary derived from session events.
 */
export const sessionDurationSummarySchema = z.object({
  /** Total running time for the session */
  effectiveDurationMs: z.number().int().nonnegative(),
  /** Sum of per-task durations (overlap allowed) */
  activeTaskDurationMs: z.number().int().nonnegative(),
  /** Running time with zero active tasks */
  unallocatedDurationMs: z.number().int().nonnegative(),
  /** True when task durations exceed session duration */
  hasOverlap: z.boolean(),
  /** True when unallocated duration is non-zero */
  hasUnallocatedTime: z.boolean(),
});

export type SessionDurationSummary = z.infer<
  typeof sessionDurationSummarySchema
>;

/**
 * Per-task summary derived from events.
 */
export const sessionTaskSummarySchema = z.object({
  taskId: taskIdSchema,
  activeDurationMs: z.number().int().nonnegative(),
  wasActive: z.boolean(),
  wasCompleted: z.boolean(),
  firstActivatedAt: timestampSchema.nullable(),
  lastDeactivatedAt: timestampSchema.nullable(),
});

export type SessionTaskSummary = z.infer<typeof sessionTaskSummarySchema>;

/**
 * Per-project summary derived from tasks.
 */
export const sessionProjectSummarySchema = z.object({
  projectId: projectIdSchema,
  activeDurationMs: z.number().int().nonnegative(),
});

export type SessionProjectSummary = z.infer<typeof sessionProjectSummarySchema>;

// ============================================================================
// List + Detail DTOs
// ============================================================================

/**
 * Session summary for list views
 */
export const sessionListItemSchema = z.object({
  id: sessionIdSchema,
  companyId: companyIdSchema,
  createdBy: userIdSchema,
  status: sessionStatusSchema,
  startAt: timestampSchema,
  endAt: timestampSchema.nullable(),
  cancelMode: sessionCancelModeSchema.nullable(),
  cancelledAt: timestampSchema.nullable(),
  discardedAt: timestampSchema.nullable(),
  summary: z.string().max(5000).nullable(),
  projectIds: z.array(projectIdSchema),
  isExcludedFromSummaries: z.boolean(),
  durationSummary: sessionDurationSummarySchema,
});

export type SessionListItem = z.infer<typeof sessionListItemSchema>;

/**
 * Session detail DTO (timeline + summaries)
 */
export const sessionDetailSchema = sessionListItemSchema.extend({
  events: z.array(sessionEventSchema),
  taskSummaries: z.array(sessionTaskSummarySchema),
  projectSummaries: z.array(sessionProjectSummarySchema),
});

export type SessionDetail = z.infer<typeof sessionDetailSchema>;
