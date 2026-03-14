import { useEffect, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import { isElectronDesktopContext } from '@/lib/desktop-context-detection';
import {
  buildPauseOnUnloadUrl,
  shouldPauseSessionOnUnload,
} from './web-session-unload-guard-utils';

type PauseOnUnloadRequest = {
  url: string;
  companyId: string;
  sessionId: string;
};

function sendPauseOnUnloadRequest(request: PauseOnUnloadRequest): void {
  void fetch(request.url, {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: {
      'content-type': 'text/plain;charset=UTF-8',
    },
    body: JSON.stringify({
      companyId: request.companyId,
      sessionId: request.sessionId,
    }),
  }).catch(error => {
    console.warn('[web] Failed to pause session on unload.', error);
  });
}

export function WebSessionUnloadGuard() {
  const { currentCompany, isModuleEnabled } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const isSessionsEnabled = isModuleEnabled('sessions');
  const isDesktopRuntime = isElectronDesktopContext();
  const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL?.trim() ?? null;

  const activeSession = useQuery(
    api.sessions.getActiveSession,
    isSessionsEnabled && companyId ? { companyId } : 'skip'
  );

  const latestRequestRef = useRef<PauseOnUnloadRequest | null>(null);
  const sentSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const pauseCandidate = {
      isDesktopRuntime,
      isSessionsEnabled,
      companyId,
      siteUrl,
      activeSession:
        activeSession === undefined
          ? undefined
          : activeSession
            ? {
                _id: activeSession._id,
                status: activeSession.status,
              }
            : null,
    };

    if (!shouldPauseSessionOnUnload(pauseCandidate)) {
      latestRequestRef.current = null;
      sentSessionIdRef.current = null;
      return;
    }

    latestRequestRef.current = {
      url: buildPauseOnUnloadUrl(pauseCandidate.siteUrl),
      companyId: pauseCandidate.companyId,
      sessionId: pauseCandidate.activeSession._id,
    };
    sentSessionIdRef.current =
      sentSessionIdRef.current === pauseCandidate.activeSession._id
        ? sentSessionIdRef.current
        : null;
  }, [activeSession, companyId, isDesktopRuntime, isSessionsEnabled, siteUrl]);

  useEffect(() => {
    const sendIfNeeded = () => {
      const request = latestRequestRef.current;
      if (!request) {
        return;
      }
      if (sentSessionIdRef.current === request.sessionId) {
        return;
      }
      sentSessionIdRef.current = request.sessionId;
      sendPauseOnUnloadRequest(request);
    };

    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) {
        return;
      }
      sendIfNeeded();
    };

    const handleBeforeUnload = () => {
      sendIfNeeded();
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return null;
}
