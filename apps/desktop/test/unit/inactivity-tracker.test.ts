import assert from 'node:assert/strict';
import test from 'node:test';
import { setInterval } from 'node:timers';

import { InactivityTracker } from '../../src/inactivity-tracker.js';

function createHarness(options?: {
  thresholdSeconds?: number;
  pollIntervalMs?: number;
}) {
  let nowMs = 1_000;
  let pollCallback: (() => void) | null = null;
  let clearIntervalCalled = false;

  let inactiveCount = 0;
  let activeCount = 0;

  const tracker = new InactivityTracker({
    thresholdSeconds: options?.thresholdSeconds ?? 300,
    pollIntervalMs: options?.pollIntervalMs ?? 30_000,
    onInactive: () => {
      inactiveCount += 1;
    },
    onActive: () => {
      activeCount += 1;
    },
    now: () => nowMs,
    setIntervalFn: callback => {
      pollCallback = callback;
      return 1 as ReturnType<typeof setInterval>;
    },
    clearIntervalFn: () => {
      clearIntervalCalled = true;
      pollCallback = null;
    },
  });

  return {
    tracker,
    setNow(nextNowMs: number) {
      nowMs = nextNowMs;
    },
    triggerPoll() {
      pollCallback?.();
    },
    getInactiveCount() {
      return inactiveCount;
    },
    getActiveCount() {
      return activeCount;
    },
    wasClearIntervalCalled() {
      return clearIntervalCalled;
    },
  };
}

test('fires onInactive after threshold with no activity', () => {
  const harness = createHarness();
  harness.tracker.start();
  harness.setNow(301_000);
  harness.triggerPoll();

  assert.equal(harness.getInactiveCount(), 1);
  assert.equal(harness.getActiveCount(), 0);
});

test('recordActivity() resets the inactivity clock', () => {
  const harness = createHarness();
  harness.tracker.start();
  harness.setNow(150_000);
  harness.tracker.recordActivity();
  harness.setNow(301_000);
  harness.triggerPoll();
  assert.equal(harness.getInactiveCount(), 0);

  harness.setNow(451_000);
  harness.triggerPoll();
  assert.equal(harness.getInactiveCount(), 1);
});

test('fires onActive when activity resumes after inactivity', () => {
  const harness = createHarness();
  harness.tracker.start();
  harness.setNow(301_000);
  harness.triggerPoll();
  assert.equal(harness.getInactiveCount(), 1);

  harness.setNow(305_000);
  harness.tracker.recordActivity();
  assert.equal(harness.getActiveCount(), 1);
});

test('does not fire onInactive if activity happened within threshold', () => {
  const harness = createHarness();
  harness.tracker.start();
  harness.setNow(120_000);
  harness.tracker.recordActivity();
  harness.setNow(350_000);
  harness.triggerPoll();

  assert.equal(harness.getInactiveCount(), 0);
});

test('stop() cancels pending poll timers', () => {
  const harness = createHarness();
  harness.tracker.start();
  harness.tracker.stop();

  assert.equal(harness.wasClearIntervalCalled(), true);
  harness.setNow(500_000);
  harness.triggerPoll();
  assert.equal(harness.getInactiveCount(), 0);
});

test('respects configurable threshold', () => {
  const harness = createHarness({
    thresholdSeconds: 60,
  });
  harness.tracker.start();
  harness.setNow(50_000);
  harness.triggerPoll();
  assert.equal(harness.getInactiveCount(), 0);

  harness.setNow(62_000);
  harness.triggerPoll();
  assert.equal(harness.getInactiveCount(), 1);
});

test('does not fire duplicate onInactive without intervening onActive', () => {
  const harness = createHarness();
  harness.tracker.start();
  harness.setNow(301_000);
  harness.triggerPoll();
  harness.setNow(330_000);
  harness.triggerPoll();
  harness.setNow(360_000);
  harness.triggerPoll();

  assert.equal(harness.getInactiveCount(), 1);
  assert.equal(harness.getActiveCount(), 0);
});
