import type { DesktopSessionState } from './session-control.js';

export function shouldPauseRunningSessionOnExit(
  state: DesktopSessionState
): boolean {
  return (
    state.connectionState === 'connected' &&
    state.status === 'RUNNING' &&
    typeof state.sessionId === 'string' &&
    state.sessionId.length > 0
  );
}

export function shouldFinalizeExitAfterPause(params: {
  pendingExit: boolean;
  state: DesktopSessionState;
}): boolean {
  if (!params.pendingExit) {
    return false;
  }

  return params.state.status === 'PAUSED' || params.state.status === 'IDLE';
}
