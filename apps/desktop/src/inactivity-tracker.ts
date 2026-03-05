import { clearInterval, setInterval } from 'node:timers';

export interface InactivityTrackerOptions {
  thresholdSeconds: number;
  onInactive: () => void;
  onActive: () => void;
  now?: () => number;
  pollIntervalMs?: number;
  setIntervalFn?: (
    callback: () => void,
    delayMs: number
  ) => ReturnType<typeof setInterval>;
  clearIntervalFn?: (timer: ReturnType<typeof setInterval>) => void;
}

export class InactivityTracker {
  private readonly thresholdMs: number;
  private readonly onInactiveCallback: () => void;
  private readonly onActiveCallback: () => void;
  private readonly getNow: () => number;
  private readonly pollIntervalMs: number;
  private readonly setIntervalFn: (
    callback: () => void,
    delayMs: number
  ) => ReturnType<typeof setInterval>;
  private readonly clearIntervalFn: (
    timer: ReturnType<typeof setInterval>
  ) => void;

  private isRunning = false;
  private isCurrentlyInactive = false;
  private lastActiveAtMs = 0;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: InactivityTrackerOptions) {
    this.thresholdMs = options.thresholdSeconds * 1000;
    this.onInactiveCallback = options.onInactive;
    this.onActiveCallback = options.onActive;
    this.getNow = options.now ?? Date.now;
    this.pollIntervalMs = Math.max(1_000, options.pollIntervalMs ?? 30_000);
    this.setIntervalFn =
      options.setIntervalFn ??
      ((callback, delayMs) => setInterval(callback, delayMs));
    this.clearIntervalFn = options.clearIntervalFn ?? clearInterval;
    this.lastActiveAtMs = this.getNow();
  }

  public start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.isCurrentlyInactive = false;
    this.lastActiveAtMs = this.getNow();
    this.intervalTimer = this.setIntervalFn(() => {
      this.tick();
    }, this.pollIntervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.intervalTimer) {
      this.clearIntervalFn(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public recordActivity(atMs?: number): void {
    if (!this.isRunning) {
      return;
    }

    this.lastActiveAtMs = atMs ?? this.getNow();

    if (this.isCurrentlyInactive) {
      this.isCurrentlyInactive = false;
      this.onActiveCallback();
    }
  }

  public tick(atMs?: number): void {
    if (!this.isRunning) {
      return;
    }

    const now = atMs ?? this.getNow();
    const elapsedMs = now - this.lastActiveAtMs;

    if (elapsedMs >= this.thresholdMs && !this.isCurrentlyInactive) {
      this.isCurrentlyInactive = true;
      this.onInactiveCallback();
    }
  }
}
