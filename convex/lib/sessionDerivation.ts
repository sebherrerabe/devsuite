/**
 * Session duration derivation utilities.
 *
 * Derives durations and summaries from the session event log.
 * When recordingIDE is set, effective time = intersection of (running) AND (IDE in focus).
 */

import type { Id } from '../_generated/dataModel';

export type SessionEventType =
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
  | 'PROJECT_UNASSIGNED_FROM_SESSION'
  | 'IDE_FOCUS_GAINED'
  | 'IDE_FOCUS_LOST';

export type SessionStatus = 'RUNNING' | 'PAUSED' | 'FINISHED' | 'CANCELLED';

export type SessionEventRecord = {
  type: SessionEventType;
  timestamp: number;
  serverTimestamp?: number;
  payload: Record<string, unknown>;
};

export type SessionDurationSummary = {
  effectiveDurationMs: number;
  activeTaskDurationMs: number;
  unallocatedDurationMs: number;
  hasOverlap: boolean;
  hasUnallocatedTime: boolean;
};

export type SessionTaskSummary = {
  taskId: Id<'tasks'>;
  activeDurationMs: number;
  wasActive: boolean;
  wasCompleted: boolean;
  firstActivatedAt: number | null;
  lastDeactivatedAt: number | null;
};

type TaskSummaryState = SessionTaskSummary & { _isActive: boolean };

type DeriveSessionParams = {
  sessionStatus: SessionStatus;
  sessionStartAt: number;
  sessionEndAt: number | null;
  events: SessionEventRecord[];
  recordingIDE?: string;
  nowMs?: number;
};

function getEffectiveTimestamp(event: SessionEventRecord): number {
  return event.serverTimestamp ?? event.timestamp;
}

/**
 * Dedupe consecutive identical IDE focus states (Interval Integrity Rule).
 */
function dedupeIdeFocusEvents(
  events: SessionEventRecord[]
): SessionEventRecord[] {
  const result: SessionEventRecord[] = [];
  let lastIdeState: 'GAINED' | 'LOST' | null = null;

  for (const event of events) {
    if (event.type === 'IDE_FOCUS_GAINED' || event.type === 'IDE_FOCUS_LOST') {
      const state = event.type === 'IDE_FOCUS_GAINED' ? 'GAINED' : 'LOST';
      if (lastIdeState === state) {
        continue;
      }
      lastIdeState = state;
    }
    result.push(event);
  }

  return result;
}

export function deriveSessionDurations(params: DeriveSessionParams): {
  durationSummary: SessionDurationSummary;
  taskSummaries: Map<Id<'tasks'>, SessionTaskSummary>;
} {
  const sortedEvents = [...params.events].sort(
    (a, b) => getEffectiveTimestamp(a) - getEffectiveTimestamp(b)
  );
  const events = params.recordingIDE
    ? dedupeIdeFocusEvents(sortedEvents)
    : sortedEvents;
  const nowMs = params.nowMs ?? Date.now();

  const hasIdeFocusEvents = events.some(
    e => e.type === 'IDE_FOCUS_GAINED' || e.type === 'IDE_FOCUS_LOST'
  );
  const useWallClockFallback = !!params.recordingIDE && !hasIdeFocusEvents;

  const taskSummaries = new Map<Id<'tasks'>, TaskSummaryState>();
  const activeTasks = new Set<Id<'tasks'>>();

  let isRunning = false;
  let isIdeFocused = !params.recordingIDE || useWallClockFallback;
  let lastTimestamp: number | null = null;

  let effectiveDurationMs = 0;
  let unallocatedDurationMs = 0;

  const ensureTask = (taskId: Id<'tasks'>): TaskSummaryState => {
    const existing = taskSummaries.get(taskId);
    if (existing) {
      return existing;
    }
    const summary: TaskSummaryState = {
      taskId,
      activeDurationMs: 0,
      wasActive: false,
      wasCompleted: false,
      firstActivatedAt: null,
      lastDeactivatedAt: null,
      _isActive: false,
    };
    taskSummaries.set(taskId, summary);
    return summary;
  };

  const applyDelta = (delta: number) => {
    if (delta <= 0) {
      return;
    }
    if (!isRunning) {
      return;
    }
    if (params.recordingIDE && !useWallClockFallback && !isIdeFocused) {
      return;
    }
    effectiveDurationMs += delta;
    if (activeTasks.size === 0) {
      unallocatedDurationMs += delta;
      return;
    }
    for (const taskId of activeTasks) {
      const summary = ensureTask(taskId);
      summary.activeDurationMs += delta;
    }
  };

  for (const event of events) {
    const eventTs = getEffectiveTimestamp(event);
    if (lastTimestamp !== null) {
      applyDelta(Math.max(0, eventTs - lastTimestamp));
    }

    switch (event.type) {
      case 'SESSION_STARTED':
      case 'SESSION_RESUMED':
        isRunning = true;
        break;
      case 'SESSION_PAUSED':
      case 'SESSION_FINISHED':
      case 'SESSION_CANCELLED':
        isRunning = false;
        break;
      case 'IDE_FOCUS_GAINED':
        isIdeFocused = true;
        break;
      case 'IDE_FOCUS_LOST':
        isIdeFocused = false;
        break;
      case 'TASK_ACTIVATED': {
        const taskId = event.payload.taskId as Id<'tasks'> | undefined;
        if (taskId) {
          const summary = ensureTask(taskId);
          summary.wasActive = true;
          summary._isActive = true;
          if (summary.firstActivatedAt === null) {
            summary.firstActivatedAt = eventTs;
          }
          activeTasks.add(taskId);
        }
        break;
      }
      case 'TASK_DEACTIVATED': {
        const taskId = event.payload.taskId as Id<'tasks'> | undefined;
        if (taskId) {
          const summary = ensureTask(taskId);
          summary.wasActive = true;
          summary._isActive = false;
          summary.lastDeactivatedAt = eventTs;
          activeTasks.delete(taskId);
        }
        break;
      }
      case 'TASK_MARKED_DONE': {
        const taskId = event.payload.taskId as Id<'tasks'> | undefined;
        if (taskId) {
          const summary = ensureTask(taskId);
          summary.wasCompleted = true;
        }
        break;
      }
      case 'TASK_RESET': {
        const taskId = event.payload.taskId as Id<'tasks'> | undefined;
        if (taskId) {
          activeTasks.delete(taskId);
          const summary = ensureTask(taskId);
          summary.activeDurationMs = 0;
          summary.wasActive = false;
          summary.wasCompleted = false;
          summary.firstActivatedAt = null;
          summary.lastDeactivatedAt = null;
          summary._isActive = false;
        }
        break;
      }
      default:
        break;
    }

    lastTimestamp = eventTs;
  }

  let effectiveEndAt: number | null = params.sessionEndAt;
  if (effectiveEndAt === null && params.sessionStatus === 'RUNNING') {
    effectiveEndAt = nowMs;
  }

  if (events.length === 0) {
    if (effectiveEndAt !== null && !params.recordingIDE) {
      const delta = Math.max(0, effectiveEndAt - params.sessionStartAt);
      effectiveDurationMs = delta;
      unallocatedDurationMs = delta;
    }
  } else if (effectiveEndAt !== null && lastTimestamp !== null) {
    applyDelta(Math.max(0, effectiveEndAt - lastTimestamp));
  }

  if (
    params.sessionEndAt !== null &&
    (params.sessionStatus === 'FINISHED' ||
      params.sessionStatus === 'CANCELLED')
  ) {
    for (const taskId of activeTasks) {
      const summary = ensureTask(taskId);
      summary.wasActive = true;
      summary._isActive = false;
      summary.lastDeactivatedAt = params.sessionEndAt;
    }
  }

  let activeTaskDurationMs = 0;
  const normalizedTaskSummaries = new Map<Id<'tasks'>, SessionTaskSummary>();

  for (const summary of taskSummaries.values()) {
    activeTaskDurationMs += summary.activeDurationMs;
    normalizedTaskSummaries.set(summary.taskId, {
      taskId: summary.taskId,
      activeDurationMs: summary.activeDurationMs,
      wasActive: summary.wasActive,
      wasCompleted: summary.wasCompleted,
      firstActivatedAt: summary.firstActivatedAt,
      lastDeactivatedAt: summary.lastDeactivatedAt,
    });
  }

  const durationSummary: SessionDurationSummary = {
    effectiveDurationMs,
    activeTaskDurationMs,
    unallocatedDurationMs,
    hasOverlap: activeTaskDurationMs > effectiveDurationMs,
    hasUnallocatedTime: unallocatedDurationMs > 0,
  };

  return {
    durationSummary,
    taskSummaries: normalizedTaskSummaries,
  };
}
