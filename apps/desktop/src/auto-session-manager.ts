import { clearTimeout, setTimeout } from 'node:timers';

import type { DesktopProcessEvent } from './process-monitor.js';
import type { DesktopSessionState } from './session-control.js';

interface AutoSessionTimerLike {
  setTimeout: (
    callback: () => void,
    delayMs: number
  ) => ReturnType<typeof setTimeout>;
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void;
}

export interface AutoSessionManagerSettings {
  enabled: boolean;
  warmupSeconds: number;
}

export interface AutoSessionManagerOptions {
  onAutoSessionStart: () => void | Promise<void>;
  onAutoSessionReviewRequested: (sessionId: string) => void | Promise<void>;
  timer?: AutoSessionTimerLike;
}

function isSessionActive(status: DesktopSessionState['status']): boolean {
  return status === 'RUNNING' || status === 'PAUSED';
}

function toProcessKey(event: { executable: string; pid: number }): string {
  return `${event.executable}:${event.pid}`;
}

function clampWarmupSeconds(value: number): number {
  if (!Number.isFinite(value)) {
    return 120;
  }
  return Math.max(30, Math.min(600, Math.trunc(value)));
}

export class AutoSessionManager {
  private readonly onAutoSessionStart: () => void | Promise<void>;
  private readonly onAutoSessionReviewRequested: (
    sessionId: string
  ) => void | Promise<void>;
  private readonly timer: AutoSessionTimerLike;

  private settings: AutoSessionManagerSettings = {
    enabled: false,
    warmupSeconds: 120,
  };
  private warmupTimer: ReturnType<typeof setTimeout> | null = null;
  private trackedDevProcesses = new Set<string>();
  private lastKnownSessionState: DesktopSessionState | null = null;

  constructor(options: AutoSessionManagerOptions) {
    this.onAutoSessionStart = options.onAutoSessionStart;
    this.onAutoSessionReviewRequested = options.onAutoSessionReviewRequested;
    this.timer = options.timer ?? {
      setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
      clearTimeout: timer => clearTimeout(timer),
    };
  }

  configure(settings: AutoSessionManagerSettings): void {
    this.settings = {
      enabled: settings.enabled,
      warmupSeconds: clampWarmupSeconds(settings.warmupSeconds),
    };
    this.reconcileWarmupTimer();
  }

  stop(): void {
    this.cancelWarmupTimer();
    this.trackedDevProcesses.clear();
    this.lastKnownSessionState = null;
  }

  handleProcessEvents(
    events: DesktopProcessEvent[],
    sessionState: DesktopSessionState
  ): void {
    this.lastKnownSessionState = sessionState;

    for (const event of events) {
      if (event.category !== 'ide') {
        continue;
      }

      const key = toProcessKey(event);
      if (event.type === 'process_started') {
        this.trackedDevProcesses.add(key);
      } else if (event.type === 'process_stopped') {
        this.trackedDevProcesses.delete(key);
      }
    }

    this.reconcileWarmupTimer();
  }

  handleSessionStateChange(
    previousState: DesktopSessionState,
    nextState: DesktopSessionState
  ): void {
    this.lastKnownSessionState = nextState;

    if (
      previousState.status !== 'IDLE' &&
      nextState.status === 'IDLE' &&
      previousState.sessionId &&
      previousState.isAutoCreated
    ) {
      void this.onAutoSessionReviewRequested(previousState.sessionId);
    }

    this.reconcileWarmupTimer();
  }

  private reconcileWarmupTimer(): void {
    if (
      !this.settings.enabled ||
      !this.lastKnownSessionState ||
      isSessionActive(this.lastKnownSessionState.status) ||
      this.trackedDevProcesses.size === 0
    ) {
      this.cancelWarmupTimer();
      return;
    }

    if (this.warmupTimer) {
      return;
    }

    this.warmupTimer = this.timer.setTimeout(() => {
      void this.onWarmupElapsed();
    }, this.settings.warmupSeconds * 1000);
  }

  private async onWarmupElapsed(): Promise<void> {
    this.warmupTimer = null;

    if (
      !this.settings.enabled ||
      !this.lastKnownSessionState ||
      this.lastKnownSessionState.status !== 'IDLE' ||
      this.trackedDevProcesses.size === 0
    ) {
      return;
    }

    await this.onAutoSessionStart();
    this.reconcileWarmupTimer();
  }

  private cancelWarmupTimer(): void {
    if (!this.warmupTimer) {
      return;
    }
    this.timer.clearTimeout(this.warmupTimer);
    this.warmupTimer = null;
  }
}
