/**
 * Foreground window tracker for strict-mode effective time.
 *
 * Polls active-win to detect when the user's selected IDE has foreground focus.
 * Emits IDE_FOCUS_GAINED / IDE_FOCUS_LOST on transitions only.
 * Handles system sleep/resume and tracker restart.
 */

import { clearInterval, setInterval } from 'node:timers';
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
  recordingExecutable?: string | null;
  watchList: string[];
  onFocusChange: IdeFocusChangeCallback;
  onAnyDevFocusChange?: (
    payload: IdeFocusPayload,
    focused: boolean
  ) => void | Promise<void>;
  onActiveTick?: (payload: IdeFocusPayload) => void;
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

export function matchesWatchList(
  watchList: string[],
  owner: { name?: string; processId?: number; path?: string }
): string | null {
  if (owner.path) {
    const pathNorm = getPathBasename(owner.path);
    if (pathNorm && watchList.includes(pathNorm)) return pathNorm;
  }

  if (owner.name) {
    const nameNorm = normalizeExecutable(owner.name);
    if (nameNorm && watchList.includes(nameNorm)) return nameNorm;
  }

  return null;
}

function matchesExecutable(
  executable: string,
  owner: { name?: string; processId?: number; path?: string }
): boolean {
  const normalizedExecutable = normalizeExecutable(executable);
  if (!normalizedExecutable) {
    return false;
  }

  const byPath = getPathBasename(owner.path);
  if (byPath && byPath === normalizedExecutable) {
    return true;
  }

  const byName = owner.name ? normalizeExecutable(owner.name) : '';
  return !!byName && byName === normalizedExecutable;
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
  const payload: IdeFocusPayload = {
    executable: executable || 'unknown',
  };
  if (owner.processId !== undefined) {
    payload.processId = owner.processId;
  }
  if (owner.path !== undefined) {
    payload.path = owner.path;
  }
  return payload;
}

export class ForegroundWindowTracker {
  private readonly recordingExecutable: string | null;
  private readonly watchList: string[];
  private readonly onFocusChange: IdeFocusChangeCallback;
  private readonly onAnyDevFocusChange:
    | ((payload: IdeFocusPayload, focused: boolean) => void | Promise<void>)
    | undefined;
  private readonly onActiveTick:
    | ((payload: IdeFocusPayload) => void)
    | undefined;
  private readonly pollIntervalMs: number;
  private readonly logger: RuntimeLogWriter;
  private timer: ReturnType<typeof setInterval> | null = null;
  private isFocused = false;
  private isSuspended = false;

  constructor(options: ForegroundWindowTrackerOptions) {
    this.recordingExecutable = options.recordingExecutable
      ? normalizeExecutable(options.recordingExecutable)
      : null;
    this.watchList = options.watchList.map(normalizeExecutable);
    this.onFocusChange = options.onFocusChange;
    this.onAnyDevFocusChange = options.onAnyDevFocusChange;
    this.onActiveTick = options.onActiveTick;
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
      `starting: recordingExecutable=${this.recordingExecutable ?? 'none'}, watchList=[${this.watchList.join(',')}], pollIntervalMs=${this.pollIntervalMs}`
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
        executable: 'unknown',
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
      const { activeWindow } = await import('active-win');
      const window = await activeWindow();
      const matchedExecutable = window?.owner
        ? matchesWatchList(this.watchList, window.owner)
        : null;
      const focused = !!matchedExecutable;
      const recordingFocused =
        window?.owner && this.recordingExecutable
          ? matchesExecutable(this.recordingExecutable, window.owner)
          : focused;
      const payload = window?.owner
        ? buildPayload(window.owner)
        : { executable: matchedExecutable || 'unknown' };

      if (recordingFocused !== this.isFocused) {
        this.isFocused = recordingFocused;
        this.logger.debug(
          'foreground-window-tracker',
          `transition: focused=${recordingFocused}, executable=${payload.executable}`
        );
        await this.onFocusChange(recordingFocused, payload);
      }

      if (this.onAnyDevFocusChange) {
        await this.onAnyDevFocusChange(payload, focused);
      }

      if (focused && this.onActiveTick) {
        this.onActiveTick(payload);
      }
    } catch (error) {
      this.logger.error(
        'foreground-window-tracker',
        `poll failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
