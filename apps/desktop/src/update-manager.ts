import { EventEmitter } from 'node:events';
import {
  clearInterval,
  clearTimeout,
  setInterval,
  setTimeout,
} from 'node:timers';

import electronUpdater from 'electron-updater';
import type { AppUpdater } from 'electron-updater';

import {
  loadDesktopAutoUpdatePreferences,
  saveDesktopAutoUpdatePreferences,
} from './settings-store.js';
import type { DesktopSessionStatus } from './session-control.js';
import {
  coerceReleaseNotesText,
  deriveDesktopUpdaterState,
  shouldPerformUpdateCheck,
  type DesktopAutoUpdatePreferences,
  type DesktopUpdaterConsent,
  type DesktopUpdaterState,
  type DesktopUpdaterStatus,
} from './update-manager-model.js';

const DEFAULT_INITIAL_CHECK_DELAY_MS = 30_000;
const DEFAULT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_RESUME_MIN_INTERVAL_MS = 2 * 60 * 60 * 1000;
const DEFAULT_READY_PROMPT_REMINDER_MS = 24 * 60 * 60 * 1000;
const { autoUpdater: defaultAutoUpdater } = electronUpdater;

type UpdateManagerLogLevel = 'debug' | 'info' | 'warn' | 'error';

type UpdateManagerLogger = {
  debug?: (scope: string, message: string) => void;
  info?: (scope: string, message: string) => void;
  warn?: (scope: string, message: string) => void;
  error?: (scope: string, message: string) => void;
};

type UpdateManagerOptions = {
  currentVersion: string;
  isPackaged: boolean;
  initialSessionStatus: DesktopSessionStatus;
  installUpdate: () => Promise<void> | void;
  autoUpdater?: AppUpdater;
  feedUrlOverride?: string | null;
  disableAutoUpdate?: boolean;
  checkIntervalMs?: number | null;
  logger?: UpdateManagerLogger;
};

function normalizeVersion(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return 'Desktop updater failed.';
}

function normalizeIntervalMs(
  value: number | null | undefined,
  fallbackValue: number
): number {
  if (!Number.isFinite(value)) {
    return fallbackValue;
  }

  const normalized = Math.trunc(value as number);
  return normalized > 0 ? normalized : fallbackValue;
}

export class UpdateManager extends EventEmitter<{
  'state-changed': [DesktopUpdaterState];
  'restart-prompt-requested': [DesktopUpdaterState];
}> {
  private readonly autoUpdater: AppUpdater;
  private readonly currentVersion: string;
  private readonly feedUrlOverride: string | null;
  private readonly isPackaged: boolean;
  private readonly installUpdateCallback: () => Promise<void> | void;
  private readonly disableAutoUpdate: boolean;
  private readonly checkIntervalMs: number;
  private readonly logger: UpdateManagerLogger;
  private autoUpdaterConfigured = false;
  private lifecycleStatus: DesktopUpdaterStatus = 'idle';
  private sessionStatus: DesktopSessionStatus;
  private availableVersion: string | null = null;
  private downloadedVersion: string | null = null;
  private releaseNotes: string | null = null;
  private error: string | null = null;
  private lastCheckedAt: number | null = null;
  private preferences: DesktopAutoUpdatePreferences | null = null;
  private state: DesktopUpdaterState;
  private startupCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private periodicCheckTimer: ReturnType<typeof setInterval> | null = null;
  private readyPromptReminderTimer: ReturnType<typeof setTimeout> | null = null;
  private readyPromptSuppressedUntilMs: number | null = null;
  private disabledReason: string | null = null;

  constructor(options: UpdateManagerOptions) {
    super();
    this.autoUpdater = options.autoUpdater ?? defaultAutoUpdater;
    this.currentVersion = options.currentVersion;
    this.feedUrlOverride = options.feedUrlOverride?.trim() || null;
    this.isPackaged = options.isPackaged;
    this.installUpdateCallback = options.installUpdate;
    this.disableAutoUpdate = options.disableAutoUpdate === true;
    this.checkIntervalMs = normalizeIntervalMs(
      options.checkIntervalMs,
      DEFAULT_CHECK_INTERVAL_MS
    );
    this.logger = options.logger ?? {};
    this.sessionStatus = options.initialSessionStatus;
    this.state = deriveDesktopUpdaterState({
      currentVersion: this.currentVersion,
      consent: 'unset',
      lifecycleStatus: this.lifecycleStatus,
      sessionStatus: this.sessionStatus,
      lastCheckedAt: this.lastCheckedAt,
      availableVersion: this.availableVersion,
      downloadedVersion: this.downloadedVersion,
      releaseNotes: this.releaseNotes,
      error: this.error,
    });
  }

  async start(): Promise<DesktopUpdaterState> {
    this.preferences = await loadDesktopAutoUpdatePreferences();
    this.disabledReason = this.resolveDisabledReason();
    if (!this.disabledReason) {
      this.configureAutoUpdater();
    } else {
      this.log('info', this.disabledReason);
    }

    this.emitState();
    this.refreshBackgroundSchedule();
    return this.getState();
  }

  dispose(): void {
    this.clearBackgroundSchedule();
    this.clearReadyPromptReminder();
    this.removeAllListeners();
  }

  getState(): DesktopUpdaterState {
    return this.state;
  }

  async setConsent(
    consent: Exclude<DesktopUpdaterConsent, 'unset'>
  ): Promise<DesktopUpdaterState> {
    const nextPreferences = await this.persistPreferences({
      consent,
      consentUpdatedAt: Date.now(),
      dismissedReadyVersion: null,
    });

    this.preferences = nextPreferences;
    this.error = this.disabledReason;
    this.emitState();
    this.refreshBackgroundSchedule();

    if (consent === 'enabled') {
      if (this.lifecycleStatus === 'available') {
        void this.downloadUpdate().catch(() => {});
      } else if (
        !this.disabledReason &&
        this.lifecycleStatus !== 'checking' &&
        this.lifecycleStatus !== 'downloading' &&
        this.lifecycleStatus !== 'downloaded'
      ) {
        void this.checkForUpdates().catch(() => {});
      }
    }

    return this.getState();
  }

  async checkForUpdates(): Promise<DesktopUpdaterState> {
    if (this.disabledReason) {
      this.error = this.disabledReason;
      this.lifecycleStatus = 'error';
      this.emitState();
      return this.getState();
    }

    this.configureAutoUpdater();
    this.lifecycleStatus = 'checking';
    this.error = null;
    this.emitState();

    try {
      await this.autoUpdater.checkForUpdates();
      return this.getState();
    } catch (error) {
      this.handleUpdaterError(error);
      return this.getState();
    }
  }

  async downloadUpdate(): Promise<DesktopUpdaterState> {
    if (this.disabledReason) {
      this.error = this.disabledReason;
      this.lifecycleStatus = 'error';
      this.emitState();
      return this.getState();
    }

    if (
      this.lifecycleStatus !== 'available' &&
      this.lifecycleStatus !== 'downloading'
    ) {
      return this.getState();
    }

    if (this.lifecycleStatus !== 'downloading') {
      this.lifecycleStatus = 'downloading';
      this.error = null;
      this.emitState();
    }

    try {
      await this.autoUpdater.downloadUpdate();
      return this.getState();
    } catch (error) {
      this.handleUpdaterError(error);
      return this.getState();
    }
  }

  async installUpdate(): Promise<void> {
    if (this.lifecycleStatus !== 'downloaded' || !this.downloadedVersion) {
      return;
    }

    await this.persistPreferences({
      consent: this.getConsent(),
      consentUpdatedAt: this.preferences?.consentUpdatedAt ?? null,
      dismissedReadyVersion: null,
    });
    this.clearReadyPromptReminder();
    this.readyPromptSuppressedUntilMs = null;
    await this.installUpdateCallback();
  }

  quitAndInstallNow(): void {
    this.autoUpdater.quitAndInstall(false, true);
  }

  async dismissRestartPrompt(): Promise<DesktopUpdaterState> {
    if (this.lifecycleStatus !== 'downloaded' || !this.downloadedVersion) {
      return this.getState();
    }

    this.preferences = await this.persistPreferences({
      consent: this.getConsent(),
      consentUpdatedAt: this.preferences?.consentUpdatedAt ?? null,
      dismissedReadyVersion: this.downloadedVersion,
    });
    this.readyPromptSuppressedUntilMs =
      Date.now() + DEFAULT_READY_PROMPT_REMINDER_MS;
    this.scheduleReadyPromptReminder();
    this.emitState();
    return this.getState();
  }

  handleSessionStatusChanged(sessionStatus: DesktopSessionStatus): void {
    const previousDeferred = this.state.deferredUntilSessionEnd;
    this.sessionStatus = sessionStatus;
    this.emitState();

    if (
      this.lifecycleStatus === 'downloaded' &&
      previousDeferred &&
      !this.state.deferredUntilSessionEnd
    ) {
      this.requestRestartPromptIfEligible();
    }
  }

  shouldCheckOnResume(nowMs = Date.now()): boolean {
    return shouldPerformUpdateCheck({
      consent: this.getConsent(),
      lastCheckedAt: this.lastCheckedAt,
      minimumIntervalMs: DEFAULT_RESUME_MIN_INTERVAL_MS,
      nowMs,
    });
  }

  private resolveDisabledReason(): string | null {
    if (this.disableAutoUpdate) {
      return 'Desktop auto-update disabled by environment override.';
    }

    if (!this.isPackaged && !this.feedUrlOverride) {
      return 'Desktop auto-update is unavailable in local development builds.';
    }

    return null;
  }

  private getConsent(): DesktopUpdaterConsent {
    return this.preferences?.consent ?? 'unset';
  }

  private async persistPreferences(
    nextPreferences: DesktopAutoUpdatePreferences
  ): Promise<DesktopAutoUpdatePreferences> {
    return await saveDesktopAutoUpdatePreferences(nextPreferences);
  }

  private configureAutoUpdater(): void {
    if (this.autoUpdaterConfigured || this.disabledReason) {
      return;
    }

    this.autoUpdaterConfigured = true;
    this.autoUpdater.autoDownload = false;
    this.autoUpdater.autoInstallOnAppQuit = false;
    this.autoUpdater.allowPrerelease = false;

    if (this.feedUrlOverride) {
      this.autoUpdater.setFeedURL({
        provider: 'generic',
        url: this.feedUrlOverride,
        channel: 'latest',
      });
    }

    this.autoUpdater.on('checking-for-update', () => {
      this.lifecycleStatus = 'checking';
      this.error = null;
      this.emitState();
    });

    this.autoUpdater.on('update-available', info => {
      void this.handleUpdateAvailable(info);
    });

    this.autoUpdater.on('update-not-available', () => {
      this.lastCheckedAt = Date.now();
      if (this.lifecycleStatus !== 'downloaded') {
        this.lifecycleStatus = 'idle';
        this.availableVersion = null;
        this.releaseNotes = null;
        this.error = null;
      }
      this.emitState();
    });

    this.autoUpdater.on('download-progress', () => {
      if (this.lifecycleStatus !== 'downloaded') {
        this.lifecycleStatus = 'downloading';
        this.error = null;
        this.emitState();
      }
    });

    this.autoUpdater.on('update-downloaded', info => {
      void this.handleUpdateDownloaded(info);
    });

    this.autoUpdater.on('error', error => {
      this.handleUpdaterError(error);
    });
  }

  private async handleUpdateAvailable(info: unknown): Promise<void> {
    const version = normalizeVersion((info as { version?: unknown }).version);
    this.lastCheckedAt = Date.now();
    this.availableVersion = version;
    this.releaseNotes = coerceReleaseNotesText(
      (info as { releaseNotes?: unknown }).releaseNotes
    );
    this.error = null;
    this.lifecycleStatus =
      this.getConsent() === 'enabled' ? 'downloading' : 'available';
    this.emitState();

    if (this.getConsent() === 'enabled') {
      await this.downloadUpdate();
    }
  }

  private async handleUpdateDownloaded(info: unknown): Promise<void> {
    const version = normalizeVersion((info as { version?: unknown }).version);
    if (version) {
      this.availableVersion = version;
      this.downloadedVersion = version;
    }
    this.lastCheckedAt = Date.now();
    this.releaseNotes = coerceReleaseNotesText(
      (info as { releaseNotes?: unknown }).releaseNotes
    );
    this.lifecycleStatus = 'downloaded';
    this.error = null;
    this.readyPromptSuppressedUntilMs = null;
    this.clearReadyPromptReminder();
    this.preferences = await this.persistPreferences({
      consent: this.getConsent(),
      consentUpdatedAt: this.preferences?.consentUpdatedAt ?? null,
      dismissedReadyVersion: null,
    });
    this.emitState();
    this.requestRestartPromptIfEligible();
  }

  private handleUpdaterError(error: unknown): void {
    const message = normalizeErrorMessage(error);
    this.lifecycleStatus = 'error';
    this.error = message;
    this.lastCheckedAt = Date.now();
    this.emitState();
    this.log('error', message);
  }

  private emitState(): void {
    this.state = deriveDesktopUpdaterState({
      currentVersion: this.currentVersion,
      consent: this.getConsent(),
      lifecycleStatus: this.lifecycleStatus,
      sessionStatus: this.sessionStatus,
      lastCheckedAt: this.lastCheckedAt,
      availableVersion: this.availableVersion,
      downloadedVersion: this.downloadedVersion,
      releaseNotes: this.releaseNotes,
      error: this.error,
    });
    this.emit('state-changed', this.state);
  }

  private clearBackgroundSchedule(): void {
    if (this.startupCheckTimer) {
      clearTimeout(this.startupCheckTimer);
      this.startupCheckTimer = null;
    }

    if (this.periodicCheckTimer) {
      clearInterval(this.periodicCheckTimer);
      this.periodicCheckTimer = null;
    }
  }

  private refreshBackgroundSchedule(): void {
    this.clearBackgroundSchedule();

    if (this.disabledReason || this.getConsent() !== 'enabled') {
      return;
    }

    this.startupCheckTimer = setTimeout(() => {
      void this.checkForUpdates().catch(() => {});
    }, DEFAULT_INITIAL_CHECK_DELAY_MS);

    this.periodicCheckTimer = setInterval(() => {
      if (
        shouldPerformUpdateCheck({
          consent: this.getConsent(),
          lastCheckedAt: this.lastCheckedAt,
          minimumIntervalMs: this.checkIntervalMs,
          nowMs: Date.now(),
        })
      ) {
        void this.checkForUpdates().catch(() => {});
      }
    }, this.checkIntervalMs);
  }

  private clearReadyPromptReminder(): void {
    if (this.readyPromptReminderTimer) {
      clearTimeout(this.readyPromptReminderTimer);
      this.readyPromptReminderTimer = null;
    }
  }

  private scheduleReadyPromptReminder(): void {
    this.clearReadyPromptReminder();
    if (
      this.lifecycleStatus !== 'downloaded' ||
      !this.downloadedVersion ||
      this.state.deferredUntilSessionEnd
    ) {
      return;
    }

    const suppressedUntilMs = this.readyPromptSuppressedUntilMs;
    if (!suppressedUntilMs) {
      return;
    }

    const delayMs = Math.max(0, suppressedUntilMs - Date.now());
    this.readyPromptReminderTimer = setTimeout(() => {
      this.readyPromptSuppressedUntilMs = null;
      this.readyPromptReminderTimer = null;
      this.requestRestartPromptIfEligible();
    }, delayMs);
  }

  private requestRestartPromptIfEligible(): void {
    if (
      this.lifecycleStatus !== 'downloaded' ||
      !this.downloadedVersion ||
      this.state.deferredUntilSessionEnd
    ) {
      return;
    }

    if (
      this.readyPromptSuppressedUntilMs !== null &&
      Date.now() < this.readyPromptSuppressedUntilMs
    ) {
      this.scheduleReadyPromptReminder();
      return;
    }

    this.emit('restart-prompt-requested', this.getState());
  }

  private log(level: UpdateManagerLogLevel, message: string): void {
    const writer = this.logger[level];
    if (!writer) {
      return;
    }

    writer('desktop-updater', message);
  }
}
