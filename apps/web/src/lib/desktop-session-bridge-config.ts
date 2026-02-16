export const DESKTOP_STATE_PUBLISH_INTERVAL_MS = 5_000;

export function createDesktopPublishTimestamps(nowMs: number): {
  updatedAt: number;
  publishedAt: number;
} {
  return {
    updatedAt: nowMs,
    publishedAt: nowMs,
  };
}
