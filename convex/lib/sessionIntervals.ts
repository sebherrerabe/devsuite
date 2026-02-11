/**
 * Session interval derivation utilities.
 *
 * Derives active task segments from the session event log.
 */

import type { Id } from '../_generated/dataModel';
import type { SessionEventType, SessionStatus } from './sessionDerivation';

export type SessionEventRecord = {
  type: SessionEventType;
  timestamp: number;
  payload: Record<string, unknown>;
  taskId?: Id<'tasks'> | null;
};

export type ActiveSegment = {
  startAt: number;
  endAt: number;
  taskIds: Id<'tasks'>[];
};

type DeriveSegmentsParams = {
  sessionStatus: SessionStatus;
  sessionStartAt: number;
  sessionEndAt: number | null;
  events: SessionEventRecord[];
  nowMs?: number;
};

/**
 * Derive active task segments from session events.
 *
 * A segment is emitted when the session is running AND at least one task is active.
 */
export function deriveActiveSegments(params: DeriveSegmentsParams): {
  segments: ActiveSegment[];
} {
  const events = [...params.events].sort((a, b) => a.timestamp - b.timestamp);
  const nowMs = params.nowMs ?? Date.now();

  const activeTasks = new Set<Id<'tasks'>>();
  let isRunning = false;
  let lastTimestamp: number | null = null;
  const segments: ActiveSegment[] = [];

  const pushSegment = (startAt: number, endAt: number) => {
    if (endAt <= startAt) return;
    if (!isRunning) return;
    if (activeTasks.size === 0) return;
    segments.push({
      startAt,
      endAt,
      taskIds: Array.from(activeTasks),
    });
  };

  for (const event of events) {
    if (lastTimestamp !== null) {
      pushSegment(lastTimestamp, event.timestamp);
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
      case 'TASK_ACTIVATED': {
        const taskId = (event.taskId ??
          (event.payload?.taskId as Id<'tasks'> | undefined)) as
          | Id<'tasks'>
          | undefined;
        if (taskId) {
          activeTasks.add(taskId);
        }
        break;
      }
      case 'TASK_DEACTIVATED': {
        const taskId = (event.taskId ??
          (event.payload?.taskId as Id<'tasks'> | undefined)) as
          | Id<'tasks'>
          | undefined;
        if (taskId) {
          activeTasks.delete(taskId);
        }
        break;
      }
      case 'TASK_RESET': {
        const taskId = (event.taskId ??
          (event.payload?.taskId as Id<'tasks'> | undefined)) as
          | Id<'tasks'>
          | undefined;
        if (taskId) {
          activeTasks.delete(taskId);
        }
        break;
      }
      default:
        break;
    }

    lastTimestamp = event.timestamp;
  }

  let effectiveEndAt: number | null = params.sessionEndAt;
  if (effectiveEndAt === null && params.sessionStatus === 'RUNNING') {
    effectiveEndAt = nowMs;
  }

  if (effectiveEndAt !== null) {
    if (lastTimestamp !== null) {
      pushSegment(lastTimestamp, effectiveEndAt);
    }
  }

  return { segments };
}
