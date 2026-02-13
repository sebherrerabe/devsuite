import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_MS,
  DEFAULT_RANGE_DAYS,
  MAX_RANGE_DAYS,
  resolveDashboardRange,
  splitIntervalByUtcDay,
} from './performanceDashboard';

test('resolveDashboardRange applies default window when startDate is missing', () => {
  const now = Date.UTC(2026, 1, 11, 12, 0, 0);
  const result = resolveDashboardRange(undefined, now, now);

  assert.equal(result.endAt, now);
  assert.equal(result.startAt, now - DEFAULT_RANGE_DAYS * DAY_MS);
});

test('resolveDashboardRange rejects invalid boundaries', () => {
  const now = Date.UTC(2026, 1, 11, 12, 0, 0);

  assert.throws(() => resolveDashboardRange(now, now, now), {
    message: 'startDate must be before endDate',
  });

  assert.throws(
    () => resolveDashboardRange(now - (MAX_RANGE_DAYS + 1) * DAY_MS, now, now),
    {
      message: `Date range cannot exceed ${MAX_RANGE_DAYS} days`,
    }
  );
});

test('splitIntervalByUtcDay splits intervals across day boundaries', () => {
  const startAt = Date.UTC(2026, 1, 10, 23, 30, 0);
  const endAt = Date.UTC(2026, 1, 11, 1, 0, 0);

  const segments = splitIntervalByUtcDay(startAt, endAt);

  assert.equal(segments.length, 2);
  assert.deepEqual(segments[0], {
    date: '2026-02-10',
    durationMs: 30 * 60 * 1000,
  });
  assert.deepEqual(segments[1], {
    date: '2026-02-11',
    durationMs: 60 * 60 * 1000,
  });
});
