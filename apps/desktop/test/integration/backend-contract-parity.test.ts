import assert from 'node:assert/strict';
import test from 'node:test';

import { sessionStatusValues, taskStatusValues } from '@devsuite/shared';
import {
  getDesktopSessionActionAvailability,
  parseDesktopSessionCommand,
  parseDesktopSessionState,
} from '../../src/session-control.js';

const BASE_STATE = {
  sessionId: 'session-1',
  effectiveDurationMs: 1_000,
  remainingTaskCount: 2,
  connectionState: 'connected' as const,
  lastError: null,
  updatedAt: 1_739_555_000_000,
};

test('desktop RUNNING/PAUSED action availability matches backend transition guards', () => {
  assert.equal(sessionStatusValues.includes('RUNNING'), true);
  assert.equal(sessionStatusValues.includes('PAUSED'), true);

  const runningAvailability = getDesktopSessionActionAvailability({
    ...BASE_STATE,
    status: 'RUNNING',
  });
  assert.deepEqual(runningAvailability, {
    start: false,
    pause: true,
    resume: false,
    end: true,
  });

  const pausedAvailability = getDesktopSessionActionAvailability({
    ...BASE_STATE,
    status: 'PAUSED',
  });
  assert.deepEqual(pausedAvailability, {
    start: false,
    pause: false,
    resume: true,
    end: true,
  });
});

test('desktop IDLE state intentionally rejects terminal backend statuses', () => {
  assert.throws(
    () =>
      parseDesktopSessionState({
        ...BASE_STATE,
        status: 'FINISHED',
      }),
    /session status must be one of/
  );
  assert.throws(
    () =>
      parseDesktopSessionState({
        ...BASE_STATE,
        status: 'CANCELLED',
      }),
    /session status must be one of/
  );
});

test('remaining-task semantics stay aligned with shared task status contract', () => {
  const remainingStatuses = taskStatusValues
    .filter(status => status !== 'done' && status !== 'cancelled')
    .sort();

  assert.deepEqual(remainingStatuses, ['blocked', 'in_progress', 'todo']);
});

test('desktop end-session command contract supports explicit end decisions', () => {
  const keepOngoing = parseDesktopSessionCommand({
    scope: { userId: 'user-1', companyId: 'company-1' },
    action: 'end',
    endDecision: 'keep_ongoing',
    requestedAt: 1,
  });
  assert.equal(keepOngoing.endDecision, 'keep_ongoing');

  const markDone = parseDesktopSessionCommand({
    scope: { userId: 'user-1', companyId: 'company-1' },
    action: 'end',
    endDecision: 'mark_all_done',
    requestedAt: 2,
  });
  assert.equal(markDone.endDecision, 'mark_all_done');

  const cancel = parseDesktopSessionCommand({
    scope: { userId: 'user-1', companyId: 'company-1' },
    action: 'end',
    endDecision: 'cancel',
    requestedAt: 3,
  });
  assert.equal(cancel.endDecision, 'cancel');
});
