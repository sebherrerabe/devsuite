export type DesktopUpdaterConsent = 'unset' | 'enabled' | 'disabled';

export type DesktopUpdaterState =
  | {
      status: 'awaiting_consent';
      currentVersion: string;
      consent: DesktopUpdaterConsent;
      lastCheckedAt: number | null;
      availableVersion: null;
      downloadedVersion: null;
      releaseNotes: null;
      error: null;
      deferredUntilSessionEnd: false;
    }
  | {
      status:
        | 'idle'
        | 'checking'
        | 'available'
        | 'downloading'
        | 'downloaded'
        | 'error';
      currentVersion: string;
      consent: DesktopUpdaterConsent;
      lastCheckedAt: number | null;
      availableVersion: string | null;
      downloadedVersion: string | null;
      releaseNotes: string | null;
      error: string | null;
      deferredUntilSessionEnd: boolean;
    };
