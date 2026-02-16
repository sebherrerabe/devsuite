import assert from 'node:assert/strict';
import test from 'node:test';

import { broadcastDesktopSessionStateToWindows } from '../../src/session-state-broadcast.js';
import { createSessionWidgetHtml } from '../../src/session-widget-html.js';
import type {
  RuntimeLogSubsystem,
  RuntimeLogWriter,
} from '../../src/runtime-logger.js';

interface LoggedEvent {
  subsystem: RuntimeLogSubsystem;
  message: string;
}

function createLogger(): {
  logger: RuntimeLogWriter;
  events: LoggedEvent[];
} {
  const events: LoggedEvent[] = [];

  return {
    events,
    logger: {
      debug: (subsystem, message) => {
        events.push({ subsystem, message });
      },
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
  };
}

test('broadcastDesktopSessionStateToWindows logs snapshot and broadcasts to active windows', () => {
  const { logger, events } = createLogger();

  const sentPayloads: unknown[] = [];
  const windows = [
    {
      isDestroyed: () => false,
      webContents: {
        send: (_channel: string, payload: unknown) => {
          sentPayloads.push(payload);
        },
      },
    },
    {
      isDestroyed: () => true,
      webContents: {
        send: () => {
          throw new Error('destroyed windows must not receive state updates');
        },
      },
    },
  ];

  const snapshot = {
    status: 'RUNNING' as const,
    sessionId: 'session-1',
    effectiveDurationMs: 120000,
    connectionState: 'connected' as const,
    lastError: null,
    updatedAt: 1000,
  };

  broadcastDesktopSessionStateToWindows({
    windows,
    channel: 'desktop-session:state-changed',
    snapshot,
    logger,
  });

  assert.equal(sentPayloads.length, 1);
  assert.deepEqual(sentPayloads[0], snapshot);
  assert.equal(
    events.some(
      event =>
        event.subsystem === 'session-sync' &&
        event.message.includes('broadcast state: status=RUNNING')
    ),
    true
  );
});

test('session widget html includes runtime console diagnostics', () => {
  const html = createSessionWidgetHtml();

  assert.match(html, /console\.debug\('\[widget\] state received'/);
  assert.match(html, /console\.warn\('\[widget\] bridge signal stale'/);
});
