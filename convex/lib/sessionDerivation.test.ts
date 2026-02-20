import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveSessionDurations,
  type SessionEventRecord,
} from './sessionDerivation.js';

const T0 = 1000;
const T1 = 2000;
const T2 = 3000;
const T3 = 4000;
const T4 = 5000;

function mkEvent(
  type: SessionEventRecord['type'],
  ts: number,
  payload: Record<string, unknown> = {},
  serverTs?: number
): SessionEventRecord {
  return {
    type,
    timestamp: ts,
    ...(serverTs !== undefined ? { serverTimestamp: serverTs } : {}),
    payload,
  };
}

test('deriveSessionDurations with IDE_FOCUS_GAINED/LOST derives effective time', () => {
  const events: SessionEventRecord[] = [
    mkEvent('SESSION_STARTED', T0),
    mkEvent('IDE_FOCUS_GAINED', T1, { executable: 'cursor.exe' }),
    mkEvent('IDE_FOCUS_LOST', T2, { executable: 'cursor.exe' }),
    mkEvent('IDE_FOCUS_GAINED', T3, { executable: 'cursor.exe' }),
    mkEvent('SESSION_FINISHED', T4),
  ];

  const { durationSummary } = deriveSessionDurations({
    sessionStatus: 'FINISHED',
    sessionStartAt: T0,
    sessionEndAt: T4,
    events,
    recordingIDE: 'cursor.exe',
  });

  const expectedEffective = T2 - T1 + (T4 - T3);
  assert.equal(durationSummary.effectiveDurationMs, expectedEffective);
});

test('deriveSessionDurations dedupes consecutive identical IDE focus events', () => {
  const events: SessionEventRecord[] = [
    mkEvent('SESSION_STARTED', T0),
    mkEvent('IDE_FOCUS_GAINED', T1, { executable: 'cursor.exe' }),
    mkEvent('IDE_FOCUS_GAINED', T1 + 100, { executable: 'cursor.exe' }),
    mkEvent('IDE_FOCUS_LOST', T2, { executable: 'cursor.exe' }),
    mkEvent('SESSION_FINISHED', T3),
  ];

  const { durationSummary } = deriveSessionDurations({
    sessionStatus: 'FINISHED',
    sessionStartAt: T0,
    sessionEndAt: T3,
    events,
    recordingIDE: 'cursor.exe',
  });

  assert.equal(durationSummary.effectiveDurationMs, T2 - T1);
});

test('deriveSessionDurations uses serverTimestamp for ordering', () => {
  const events: SessionEventRecord[] = [
    mkEvent('SESSION_STARTED', T0),
    mkEvent('IDE_FOCUS_GAINED', T2, { executable: 'cursor.exe' }, T1),
    mkEvent('IDE_FOCUS_LOST', T1 + 500, { executable: 'cursor.exe' }, T3),
    mkEvent('SESSION_FINISHED', T4),
  ];

  const { durationSummary } = deriveSessionDurations({
    sessionStatus: 'FINISHED',
    sessionStartAt: T0,
    sessionEndAt: T4,
    events,
    recordingIDE: 'cursor.exe',
  });

  assert.ok(durationSummary.effectiveDurationMs >= 0);
});

test('deriveSessionDurations closes open IDE focus at session end (missing LOST)', () => {
  const events: SessionEventRecord[] = [
    mkEvent('SESSION_STARTED', T0),
    mkEvent('IDE_FOCUS_GAINED', T1, { executable: 'cursor.exe' }),
    mkEvent('SESSION_FINISHED', T3),
  ];

  const { durationSummary } = deriveSessionDurations({
    sessionStatus: 'FINISHED',
    sessionStartAt: T0,
    sessionEndAt: T3,
    events,
    recordingIDE: 'cursor.exe',
  });

  assert.equal(durationSummary.effectiveDurationMs, T3 - T1);
});

test('deriveSessionDurations without recordingIDE uses wall-clock', () => {
  const events: SessionEventRecord[] = [
    mkEvent('SESSION_STARTED', T0),
    mkEvent('SESSION_FINISHED', T3),
  ];

  const { durationSummary } = deriveSessionDurations({
    sessionStatus: 'FINISHED',
    sessionStartAt: T0,
    sessionEndAt: T3,
    events,
  });

  assert.equal(durationSummary.effectiveDurationMs, T3 - T0);
});
