import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  DesktopUpdaterConsent,
  DesktopUpdaterState,
} from '@/lib/desktop-updater-types';

export function hasDesktopUpdaterApi(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.desktopUpdater !== 'undefined'
  );
}

export function getDesktopUpdaterStatusLabel(
  state: DesktopUpdaterState | null
): string {
  if (!state) {
    return 'Not available';
  }

  switch (state.status) {
    case 'awaiting_consent':
      return 'Awaiting consent';
    case 'idle':
      return 'Up to date';
    case 'checking':
      return 'Checking';
    case 'available':
      return 'Update available';
    case 'downloading':
      return 'Downloading';
    case 'downloaded':
      return state.deferredUntilSessionEnd
        ? 'Ready after session'
        : 'Ready to restart';
    case 'error':
      return 'Update error';
  }
}

export function useDesktopUpdaterState(
  backendConsent?: Exclude<DesktopUpdaterConsent, 'unset'> | null
) {
  const [state, setState] = useState<DesktopUpdaterState | null>(null);
  const isAvailable = hasDesktopUpdaterApi();
  const consentSyncRef = useRef<Exclude<DesktopUpdaterConsent, 'unset'> | null>(
    null
  );

  useEffect(() => {
    if (!isAvailable || !window.desktopUpdater) {
      return;
    }

    let active = true;
    void window.desktopUpdater
      .getState()
      .then(nextState => {
        if (active) {
          setState(nextState);
        }
      })
      .catch(error => {
        console.warn('[desktop] Failed to read desktop updater state.', error);
      });

    const unsubscribe = window.desktopUpdater.onStateChanged(nextState => {
      if (active) {
        setState(nextState);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [isAvailable]);

  useEffect(() => {
    if (
      !isAvailable ||
      !window.desktopUpdater ||
      !backendConsent ||
      !state ||
      state.consent === backendConsent ||
      consentSyncRef.current === backendConsent
    ) {
      return;
    }

    consentSyncRef.current = backendConsent;
    void window.desktopUpdater
      .setConsent(backendConsent)
      .catch(error => {
        console.warn(
          '[desktop] Failed to sync updater consent from backend.',
          error
        );
      })
      .finally(() => {
        if (consentSyncRef.current === backendConsent) {
          consentSyncRef.current = null;
        }
      });
  }, [backendConsent, isAvailable, state]);

  const getLatestState = useCallback(async () => {
    if (!window.desktopUpdater) {
      return state;
    }

    const nextState = await window.desktopUpdater.getState();
    setState(nextState);
    return nextState;
  }, [state]);

  const setConsent = useCallback(
    async (next: Exclude<DesktopUpdaterConsent, 'unset'>) => {
      if (!window.desktopUpdater) {
        return state;
      }

      const nextState = await window.desktopUpdater.setConsent(next);
      setState(nextState);
      return nextState;
    },
    [state]
  );

  const checkForUpdates = useCallback(async () => {
    if (!window.desktopUpdater) {
      return state;
    }

    const nextState = await window.desktopUpdater.checkForUpdates();
    setState(nextState);
    return nextState;
  }, [state]);

  const downloadUpdate = useCallback(async () => {
    if (!window.desktopUpdater) {
      return state;
    }

    const nextState = await window.desktopUpdater.downloadUpdate();
    setState(nextState);
    return nextState;
  }, [state]);

  const installUpdate = useCallback(async () => {
    if (!window.desktopUpdater) {
      return;
    }

    await window.desktopUpdater.installUpdate();
  }, []);

  return {
    isAvailable,
    state,
    getLatestState,
    setConsent,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
}
