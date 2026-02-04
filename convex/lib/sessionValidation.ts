/**
 * Session validation helpers for DevSuite
 *
 * These helpers enforce session state transitions and event ordering.
 */

export const sessionStatusValues = [
  'RUNNING',
  'PAUSED',
  'FINISHED',
  'CANCELLED',
] as const;

export type SessionStatus = (typeof sessionStatusValues)[number];

export const sessionCancelModeValues = ['DISCARD', 'KEEP_EXCLUDED'] as const;

export type SessionCancelMode = (typeof sessionCancelModeValues)[number];

/**
 * True if the session status is terminal (no more events allowed).
 */
export function isTerminalStatus(status: SessionStatus): boolean {
  return status === 'FINISHED' || status === 'CANCELLED';
}

/**
 * Assert that the session is not in a terminal state.
 */
export function assertSessionNotTerminal(
  status: SessionStatus,
  action: string
): void {
  if (isTerminalStatus(status)) {
    throw new Error(`Cannot ${action} a ${status.toLowerCase()} session`);
  }
}

/**
 * Assert session can be paused.
 */
export function assertCanPause(status: SessionStatus): void {
  if (status !== 'RUNNING') {
    throw new Error('Session must be RUNNING to pause');
  }
}

/**
 * Assert session can be resumed.
 */
export function assertCanResume(status: SessionStatus): void {
  if (status !== 'PAUSED') {
    throw new Error('Session must be PAUSED to resume');
  }
}

/**
 * Assert session can be finished.
 */
export function assertCanFinish(status: SessionStatus): void {
  if (status !== 'RUNNING' && status !== 'PAUSED') {
    throw new Error('Session must be RUNNING or PAUSED to finish');
  }
}

/**
 * Assert session can be cancelled.
 */
export function assertCanCancel(status: SessionStatus): void {
  if (status !== 'RUNNING' && status !== 'PAUSED') {
    throw new Error('Session must be RUNNING or PAUSED to cancel');
  }
}

/**
 * Assert that a new event timestamp is not earlier than the last event.
 */
export function assertEventTimestampOrder(
  lastTimestamp: number | null | undefined,
  nextTimestamp: number
): void {
  if (lastTimestamp !== null && lastTimestamp !== undefined) {
    if (nextTimestamp < lastTimestamp) {
      throw new Error('Session events must be appended in chronological order');
    }
  }
}
