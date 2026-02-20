/**
 * Session interval derivation utilities.
 *
 * Derives active task segments from the session event log.
 * When recordingIDE is set, segments = intersection of (running, task active, IDE focused).
 */

import type { Id } from '../_generated/dataModel';
import type { SessionEventType, SessionStatus } from './sessionDerivation';

export type SessionEventRecord = {
  type: SessionEventType;
  timestamp: number;
  serverTimestamp?: number;
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
  recordingIDE?: string;
  nowMs?: number;
};

function getEffectiveTimestamp(event: SessionEventRecord): number {
  return event.serverTimestamp ?? event.timestamp;
}

/**
 * Derive active task segments from session events.
 *
 * A segment is emitted when the session is running AND at least one task is active.
 * When recordingIDE is set, only emit segments when IDE is in focus.
 */
export function deriveActiveSegments(params: DeriveSegmentsParams): {
  segments: ActiveSegment[];
} {
  const events = [...params.events].sort(
    (a, b) => getEffectiveTimestamp(a) - getEffectiveTimestamp(b)
  );
  const nowMs = params.nowMs ?? Date.now();

  const activeTasks = new Set<Id<'tasks'>>();
  let isRunning = false;
  let isIdeFocused = !params.recordingIDE;
  let lastTimestamp: number | null = null;
  const segments: ActiveSegment[] = [];

  const pushSegment = (startAt: number, endAt: number) => {
    if (endAt <= startAt) return;
    if (!isRunning) return;
    if (params.recordingIDE && !isIdeFocused) return;
    if (activeTasks.size === 0) return;
    segments.push({
      startAt,
      endAt,
      taskIds: Array.from(activeTasks),
    });
  };

  for (const event of events) {
    const eventTs = getEffectiveTimestamp(event);
    if (lastTimestamp !== null) {
      pushSegment(lastTimestamp, eventTs);
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

    lastTimestamp = eventTs;
  }

  let effectiveEndAt: number | null = params.sessionEndAt;
  if (effectiveEndAt === null && params.sessionStatus === 'RUNNING') {
    effectiveEndAt = nowMs;
  }

  if (effectiveEndAt !== null && lastTimestamp !== null) {
    pushSegment(lastTimestamp, effectiveEndAt);
  }

  return { segments };
}
