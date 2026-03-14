import assert from 'node:assert/strict';
import test from 'node:test';

import {
  shouldFinalizeExitAfterPause,
  shouldPauseRunningSessionOnExit,
} from '../../src/session-exit-guard.js';

test('shouldPauseRunningSessionOnExit only pauses connected running sessions', () => {
  assert.equal(
    shouldPauseRunningSessionOnExit({
      status: 'RUNNING',
      sessionId: 'session-1',
      effectiveDurationMs: 1_000,
      remainingTaskCount: 2,
      connectionState: 'connected',
      lastError: null,
      updatedAt: 1,
      publishedAt: 1,
      recordingIDE: null,
      isAutoCreated: null,
    }),
    true
  );

  assert.equal(
    shouldPauseRunningSessionOnExit({
      status: 'PAUSED',
      sessionId: 'session-1',
      effectiveDurationMs: 1_000,
      remainingTaskCount: 2,
      connectionState: 'connected',
      lastError: null,
      updatedAt: 1,
      publishedAt: 1,
      recordingIDE: null,
      isAutoCreated: null,
    }),
    false
  );

  assert.equal(
    shouldPauseRunningSessionOnExit({
      status: 'RUNNING',
      sessionId: 'session-1',
      effectiveDurationMs: 1_000,
      remainingTaskCount: 2,
      connectionState: 'syncing',
      lastError: null,
      updatedAt: 1,
      publishedAt: 1,
      recordingIDE: null,
      isAutoCreated: null,
    }),
    false
  );
});

test('shouldFinalizeExitAfterPause waits for a paused or idle state', () => {
  assert.equal(
    shouldFinalizeExitAfterPause({
      pendingExit: true,
      state: {
        status: 'PAUSED',
        sessionId: 'session-1',
        effectiveDurationMs: 1_000,
        remainingTaskCount: 2,
        connectionState: 'connected',
        lastError: null,
        updatedAt: 1,
        publishedAt: 1,
        recordingIDE: null,
        isAutoCreated: null,
      },
    }),
    true
  );

  assert.equal(
    shouldFinalizeExitAfterPause({
      pendingExit: true,
      state: {
        status: 'RUNNING',
        sessionId: 'session-1',
        effectiveDurationMs: 1_000,
        remainingTaskCount: 2,
        connectionState: 'connected',
        lastError: null,
        updatedAt: 1,
        publishedAt: 1,
        recordingIDE: null,
        isAutoCreated: null,
      },
    }),
    false
  );

  assert.equal(
    shouldFinalizeExitAfterPause({
      pendingExit: false,
      state: {
        status: 'IDLE',
        sessionId: null,
        effectiveDurationMs: 0,
        remainingTaskCount: null,
        connectionState: 'connected',
        lastError: null,
        updatedAt: 1,
        publishedAt: 1,
        recordingIDE: null,
        isAutoCreated: null,
      },
    }),
    false
  );
});
