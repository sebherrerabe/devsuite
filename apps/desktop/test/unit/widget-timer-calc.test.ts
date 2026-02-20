import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateWidgetEffectiveDuration,
  smoothWidgetTimerTick,
  TIMER_JUMP_THRESHOLD_MS,
} from '../../src/widget-timer.js';

test('calculateWidgetEffectiveDuration uses publishedAt while running', () => {
  const duration = calculateWidgetEffectiveDuration({
    state: {
      status: 'RUNNING',
      sessionId: 's1',
      effectiveDurationMs: 12_000,
      remainingTaskCount: 2,
      connectionState: 'connected',
      lastError: null,
      updatedAt: 100,
      publishedAt: 200,
    },
    nowMs: 1_200,
  });

  assert.equal(duration, 13_000);
});

test('calculateWidgetEffectiveDuration returns base when recordingIDE set', () => {
  const duration = calculateWidgetEffectiveDuration({
    state: {
      status: 'RUNNING',
      sessionId: 's1',
      effectiveDurationMs: 12_000,
      remainingTaskCount: 2,
      connectionState: 'connected',
      lastError: null,
      updatedAt: 100,
      publishedAt: 200,
      recordingIDE: 'cursor.exe',
    },
    nowMs: 1_200,
  });

  assert.equal(duration, 12_000);
});

test('calculateWidgetEffectiveDuration returns base when paused', () => {
  const duration = calculateWidgetEffectiveDuration({
    state: {
      status: 'PAUSED',
      sessionId: 's1',
      effectiveDurationMs: 12_000,
      remainingTaskCount: 2,
      connectionState: 'connected',
      lastError: null,
      updatedAt: 100,
      publishedAt: 200,
    },
    nowMs: 1_200,
  });

  assert.equal(duration, 12_000);
});

test('smoothWidgetTimerTick avoids >2s single-tick jumps when smoothing starts', () => {
  const next = smoothWidgetTimerTick({
    state: {
      displayedMs: 10_000,
      targetMs: 10_000,
      smoothingUntilMs: 0,
    },
    rawMs: 20_000,
    nowMs: 1_000,
  });

  assert.ok(next.displayedMs > 10_000);
  assert.ok(next.displayedMs - 10_000 < TIMER_JUMP_THRESHOLD_MS);
  assert.equal(next.targetMs, 20_000);
  assert.equal(next.smoothingUntilMs, 2_000);
});
