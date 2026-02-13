import test from 'node:test';
import assert from 'node:assert/strict';
import type { Id } from '../_generated/dataModel';
import { countContextSwitchesFromTaskActivations } from './performanceMetrics';

const taskA = 'taskA' as Id<'tasks'>;
const taskB = 'taskB' as Id<'tasks'>;
const taskC = 'taskC' as Id<'tasks'>;

test('counts switches from activation sequence with duplicate suppression', () => {
  const result = countContextSwitchesFromTaskActivations([
    { type: 'TASK_ACTIVATED', timestamp: 1000, taskId: taskA },
    { type: 'TASK_ACTIVATED', timestamp: 1500, taskId: taskA },
    { type: 'TASK_ACTIVATED', timestamp: 2000, taskId: taskB },
    { type: 'TASK_ACTIVATED', timestamp: 2500, taskId: taskB },
    { type: 'TASK_ACTIVATED', timestamp: 3000, taskId: taskC },
  ]);

  assert.equal(result.count, 2);
  assert.deepEqual(result.switchTimestamps, [2000, 3000]);
});

test('applies start/end range filtering', () => {
  const result = countContextSwitchesFromTaskActivations(
    [
      { type: 'TASK_ACTIVATED', timestamp: 1000, taskId: taskA },
      { type: 'TASK_ACTIVATED', timestamp: 2000, taskId: taskB },
      { type: 'TASK_ACTIVATED', timestamp: 3000, taskId: taskC },
    ],
    {
      startAt: 1500,
      endAt: 2900,
    }
  );

  assert.equal(result.count, 0);
  assert.deepEqual(result.switchTimestamps, []);
});

test('supports allowTask filtering', () => {
  const result = countContextSwitchesFromTaskActivations(
    [
      { type: 'TASK_ACTIVATED', timestamp: 1000, taskId: taskA },
      { type: 'TASK_ACTIVATED', timestamp: 2000, taskId: taskB },
      { type: 'TASK_ACTIVATED', timestamp: 3000, taskId: taskC },
    ],
    {
      allowTask: taskId => taskId !== taskB,
    }
  );

  assert.equal(result.count, 1);
  assert.deepEqual(result.switchTimestamps, [3000]);
});

test('returns zero when there are no eligible activation events', () => {
  const result = countContextSwitchesFromTaskActivations([
    { type: 'TASK_DEACTIVATED', timestamp: 1000, taskId: taskA },
    { type: 'SESSION_PAUSED', timestamp: 2000, payload: {} },
  ]);

  assert.equal(result.count, 0);
  assert.deepEqual(result.switchTimestamps, []);
});
