/**
 * Shared helpers for performance dashboard derivation.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;

export function toUtcDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function toUtcDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function resolveDashboardRange(
  startDate: number | undefined,
  endDate: number | undefined,
  now: number
) {
  const endAt = endDate ?? now;
  const startAt = startDate ?? endAt - DEFAULT_RANGE_DAYS * DAY_MS;

  if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
    throw new Error('Invalid date range');
  }

  if (startAt >= endAt) {
    throw new Error('startDate must be before endDate');
  }

  if (endAt - startAt > MAX_RANGE_DAYS * DAY_MS) {
    throw new Error(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
  }

  return { startAt, endAt };
}

export function splitIntervalByUtcDay(startAt: number, endAt: number) {
  const segments: { date: string; durationMs: number }[] = [];
  let cursor = startAt;

  while (cursor < endAt) {
    const dayStart = toUtcDayStart(cursor);
    const nextDayStart = dayStart + DAY_MS;
    const segmentEnd = Math.min(endAt, nextDayStart);
    segments.push({
      date: toUtcDayKey(cursor),
      durationMs: segmentEnd - cursor,
    });
    cursor = segmentEnd;
  }

  return segments;
}
