import { runtimeLog, type RuntimeLogWriter } from './runtime-logger.js';
import type { DesktopSessionState } from './session-control.js';

interface WindowLike {
  isDestroyed: () => boolean;
  webContents: {
    send: (channel: string, payload: DesktopSessionState) => void;
  };
}

export function broadcastDesktopSessionStateToWindows(params: {
  windows: WindowLike[];
  channel: string;
  snapshot: DesktopSessionState;
  logger?: RuntimeLogWriter;
}): void {
  const logger = params.logger ?? runtimeLog;

  logger.debug(
    'session-sync',
    `broadcast state: status=${params.snapshot.status}, sessionId=${params.snapshot.sessionId ?? 'none'}, connectionState=${params.snapshot.connectionState}, updatedAt=${params.snapshot.updatedAt}`
  );

  for (const window of params.windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(params.channel, params.snapshot);
    }
  }
}
