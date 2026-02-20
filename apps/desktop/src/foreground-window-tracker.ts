/**
 * Foreground window tracker for strict-mode effective time.
 *
 * Polls active-win to detect when the user's selected IDE has foreground focus.
 * Emits IDE_FOCUS_GAINED / IDE_FOCUS_LOST on transitions only.
 * Handles system sleep/resume and tracker restart.
 */

import { clearInterval, setInterval } from 'node:timers';
import { activeWindow } from 'active-win';
import type { RuntimeLogWriter } from './runtime-logger.js';
import { runtimeLog } from './runtime-logger.js';

const DEFAULT_POLL_INTERVAL_MS = 1_500;
const MIN_POLL_INTERVAL_MS = 1_000;
const MAX_POLL_INTERVAL_MS = 3_000;

export interface IdeFocusPayload {
  executable: string;
  processId?: number;
  path?: string;
}

export type IdeFocusChangeCallback = (
  focused: boolean,
  payload: IdeFocusPayload
) => void | Promise<void>;

export interface ForegroundWindowTrackerOptions {
  recordingIDE: string;
  onFocusChange: IdeFocusChangeCallback;
  pollIntervalMs?: number;
  logger?: RuntimeLogWriter;
}

export function normalizeExecutable(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.endsWith('.exe') ? trimmed : `${trimmed}.exe`;
}

function getPathBasename(path: string | undefined): string {
  if (!path || typeof path !== 'string') return '';
  const parts = path.split(/[/\\]/);
  const basename = parts.pop() ?? '';
  return normalizeExecutable(basename);
}

export function matchesRecordingIDE(
  recordingIDE: string,
  owner: { name?: string; processId?: number; path?: string }
): boolean {
  const recNorm = normalizeExecutable(recordingIDE);
  if (!recNorm) return false;

  if (owner.path) {
    const pathNorm = getPathBasename(owner.path);
    if (pathNorm && recNorm === pathNorm) return true;
  }

  if (owner.name) {
    const nameNorm = normalizeExecutable(owner.name);
    if (nameNorm && recNorm === nameNorm) return true;
  }

  return false;
}

export function buildPayload(owner: {
  name?: string;
  processId?: number;
  path?: string;
}): IdeFocusPayload {
  const executable = owner.name
    ? normalizeExecutable(owner.name)
    : owner.path
      ? getPathBasename(owner.path)
      : '';
  return {
    executable: executable || 'unknown',
    processId: owner.processId,
    path: owner.path,
  };
}

export class ForegroundWindowTracker {
  private readonly recordingIDE: string;
  private readonly onFocusChange: IdeFocusChangeCallback;
  private readonly pollIntervalMs: number;
  private readonly logger: RuntimeLogWriter;
  private timer: ReturnType<typeof setInterval> | null = null;
  private isFocused = false;
  private isSuspended = false;

  constructor(options: ForegroundWindowTrackerOptions) {
    this.recordingIDE = normalizeExecutable(options.recordingIDE);
    this.onFocusChange = options.onFocusChange;
    const raw = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.pollIntervalMs = Math.max(
      MIN_POLL_INTERVAL_MS,
      Math.min(MAX_POLL_INTERVAL_MS, raw)
    );
    this.logger = options.logger ?? runtimeLog;
  }

  start(): void {
    if (this.timer) return;
    this.logger.info(
      'foreground-window-tracker',
      `starting: recordingIDE=${this.recordingIDE}, pollIntervalMs=${this.pollIntervalMs}`
    );
    void this.pollOnce();
    this.timer = setInterval(() => {
      void this.pollOnce();
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.info('foreground-window-tracker', 'stopped');
  }

  /**
   * Immediately poll and emit corrective state (for session start / tracker restart).
   */
  async triggerImmediatePoll(): Promise<void> {
    await this.pollOnce();
  }

  /**
   * Call when system is about to suspend. Treats as focus lost.
   */
  onSuspend(): void {
    if (this.isSuspended) return;
    this.isSuspended = true;
    if (this.isFocused) {
      this.isFocused = false;
      this.logger.debug(
        'foreground-window-tracker',
        'suspend: emitting IDE_FOCUS_LOST'
      );
      void this.onFocusChange(false, {
        executable: this.recordingIDE,
      });
    }
  }

  /**
   * Call when system has resumed. Re-polls and emits correct state.
   */
  async onResume(): Promise<void> {
    if (!this.isSuspended) return;
    this.isSuspended = false;
    this.logger.debug('foreground-window-tracker', 'resume: re-polling');
    await this.pollOnce();
  }

  private async pollOnce(): Promise<void> {
    if (this.isSuspended) return;

    try {
      const window = await activeWindow();
      const focused = !!(
        window?.owner && matchesRecordingIDE(this.recordingIDE, window.owner)
      );
      const payload = window?.owner
        ? buildPayload(window.owner)
        : { executable: this.recordingIDE };

      if (focused !== this.isFocused) {
        this.isFocused = focused;
        this.logger.debug(
          'foreground-window-tracker',
          `transition: focused=${focused}, executable=${payload.executable}`
        );
        await this.onFocusChange(focused, payload);
      }
    } catch (error) {
      this.logger.error(
        'foreground-window-tracker',
        `poll failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
