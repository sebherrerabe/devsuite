/**
 * Pure decision logic for GitHub notification ingest.
 * Used to determine skip/update/insert per thread for regression tests.
 */

export type ThreadIngestDecision = 'skip' | 'update' | 'insert';

export interface ExistingThread {
  id: string;
  ghUpdatedAt: number | null;
}

/**
 * Decides whether to skip, update, or insert for a thread.
 * - skip: existing thread with same/older updatedAt or no incoming updatedAt
 * - update: existing thread with newer updatedAt (preserves read/archive, triggers notify)
 * - insert: no existing thread
 */
export function decideThreadIngestAction(
  existing: ExistingThread | null,
  incomingUpdatedAt: number | null
): ThreadIngestDecision {
  if (!existing) {
    return 'insert';
  }

  if (!incomingUpdatedAt) {
    return 'skip';
  }

  if (
    existing.ghUpdatedAt !== null &&
    incomingUpdatedAt <= existing.ghUpdatedAt
  ) {
    return 'skip';
  }

  return 'update';
}
