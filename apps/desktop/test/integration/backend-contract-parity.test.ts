import assert from 'node:assert/strict';
import test from 'node:test';

import { sessionStatusValues, taskStatusValues } from '@devsuite/shared';
import {
  getDesktopSessionActionAvailability,
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
