import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout } from 'node:timers';

import { AutoSessionManager } from '../../src/auto-session-manager.js';
import type { DesktopSessionState } from '../../src/session-control.js';

function createSessionState(
  overrides: Partial<DesktopSessionState> = {}
): DesktopSessionState {
  return {
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
    ...overrides,
  };
}

function createHarness() {
  const timers = new Map<number, () => void>();
  const timerDelays = new Map<number, number>();
  let nextTimerId = 1;
  let autoSessionStartCount = 0;
  const reviewedSessionIds: string[] = [];

  const manager = new AutoSessionManager({
    onAutoSessionStart: async () => {
      autoSessionStartCount += 1;
    },
    onAutoSessionReviewRequested: async sessionId => {
      reviewedSessionIds.push(sessionId);
    },
    timer: {
      setTimeout: (callback, delayMs) => {
        const id = nextTimerId++;
        timers.set(id, callback);
        timerDelays.set(id, delayMs);
        return id as ReturnType<typeof setTimeout>;
      },
      clearTimeout: timer => {
        const id = timer as unknown as number;
        timers.delete(id);
        timerDelays.delete(id);
      },
    },
  });

  return {
    manager,
    configure(
      overrides?: Partial<{ enabled: boolean; warmupSeconds: number }>
    ) {
      manager.configure({
        enabled: overrides?.enabled ?? true,
        warmupSeconds: overrides?.warmupSeconds ?? 120,
      });
    },
    getActiveTimerCount() {
      return timers.size;
    },
    getFirstTimerDelayMs() {
      const first = Array.from(timerDelays.values())[0];
      return first ?? null;
    },
    async runFirstTimer() {
      const firstEntry = Array.from(timers.entries())[0];
      if (!firstEntry) {
        return;
      }
      const [timerId, callback] = firstEntry;
      timers.delete(timerId);
      timerDelays.delete(timerId);
      await callback();
    },
    getAutoSessionStartCount() {
      return autoSessionStartCount;
    },
    getReviewedSessionIds() {
      return [...reviewedSessionIds];
    },
  };
}

test('starts warm-up timer on devCore process_started with no active session', () => {
  const harness = createHarness();
  harness.configure();

  harness.manager.handleProcessEvents(
    [
      {
        type: 'process_started',
        executable: 'code.exe',
        pid: 101,
        category: 'ide',
        timestamp: 1_000,
      },
    ],
    createSessionState()
  );

  assert.equal(harness.getActiveTimerCount(), 1);
  assert.equal(harness.getFirstTimerDelayMs(), 120_000);
});

test('does NOT start warm-up if session already RUNNING or PAUSED', () => {
  const harness = createHarness();
  harness.configure();

  harness.manager.handleProcessEvents(
    [
      {
        type: 'process_started',
        executable: 'code.exe',
        pid: 101,
        category: 'ide',
        timestamp: 1_000,
      },
    ],
    createSessionState({
      status: 'RUNNING',
      sessionId: 'session-1',
    })
  );
  assert.equal(harness.getActiveTimerCount(), 0);

  harness.manager.handleProcessEvents(
    [
      {
        type: 'process_started',
        executable: 'code.exe',
        pid: 202,
        category: 'ide',
        timestamp: 2_000,
      },
    ],
    createSessionState({
      status: 'PAUSED',
      sessionId: 'session-2',
    })
  );
  assert.equal(harness.getActiveTimerCount(), 0);
});

test('creates session after warm-up completes', async () => {
  const harness = createHarness();
  harness.configure();

  harness.manager.handleProcessEvents(
    [
      {
        type: 'process_started',
        executable: 'code.exe',
        pid: 101,
        category: 'ide',
        timestamp: 1_000,
      },
    ],
    createSessionState()
  );
  await harness.runFirstTimer();

  assert.equal(harness.getAutoSessionStartCount(), 1);
});

test('cancels warm-up if process_stopped before warm-up completes', async () => {
  const harness = createHarness();
  harness.configure();

  harness.manager.handleProcessEvents(
    [
      {
        type: 'process_started',
        executable: 'code.exe',
        pid: 101,
        category: 'ide',
        timestamp: 1_000,
      },
    ],
    createSessionState()
  );
  assert.equal(harness.getActiveTimerCount(), 1);

  harness.manager.handleProcessEvents(
    [
      {
        type: 'process_stopped',
        executable: 'code.exe',
        pid: 101,
        category: 'ide',
        timestamp: 2_000,
      },
    ],
    createSessionState()
  );

  assert.equal(harness.getActiveTimerCount(), 0);
  await harness.runFirstTimer();
  assert.equal(harness.getAutoSessionStartCount(), 0);
});

test('does not create duplicate sessions on multiple process_started events', async () => {
  const harness = createHarness();
  harness.configure();

  harness.manager.handleProcessEvents(
    [
      {
        type: 'process_started',
        executable: 'code.exe',
        pid: 101,
        category: 'ide',
        timestamp: 1_000,
      },
      {
        type: 'process_started',
        executable: 'cursor.exe',
        pid: 202,
        category: 'ide',
        timestamp: 1_010,
      },
    ],
    createSessionState()
  );

  assert.equal(harness.getActiveTimerCount(), 1);
  await harness.runFirstTimer();
  assert.equal(harness.getAutoSessionStartCount(), 1);
});

test('triggers post-session review on auto-session end', () => {
  const harness = createHarness();
  harness.configure();

  harness.manager.handleSessionStateChange(
    createSessionState({
      status: 'RUNNING',
      sessionId: 'auto-session-1',
      isAutoCreated: true,
    }),
    createSessionState({
      status: 'IDLE',
      sessionId: null,
    })
  );

  assert.deepEqual(harness.getReviewedSessionIds(), ['auto-session-1']);
});

test('respects autoSession=false toggle (no-op when disabled)', () => {
  const harness = createHarness();
  harness.configure({
    enabled: false,
  });

  harness.manager.handleProcessEvents(
    [
      {
        type: 'process_started',
        executable: 'code.exe',
        pid: 101,
        category: 'ide',
        timestamp: 1_000,
      },
    ],
    createSessionState()
  );

  assert.equal(harness.getActiveTimerCount(), 0);
});
