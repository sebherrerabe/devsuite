/**
 * Session lifecycle + event ingestion for DevSuite
 *
 * Implements:
 * - Session lifecycle mutations (start/pause/resume/finish/cancel)
 * - Activity event mutations (task/project events)
 * - Read queries (getActiveSession, listSessions, getSession)
 */

import { mutation, query } from './_generated/server';
import type { QueryCtx, MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';
import {
  assertCompanyScoped,
  requireCompanyId,
  createSoftDeletePatch,
} from './lib/helpers';
import {
  assertCanCancel,
  assertCanFinish,
  assertCanPause,
  assertCanResume,
  assertEventTimestampOrder,
  assertSessionNotTerminal,
} from './lib/sessionValidation';
import { deriveSessionDurations } from './lib/sessionDerivation';

type SessionEventType =
  | 'SESSION_STARTED'
  | 'SESSION_PAUSED'
  | 'SESSION_RESUMED'
  | 'SESSION_FINISHED'
  | 'SESSION_CANCELLED'
  | 'TASK_ACTIVATED'
  | 'TASK_DEACTIVATED'
  | 'TASK_MARKED_DONE'
  | 'TASK_RESET'
  | 'STEP_LOGGED'
  | 'PROJECT_ASSIGNED_TO_SESSION'
  | 'PROJECT_UNASSIGNED_FROM_SESSION';

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
 * Ensure the user has access to the company.
 */
async function assertCompanyAccess(
  ctx: QueryCtx | MutationCtx,
  companyId: Id<'companies'>,
  userId: string
): Promise<void> {
  const company = await ctx.db.get(companyId);
  if (!company || company.userId !== userId) {
    throw new Error('Company not found or access denied');
  }
}

/**
 * Load a session for mutation and validate ownership.
 */
async function getSessionForWrite(
  ctx: QueryCtx | MutationCtx,
  companyId: Id<'companies'>,
  sessionId: Id<'sessions'>,
  userId: string
) {
  const session = await ctx.db.get(sessionId);
  assertCompanyScoped(session, companyId, 'sessions');
  if (session.createdBy !== userId) {
    throw new Error('Session not found or access denied');
  }
  return session;
}

/**
 * Load a session for read and validate ownership.
 */
async function getSessionForRead(
  ctx: QueryCtx | MutationCtx,
  companyId: Id<'companies'>,
  sessionId: Id<'sessions'>,
  userId: string,
  includeDiscarded: boolean
) {
  const session = await ctx.db.get(sessionId);
  if (!session) {
    return null;
  }
  if (session.companyId !== companyId || session.createdBy !== userId) {
    throw new Error('Session not found or access denied');
  }
  if (!includeDiscarded && session.deletedAt !== null) {
    return null;
  }
  return session;
}

/**
 * Get the last event timestamp for a session.
 */
async function getLastEventTimestamp(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<'sessions'>
): Promise<number | null> {
  const lastEvent = await ctx.db
    .query('sessionEvents')
    .withIndex('by_sessionId_timestamp', q => q.eq('sessionId', sessionId))
    .order('desc')
    .first();

  return lastEvent?.timestamp ?? null;
}

/**
 * Append a session event with ordering validation.
 */
async function appendSessionEvent(
  ctx: MutationCtx,
  params: {
    companyId: Id<'companies'>;
    sessionId: Id<'sessions'>;
    actorId: string;
    type: SessionEventType;
    payload: Record<string, unknown>;
    taskId?: Id<'tasks'> | null;
    projectId?: Id<'projects'> | null;
    clientTimestamp?: number | null;
  }
) {
  const now = Date.now();
  const lastTimestamp = await getLastEventTimestamp(ctx, params.sessionId);
  assertEventTimestampOrder(lastTimestamp, now);

  return await ctx.db.insert('sessionEvents', {
    companyId: params.companyId,
    sessionId: params.sessionId,
    actorId: params.actorId,
    type: params.type,
    taskId: params.taskId ?? null,
    projectId: params.projectId ?? null,
    timestamp: now,
    clientTimestamp: params.clientTimestamp ?? null,
    payload: params.payload,
    createdAt: now,
  });
}

/**
 * Find an active session for a user (RUNNING or PAUSED).
 */
async function findActiveSession(
  ctx: QueryCtx | MutationCtx,
  companyId: Id<'companies'>,
  userId: string
) {
  const running = await ctx.db
    .query('sessions')
    .withIndex('by_companyId_createdBy_status_deletedAt', q =>
      q
        .eq('companyId', companyId)
        .eq('createdBy', userId)
        .eq('status', 'RUNNING')
        .eq('deletedAt', null)
    )
    .first();

  if (running) {
    return running;
  }

  return await ctx.db
    .query('sessions')
    .withIndex('by_companyId_createdBy_status_deletedAt', q =>
      q
        .eq('companyId', companyId)
        .eq('createdBy', userId)
        .eq('status', 'PAUSED')
        .eq('deletedAt', null)
    )
    .first();
}

/**
 * Load ordered events for a session.
 */
async function loadSessionEvents(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<'sessions'>
) {
  return await ctx.db
    .query('sessionEvents')
    .withIndex('by_sessionId_timestamp', q => q.eq('sessionId', sessionId))
    .order('asc')
    .collect();
}

/**
 * Build project summaries from task summaries.
 */
async function buildProjectSummaries(
  ctx: QueryCtx | MutationCtx,
  companyId: Id<'companies'>,
  taskSummaries: { taskId: Id<'tasks'>; activeDurationMs: number }[]
) {
  const projectTotals = new Map<Id<'projects'>, number>();

  for (const summary of taskSummaries) {
    if (summary.activeDurationMs <= 0) {
      continue;
    }
    const task = await ctx.db.get(summary.taskId);
    if (!task) {
      continue;
    }
    if (task.companyId !== companyId) {
      throw new Error('Task does not belong to company');
    }
    if (task.projectId) {
      const existing = projectTotals.get(task.projectId) ?? 0;
      projectTotals.set(task.projectId, existing + summary.activeDurationMs);
    }
  }

  return Array.from(projectTotals.entries()).map(
    ([projectId, activeDurationMs]) => ({
      projectId,
      activeDurationMs,
    })
  );
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get the active session for the current user (RUNNING or PAUSED).
 */
export const getActiveSession = query({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    return await findActiveSession(ctx, companyId, userId);
  },
});

/**
 * List sessions for the current user.
 */
export const listSessions = query({
  args: {
    companyId: v.id('companies'),
    status: v.optional(
      v.union(
        v.literal('RUNNING'),
        v.literal('PAUSED'),
        v.literal('FINISHED'),
        v.literal('CANCELLED')
      )
    ),
    includeDiscarded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const includeDiscarded = args.includeDiscarded ?? false;

    let queryBuilder = ctx.db
      .query('sessions')
      .withIndex('by_companyId_startAt', q => q.eq('companyId', companyId))
      .order('desc')
      .filter(q => q.eq(q.field('createdBy'), userId));

    if (!includeDiscarded) {
      queryBuilder = queryBuilder.filter(q => q.eq(q.field('deletedAt'), null));
    }

    if (args.status) {
      queryBuilder = queryBuilder.filter(q =>
        q.eq(q.field('status'), args.status)
      );
    }

    const sessions = await queryBuilder.collect();

    return await Promise.all(
      sessions.map(async session => {
        const events = await loadSessionEvents(ctx, session._id);
        const { durationSummary } = deriveSessionDurations({
          sessionStatus: session.status,
          sessionStartAt: session.startAt,
          sessionEndAt: session.endAt,
          events,
        });

        return {
          ...session,
          durationSummary,
        };
      })
    );
  },
});

/**
 * Get a session with its events.
 */
export const getSession = query({
  args: {
    companyId: v.id('companies'),
    sessionId: v.id('sessions'),
    includeDiscarded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const includeDiscarded = args.includeDiscarded ?? false;
    const session = await getSessionForRead(
      ctx,
      companyId,
      args.sessionId,
      userId,
      includeDiscarded
    );

    if (!session) {
      return null;
    }

    const events = await loadSessionEvents(ctx, args.sessionId);
    const { durationSummary, taskSummaries } = deriveSessionDurations({
      sessionStatus: session.status,
      sessionStartAt: session.startAt,
      sessionEndAt: session.endAt,
      events,
    });

    const taskSummaryList = Array.from(taskSummaries.values()).sort((a, b) => {
      if (b.activeDurationMs !== a.activeDurationMs) {
        return b.activeDurationMs - a.activeDurationMs;
      }
      return a.taskId < b.taskId ? -1 : 1;
    });

    const projectSummaries = await buildProjectSummaries(
      ctx,
      companyId,
      taskSummaryList
    );

    return {
      session,
      events,
      durationSummary,
      taskSummaries: taskSummaryList,
      projectSummaries,
    };
  },
});

/**
 * Get session-derived metadata for a task across this user's sessions.
 */
export const getTaskSessionMetadata = query({
  args: {
    companyId: v.id('companies'),
    taskId: v.id('tasks'),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const task = await ctx.db.get(args.taskId);
    assertCompanyScoped(task, companyId, 'tasks');

    const taskEvents = await ctx.db
      .query('sessionEvents')
      .withIndex('by_companyId_taskId_timestamp', q =>
        q.eq('companyId', companyId).eq('taskId', args.taskId)
      )
      .order('desc')
      .collect();

    if (taskEvents.length === 0) {
      return {
        totalTrackedMs: 0,
        totalPausedMs: 0,
        pauseCount: 0,
        sessionCount: 0,
        lastSessionAt: null as number | null,
        lastSessionTaskDurationMs: 0,
      };
    }

    const sessionLastEventMap = new Map<Id<'sessions'>, number>();
    for (const event of taskEvents) {
      if (!sessionLastEventMap.has(event.sessionId)) {
        sessionLastEventMap.set(event.sessionId, event.timestamp);
      }
    }

    const now = Date.now();
    let totalTrackedMs = 0;
    let totalPausedMs = 0;
    let pauseCount = 0;
    let sessionCount = 0;
    let lastSessionAt: number | null = null;
    let lastSessionTaskDurationMs = 0;

    for (const [sessionId, lastTaskEventAt] of sessionLastEventMap) {
      const session = await ctx.db.get(sessionId);
      if (!session) {
        continue;
      }
      if (session.companyId !== companyId || session.createdBy !== userId) {
        continue;
      }
      if (session.deletedAt !== null) {
        continue;
      }

      const sessionEvents = await loadSessionEvents(ctx, sessionId);
      const { durationSummary, taskSummaries } = deriveSessionDurations({
        sessionStatus: session.status,
        sessionStartAt: session.startAt,
        sessionEndAt: session.endAt,
        events: sessionEvents,
        nowMs: now,
      });

      const taskSummary = taskSummaries.get(args.taskId);
      const taskDurationMs = taskSummary?.activeDurationMs ?? 0;
      totalTrackedMs += taskDurationMs;

      const totalSessionDurationMs = Math.max(
        0,
        (session.endAt ?? now) - session.startAt
      );
      totalPausedMs += Math.max(
        0,
        totalSessionDurationMs - durationSummary.effectiveDurationMs
      );
      pauseCount += sessionEvents.filter(
        event => event.type === 'SESSION_PAUSED'
      ).length;
      sessionCount += 1;

      if (lastSessionAt === null || lastTaskEventAt > lastSessionAt) {
        lastSessionAt = lastTaskEventAt;
        lastSessionTaskDurationMs = taskDurationMs;
      }
    }

    return {
      totalTrackedMs,
      totalPausedMs,
      pauseCount,
      sessionCount,
      lastSessionAt,
      lastSessionTaskDurationMs,
    };
  },
});

// ============================================================================
// Session Lifecycle Mutations
// ============================================================================

/**
 * Start a new session.
 */
export const startSession = mutation({
  args: {
    companyId: v.id('companies'),
    projectIds: v.optional(v.array(v.id('projects'))),
    summary: v.optional(v.string()),
    clientTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const existingActive = await findActiveSession(ctx, companyId, userId);
    if (existingActive) {
      throw new Error('An active session already exists for this user');
    }

    const projectIds = args.projectIds ?? [];
    for (const projectId of projectIds) {
      const project = await ctx.db.get(projectId);
      assertCompanyScoped(project, companyId, 'projects');
    }

    const now = Date.now();
    const sessionId = await ctx.db.insert('sessions', {
      companyId,
      createdBy: userId,
      status: 'RUNNING',
      startAt: now,
      endAt: null,
      cancelMode: null,
      cancelledAt: null,
      discardedAt: null,
      summary: args.summary?.trim() ?? null,
      projectIds,
      isExcludedFromSummaries: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await appendSessionEvent(ctx, {
      companyId,
      sessionId,
      actorId: userId,
      type: 'SESSION_STARTED',
      payload: projectIds.length > 0 ? { projectIds } : {},
      clientTimestamp: args.clientTimestamp ?? null,
    });

    return sessionId;
  },
});

/**
 * Pause an active session.
 */
export const pauseSession = mutation({
  args: {
    companyId: v.id('companies'),
    sessionId: v.id('sessions'),
    clientTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const session = await getSessionForWrite(
      ctx,
      companyId,
      args.sessionId,
      userId
    );
    assertCanPause(session.status);

    const now = Date.now();
    await ctx.db.patch(args.sessionId, {
      status: 'PAUSED',
      updatedAt: now,
    });

    await appendSessionEvent(ctx, {
      companyId,
      sessionId: args.sessionId,
      actorId: userId,
      type: 'SESSION_PAUSED',
      payload: {},
      clientTimestamp: args.clientTimestamp ?? null,
    });

    return args.sessionId;
  },
});

/**
 * Resume a paused session.
 */
export const resumeSession = mutation({
  args: {
    companyId: v.id('companies'),
    sessionId: v.id('sessions'),
    clientTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const session = await getSessionForWrite(
      ctx,
      companyId,
      args.sessionId,
      userId
    );
    assertCanResume(session.status);

    const now = Date.now();
    await ctx.db.patch(args.sessionId, {
      status: 'RUNNING',
      updatedAt: now,
    });

    await appendSessionEvent(ctx, {
      companyId,
      sessionId: args.sessionId,
      actorId: userId,
      type: 'SESSION_RESUMED',
      payload: {},
      clientTimestamp: args.clientTimestamp ?? null,
    });

    return args.sessionId;
  },
});

/**
 * Finish a session.
 */
export const finishSession = mutation({
  args: {
    companyId: v.id('companies'),
    sessionId: v.id('sessions'),
    summary: v.optional(v.string()),
    clientTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const session = await getSessionForWrite(
      ctx,
      companyId,
      args.sessionId,
      userId
    );
    assertCanFinish(session.status);

    const now = Date.now();
    await ctx.db.patch(args.sessionId, {
      status: 'FINISHED',
      endAt: now,
      summary: args.summary?.trim() ?? session.summary,
      updatedAt: now,
    });

    await appendSessionEvent(ctx, {
      companyId,
      sessionId: args.sessionId,
      actorId: userId,
      type: 'SESSION_FINISHED',
      payload: {},
      clientTimestamp: args.clientTimestamp ?? null,
    });

    return args.sessionId;
  },
});

/**
 * Cancel a session.
 */
export const cancelSession = mutation({
  args: {
    companyId: v.id('companies'),
    sessionId: v.id('sessions'),
    cancelMode: v.union(v.literal('DISCARD'), v.literal('KEEP_EXCLUDED')),
    clientTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const session = await getSessionForWrite(
      ctx,
      companyId,
      args.sessionId,
      userId
    );
    assertCanCancel(session.status);

    const now = Date.now();
    const isDiscard = args.cancelMode === 'DISCARD';
    const updatePatch: {
      status: 'CANCELLED';
      cancelMode: 'DISCARD' | 'KEEP_EXCLUDED';
      cancelledAt: number;
      discardedAt: number | null;
      endAt: number;
      isExcludedFromSummaries: true;
      updatedAt: number;
      deletedAt?: number | null;
    } = {
      status: 'CANCELLED',
      cancelMode: args.cancelMode,
      cancelledAt: now,
      discardedAt: isDiscard ? now : null,
      endAt: now,
      isExcludedFromSummaries: true,
      updatedAt: now,
    };

    if (isDiscard) {
      const deletePatch = createSoftDeletePatch(now);
      updatePatch.deletedAt = deletePatch.deletedAt ?? now;
      updatePatch.updatedAt = deletePatch.updatedAt;
    }

    await ctx.db.patch(args.sessionId, updatePatch);

    await appendSessionEvent(ctx, {
      companyId,
      sessionId: args.sessionId,
      actorId: userId,
      type: 'SESSION_CANCELLED',
      payload: { cancelMode: args.cancelMode },
      clientTimestamp: args.clientTimestamp ?? null,
    });

    return args.sessionId;
  },
});

// ============================================================================
// Activity Mutations
// ============================================================================

/**
 * Activate a task within a session.
 */
export const activateTask = mutation({
  args: {
    companyId: v.id('companies'),
    sessionId: v.id('sessions'),
    taskId: v.id('tasks'),
    clientTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const session = await getSessionForWrite(
      ctx,
      companyId,
      args.sessionId,
      userId
    );
    assertSessionNotTerminal(session.status, 'activate tasks in');

    const task = await ctx.db.get(args.taskId);
    assertCompanyScoped(task, companyId, 'tasks');

    await appendSessionEvent(ctx, {
      companyId,
      sessionId: args.sessionId,
      actorId: userId,
      type: 'TASK_ACTIVATED',
      taskId: args.taskId,
      payload: { taskId: args.taskId },
      clientTimestamp: args.clientTimestamp ?? null,
    });

    return args.sessionId;
  },
});

/**
 * Deactivate a task within a session.
 */
export const deactivateTask = mutation({
  args: {
    companyId: v.id('companies'),
    sessionId: v.id('sessions'),
    taskId: v.id('tasks'),
    clientTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const session = await getSessionForWrite(
      ctx,
      companyId,
      args.sessionId,
      userId
    );
    assertSessionNotTerminal(session.status, 'deactivate tasks in');

    const task = await ctx.db.get(args.taskId);
    assertCompanyScoped(task, companyId, 'tasks');

    await appendSessionEvent(ctx, {
      companyId,
      sessionId: args.sessionId,
      actorId: userId,
      type: 'TASK_DEACTIVATED',
      taskId: args.taskId,
      payload: { taskId: args.taskId },
      clientTimestamp: args.clientTimestamp ?? null,
    });

    return args.sessionId;
  },
});

/**
 * Mark a task done within a session.
 */
export const markTaskDone = mutation({
  args: {
    companyId: v.id('companies'),
    sessionId: v.id('sessions'),
    taskId: v.id('tasks'),
    clientTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const session = await getSessionForWrite(
      ctx,
      companyId,
      args.sessionId,
      userId
    );
    assertSessionNotTerminal(session.status, 'mark tasks done in');

    const task = await ctx.db.get(args.taskId);
    assertCompanyScoped(task, companyId, 'tasks');

    await ctx.db.patch(args.taskId, {
      status: 'done',
      updatedAt: Date.now(),
    });

    await appendSessionEvent(ctx, {
      companyId,
      sessionId: args.sessionId,
      actorId: userId,
      type: 'TASK_MARKED_DONE',
      taskId: args.taskId,
      payload: { taskId: args.taskId },
      clientTimestamp: args.clientTimestamp ?? null,
    });

    return args.sessionId;
  },
});

/**
 * Reset a task state during a session (clears task time for this session).
 */
export const resetTask = mutation({
  args: {
    companyId: v.id('companies'),
    sessionId: v.id('sessions'),
    taskId: v.id('tasks'),
    clientTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const session = await getSessionForWrite(
      ctx,
      companyId,
      args.sessionId,
      userId
    );
    assertSessionNotTerminal(session.status, 'reset tasks in');

    const task = await ctx.db.get(args.taskId);
    assertCompanyScoped(task, companyId, 'tasks');

    await ctx.db.patch(args.taskId, {
      status: 'todo',
      updatedAt: Date.now(),
    });

    await appendSessionEvent(ctx, {
      companyId,
      sessionId: args.sessionId,
      actorId: userId,
      type: 'TASK_RESET',
      taskId: args.taskId,
      payload: { taskId: args.taskId },
      clientTimestamp: args.clientTimestamp ?? null,
    });

    return args.sessionId;
  },
});

/**
 * Assign a project to a session.
 */
export const assignProject = mutation({
  args: {
    companyId: v.id('companies'),
    sessionId: v.id('sessions'),
    projectId: v.id('projects'),
    clientTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const session = await getSessionForWrite(
      ctx,
      companyId,
      args.sessionId,
      userId
    );
    assertSessionNotTerminal(session.status, 'assign projects to');

    const project = await ctx.db.get(args.projectId);
    assertCompanyScoped(project, companyId, 'projects');

    const projectIds = session.projectIds.includes(args.projectId)
      ? session.projectIds
      : [...session.projectIds, args.projectId];

    await ctx.db.patch(args.sessionId, {
      projectIds,
      updatedAt: Date.now(),
    });

    await appendSessionEvent(ctx, {
      companyId,
      sessionId: args.sessionId,
      actorId: userId,
      type: 'PROJECT_ASSIGNED_TO_SESSION',
      projectId: args.projectId,
      payload: { projectId: args.projectId },
      clientTimestamp: args.clientTimestamp ?? null,
    });

    return args.sessionId;
  },
});

/**
 * Unassign a project from a session.
 */
export const unassignProject = mutation({
  args: {
    companyId: v.id('companies'),
    sessionId: v.id('sessions'),
    projectId: v.id('projects'),
    clientTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const session = await getSessionForWrite(
      ctx,
      companyId,
      args.sessionId,
      userId
    );
    assertSessionNotTerminal(session.status, 'unassign projects from');

    const project = await ctx.db.get(args.projectId);
    assertCompanyScoped(project, companyId, 'projects');

    const projectIds = session.projectIds.filter(
      projectId => projectId !== args.projectId
    );

    await ctx.db.patch(args.sessionId, {
      projectIds,
      updatedAt: Date.now(),
    });

    await appendSessionEvent(ctx, {
      companyId,
      sessionId: args.sessionId,
      actorId: userId,
      type: 'PROJECT_UNASSIGNED_FROM_SESSION',
      projectId: args.projectId,
      payload: { projectId: args.projectId },
      clientTimestamp: args.clientTimestamp ?? null,
    });

    return args.sessionId;
  },
});
