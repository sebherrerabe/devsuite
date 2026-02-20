import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDesktopSessionActionAvailability,
  parseDesktopSessionCommand,
  parseDesktopSessionState,
} from '../../src/session-control.js';

test('parseDesktopSessionState accepts a valid payload', () => {
  const parsed = parseDesktopSessionState({
    status: 'RUNNING',
    sessionId: ' session-123 ',
    effectiveDurationMs: 9000,
    remainingTaskCount: 4,
    connectionState: 'connected',
    lastError: null,
    updatedAt: 1739555000000,
    publishedAt: 1739555001000,
  });

  assert.deepEqual(parsed, {
    status: 'RUNNING',
    sessionId: 'session-123',
    effectiveDurationMs: 9000,
    remainingTaskCount: 4,
    connectionState: 'connected',
    lastError: null,
    updatedAt: 1739555000000,
    publishedAt: 1739555001000,
    recordingIDE: null,
  });
});

test('parseDesktopSessionState rejects invalid payloads', () => {
  assert.throws(
    () => parseDesktopSessionState(null),
    /Desktop session state payload must be an object/
  );
  assert.throws(
    () =>
      parseDesktopSessionState({
        status: 'BROKEN',
        sessionId: null,
        effectiveDurationMs: 0,
        remainingTaskCount: null,
        connectionState: 'connected',
        lastError: null,
        updatedAt: 1,
      }),
    /session status must be one of/
  );
  assert.throws(
    () =>
      parseDesktopSessionState({
        status: 'IDLE',
        sessionId: {},
        effectiveDurationMs: 0,
        remainingTaskCount: null,
        connectionState: 'connected',
        lastError: null,
        updatedAt: 1,
      }),
    /sessionId must be a string or null/
  );
  assert.throws(
    () =>
      parseDesktopSessionState({
        status: 'IDLE',
        sessionId: null,
        effectiveDurationMs: 0,
        remainingTaskCount: null,
        connectionState: 'connected',
        lastError: null,
        updatedAt: 0,
      }),
    /updatedAt must be greater than 0/
  );
  assert.throws(
    () =>
      parseDesktopSessionState({
        status: 'IDLE',
        sessionId: null,
        effectiveDurationMs: -1,
        remainingTaskCount: null,
        connectionState: 'connected',
        lastError: null,
        updatedAt: 1,
      }),
    /effectiveDurationMs must be greater than or equal to 0/
  );
  assert.throws(
    () =>
      parseDesktopSessionState({
        status: 'IDLE',
        sessionId: null,
        effectiveDurationMs: 0,
        remainingTaskCount: null,
        connectionState: 'offline',
        lastError: null,
        updatedAt: 1,
      }),
    /connectionState must be one of/
  );
});

test('parseDesktopSessionState defaults publishedAt to updatedAt', () => {
  const parsed = parseDesktopSessionState({
    status: 'IDLE',
    sessionId: null,
    effectiveDurationMs: 0,
    remainingTaskCount: null,
    connectionState: 'connected',
    lastError: null,
    updatedAt: 1739555000000,
  });

  assert.equal(parsed.publishedAt, 1739555000000);
});

test('parseDesktopSessionCommand validates scope, action and timestamp', () => {
  const parsed = parseDesktopSessionCommand({
    scope: {
      userId: ' user-1 ',
      companyId: ' company-1 ',
    },
    action: 'end',
    endDecision: 'mark_all_done',
    requestedAt: 1739555000000,
  });

  assert.deepEqual(parsed, {
    scope: {
      userId: 'user-1',
      companyId: 'company-1',
    },
    action: 'end',
    endDecision: 'mark_all_done',
    requestedAt: 1739555000000,
  });
});

test('parseDesktopSessionCommand rejects invalid command payloads', () => {
  assert.throws(
    () =>
      parseDesktopSessionCommand({
        scope: {
          userId: '',
          companyId: 'company-1',
        },
        action: 'start',
        requestedAt: 1,
      }),
    /userId must be a non-empty string/
  );
  assert.throws(
    () =>
      parseDesktopSessionCommand({
        scope: {
          userId: 'user-1',
          companyId: 'company-1',
        },
        action: 'noop',
        requestedAt: 1,
      }),
    /session action must be one of/
  );
  assert.throws(
    () =>
      parseDesktopSessionCommand({
        scope: {
          userId: 'user-1',
          companyId: 'company-1',
        },
        action: 'end',
        endDecision: 'close_anyway',
        requestedAt: 1,
      }),
    /endDecision must be one of/
  );
});

test('getDesktopSessionActionAvailability maps status to command availability', () => {
  assert.deepEqual(
    getDesktopSessionActionAvailability({
      status: 'IDLE',
      sessionId: null,
      effectiveDurationMs: 0,
      remainingTaskCount: null,
      connectionState: 'connected',
      lastError: null,
      updatedAt: 1,
      recordingIDE: null,
    }),
    { start: true, pause: false, resume: false, end: false }
  );
  assert.deepEqual(
    getDesktopSessionActionAvailability({
      status: 'RUNNING',
      sessionId: 'session-1',
      effectiveDurationMs: 1,
      remainingTaskCount: 2,
      connectionState: 'connected',
      lastError: null,
      updatedAt: 1,
      recordingIDE: null,
    }),
    { start: false, pause: true, resume: false, end: true }
  );
  assert.deepEqual(
    getDesktopSessionActionAvailability({
      status: 'PAUSED',
      sessionId: 'session-1',
      effectiveDurationMs: 1,
      remainingTaskCount: null,
      connectionState: 'connected',
      lastError: null,
      updatedAt: 1,
      recordingIDE: null,
    }),
    { start: false, pause: false, resume: true, end: true }
  );
});
