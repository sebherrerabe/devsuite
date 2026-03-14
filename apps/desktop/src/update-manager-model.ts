import type { DesktopSessionStatus } from './session-control.js';

export type DesktopUpdaterConsent = 'unset' | 'enabled' | 'disabled';
export type DesktopUpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface DesktopAutoUpdatePreferences {
  consent: DesktopUpdaterConsent;
  consentUpdatedAt: number | null;
  dismissedReadyVersion: string | null;
}

type DesktopUpdaterStateBase = {
  currentVersion: string;
  consent: DesktopUpdaterConsent;
  lastCheckedAt: number | null;
  availableVersion: string | null;
  downloadedVersion: string | null;
  releaseNotes: string | null;
  error: string | null;
  deferredUntilSessionEnd: boolean;
};

export type DesktopUpdaterState =
  | (DesktopUpdaterStateBase & {
      status: 'awaiting_consent';
      availableVersion: null;
      downloadedVersion: null;
      releaseNotes: null;
      error: null;
      deferredUntilSessionEnd: false;
    })
  | (DesktopUpdaterStateBase & {
      status: DesktopUpdaterStatus;
    });

export const DEFAULT_DESKTOP_AUTO_UPDATE_PREFERENCES: DesktopAutoUpdatePreferences =
  {
    consent: 'unset',
    consentUpdatedAt: null,
    dismissedReadyVersion: null,
  };

function parseConsent(value: unknown): DesktopUpdaterConsent {
  if (value === 'unset' || value === 'enabled' || value === 'disabled') {
    return value;
  }

  return DEFAULT_DESKTOP_AUTO_UPDATE_PREFERENCES.consent;
}

function parseOptionalTimestamp(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Number.isInteger(value)) {
    return null;
  }

  const parsed = value as number;
  if (parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseOptionalTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function parseDesktopAutoUpdatePreferences(
  input: unknown
): DesktopAutoUpdatePreferences {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_DESKTOP_AUTO_UPDATE_PREFERENCES };
  }

  const raw = input as {
    consent?: unknown;
    consentUpdatedAt?: unknown;
    dismissedReadyVersion?: unknown;
  };

  return {
    consent: parseConsent(raw.consent),
    consentUpdatedAt: parseOptionalTimestamp(raw.consentUpdatedAt),
    dismissedReadyVersion: parseOptionalTrimmedString(
      raw.dismissedReadyVersion
    ),
  };
}

export function isSessionBlockingUpdatePrompt(
  sessionStatus: DesktopSessionStatus
): boolean {
  return sessionStatus === 'RUNNING';
}

export function deriveDesktopUpdaterState(params: {
  currentVersion: string;
  consent: DesktopUpdaterConsent;
  lifecycleStatus: DesktopUpdaterStatus;
  sessionStatus: DesktopSessionStatus;
  lastCheckedAt: number | null;
  availableVersion: string | null;
  downloadedVersion: string | null;
  releaseNotes: string | null;
  error: string | null;
}): DesktopUpdaterState {
  if (params.consent === 'unset' && params.lifecycleStatus === 'idle') {
    return {
      status: 'awaiting_consent',
      currentVersion: params.currentVersion,
      consent: params.consent,
      lastCheckedAt: params.lastCheckedAt,
      availableVersion: null,
      downloadedVersion: null,
      releaseNotes: null,
      error: null,
      deferredUntilSessionEnd: false,
    };
  }

  return {
    status: params.lifecycleStatus,
    currentVersion: params.currentVersion,
    consent: params.consent,
    lastCheckedAt: params.lastCheckedAt,
    availableVersion: params.availableVersion,
    downloadedVersion: params.downloadedVersion,
    releaseNotes: params.releaseNotes,
    error: params.error,
    deferredUntilSessionEnd:
      params.lifecycleStatus === 'downloaded' &&
      isSessionBlockingUpdatePrompt(params.sessionStatus),
  };
}

export function coerceReleaseNotesText(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const parts = value
    .map(entry => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const note = (entry as { note?: unknown }).note;
      if (typeof note !== 'string') {
        return null;
      }

      const normalized = note.trim();
      return normalized ? normalized : null;
    })
    .filter((note): note is string => Boolean(note));

  if (parts.length === 0) {
    return null;
  }

  return parts.join('\n\n');
}

export function shouldPerformUpdateCheck(params: {
  consent: DesktopUpdaterConsent;
  lastCheckedAt: number | null;
  minimumIntervalMs: number;
  nowMs: number;
}): boolean {
  if (params.consent !== 'enabled') {
    return false;
  }

  if (params.lastCheckedAt === null) {
    return true;
  }

  return params.nowMs - params.lastCheckedAt >= params.minimumIntervalMs;
}
