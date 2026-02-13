/**
 * Shared performance metric helpers.
 *
 * These helpers provide deterministic metric semantics that can be reused
 * across ingestion paths and dashboard derivation queries.
 */

import type { Id } from '../_generated/dataModel';

type TaskActivationEvent = {
  type: string;
  timestamp: number;
  taskId?: Id<'tasks'> | null;
  payload?: Record<string, unknown>;
};

export type ContextSwitchMetrics = {
  count: number;
  switchTimestamps: number[];
};

function extractTaskId(event: TaskActivationEvent): Id<'tasks'> | null {
  const taskIdFromField = event.taskId ?? null;
  if (taskIdFromField) {
    return taskIdFromField;
  }

  const payloadTaskId = event.payload?.taskId;
  if (typeof payloadTaskId === 'string') {
    return payloadTaskId as Id<'tasks'>;
  }
  return null;
}

/**
 * Count context switches from task activation events.
 *
 * A context switch is counted when the activated task differs from the most
 * recent eligible activated task.
 */
export function countContextSwitchesFromTaskActivations(
  events: TaskActivationEvent[],
  options?: {
    startAt?: number;
    endAt?: number;
    allowTask?: (taskId: Id<'tasks'>) => boolean;
  }
): ContextSwitchMetrics {
  const startAt = options?.startAt ?? Number.NEGATIVE_INFINITY;
  const endAt = options?.endAt ?? Number.POSITIVE_INFINITY;
  const allowTask = options?.allowTask;

  let previousTaskId: Id<'tasks'> | null = null;
  let count = 0;
  const switchTimestamps: number[] = [];

  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

  for (const event of sortedEvents) {
    if (event.type !== 'TASK_ACTIVATED') {
      continue;
    }
    if (event.timestamp < startAt || event.timestamp >= endAt) {
      continue;
    }

    const taskId = extractTaskId(event);
    if (!taskId) {
      continue;
    }
    if (allowTask && !allowTask(taskId)) {
      continue;
    }

    if (previousTaskId === null) {
      previousTaskId = taskId;
      continue;
    }

    if (taskId !== previousTaskId) {
      count += 1;
      switchTimestamps.push(event.timestamp);
      previousTaskId = taskId;
    }
  }

  return {
    count,
    switchTimestamps,
  };
}
