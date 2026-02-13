/**
 * Helpers for writing raw performance signals.
 */

import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

type PerformanceSignalType =
  | 'time_per_task'
  | 'context_switches'
  | 'session_duration'
  | 'tasks_completed'
  | 'focus_time'
  | 'break_time'
  | 'code_changes'
  | 'pr_reviews_completed';

type PerformanceSignalEntityType = 'task' | 'session' | 'project';

export async function insertPerformanceSignal(
  ctx: MutationCtx,
  args: {
    companyId: Id<'companies'>;
    type: PerformanceSignalType;
    value: number;
    entityType: PerformanceSignalEntityType;
    entityId: string;
    timestamp?: number;
  }
) {
  if (!Number.isFinite(args.value)) {
    return null;
  }

  const now = Date.now();
  const timestamp = args.timestamp ?? now;

  return await ctx.db.insert('performanceSignals', {
    companyId: args.companyId,
    type: args.type,
    value: args.value,
    entityType: args.entityType,
    entityId: args.entityId,
    timestamp,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}
