export function logDesktopBridgePublish(payload: {
  status: 'IDLE' | 'RUNNING' | 'PAUSED';
  effectiveDurationMs: number;
  connectionState: 'connected' | 'syncing' | 'error';
  updatedAt: number;
}): void {
  console.debug('[desktop-bridge] publish', payload);
}

export function logDesktopBridgeCommandReceived(payload: {
  action: 'start' | 'pause' | 'resume' | 'end';
  status: 'IDLE' | 'RUNNING' | 'PAUSED';
}): void {
  console.debug('[desktop-bridge] command received', payload);
}

export function logDesktopBridgeCommandFailed(payload: {
  action: 'start' | 'pause' | 'resume' | 'end';
  error: unknown;
}): void {
  console.warn('[desktop-bridge] command failed', payload);
}
