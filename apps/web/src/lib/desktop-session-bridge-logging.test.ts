import assert from 'node:assert/strict';
import test from 'node:test';

import {
  logDesktopBridgeCommandFailed,
  logDesktopBridgeCommandReceived,
  logDesktopBridgePublish,
} from './desktop-session-bridge-logging';

test('desktop session bridge logger helpers emit expected console output', () => {
  const debugCalls: unknown[][] = [];
  const warnCalls: unknown[][] = [];

  const originalDebug = console.debug;
  const originalWarn = console.warn;

  console.debug = (...args: unknown[]) => {
    debugCalls.push(args);
  };
  console.warn = (...args: unknown[]) => {
    warnCalls.push(args);
  };

  try {
    logDesktopBridgePublish({
      status: 'RUNNING',
      sessionId: 'session-1',
      effectiveDurationMs: 5000,
      connectionState: 'connected',
      updatedAt: 123,
      publishedAt: 123,
    });
    logDesktopBridgeCommandReceived({
      action: 'pause',
      status: 'RUNNING',
    });
    logDesktopBridgeCommandFailed({
      action: 'pause',
      error: new Error('failed'),
    });
  } finally {
    console.debug = originalDebug;
    console.warn = originalWarn;
  }

  assert.deepEqual(debugCalls[0]?.[0], '[desktop-bridge] publish');
  assert.deepEqual(debugCalls[1]?.[0], '[desktop-bridge] command received');
  assert.deepEqual(warnCalls[0]?.[0], '[desktop-bridge] command failed');
});
