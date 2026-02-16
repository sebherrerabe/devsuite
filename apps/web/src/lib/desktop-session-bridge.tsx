import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { authClient } from '@/lib/auth';
import { useCurrentCompany } from '@/lib/company-context';
import {
  createDesktopPublishTimestamps,
  DESKTOP_STATE_PUBLISH_INTERVAL_MS,
} from './desktop-session-bridge-config';
import {
  logDesktopBridgeCommandFailed,
  logDesktopBridgeCommandReceived,
  logDesktopBridgePublish,
} from './desktop-session-bridge-logging';

interface DesktopScope {
  userId: string;
  companyId: string;
}
type DesktopBridgeConnectionState = 'connected' | 'syncing' | 'error';

function getSessionUserId(sessionData: unknown): string | null {
  if (!sessionData || typeof sessionData !== 'object') {
    return null;
  }

  const root = sessionData as {
    session?: { userId?: unknown } | null;
    user?: { id?: unknown } | null;
  };

  if (
    root.session &&
    typeof root.session.userId === 'string' &&
    root.session.userId.trim()
  ) {
    return root.session.userId.trim();
  }

  if (root.user && typeof root.user.id === 'string' && root.user.id.trim()) {
    return root.user.id.trim();
  }

  return null;
}

function getDesktopSessionStatus(
  activeSession: { status: string } | null | undefined
): 'IDLE' | 'RUNNING' | 'PAUSED' {
  if (!activeSession) {
    return 'IDLE';
  }

  if (activeSession.status === 'PAUSED') {
    return 'PAUSED';
  }

  return 'RUNNING';
}

function getConnectionState(input: {
  isSessionsEnabled: boolean;
  scope: DesktopScope | null;
  activeSession:
    | {
        _id: Id<'sessions'>;
      }
    | null
    | undefined;
  sessionDetail:
    | {
        session?: { _id: Id<'sessions'> } | null;
      }
    | null
    | undefined;
}): 'connected' | 'syncing' {
  if (!input.isSessionsEnabled || !input.scope) {
    return 'syncing';
  }

  if (input.activeSession === undefined) {
    return 'syncing';
  }

  if (input.activeSession && input.sessionDetail === undefined) {
    return 'syncing';
  }

  return 'connected';
}

function getEffectiveDurationMs(input: {
  status: 'IDLE' | 'RUNNING' | 'PAUSED';
  activeSession:
    | {
        startAt: number;
      }
    | null
    | undefined;
  sessionDetail:
    | {
        durationSummary?: { effectiveDurationMs?: number } | null;
      }
    | null
    | undefined;
}): number {
  const derivedDuration =
    input.sessionDetail?.durationSummary?.effectiveDurationMs;
  if (typeof derivedDuration === 'number' && Number.isFinite(derivedDuration)) {
    return Math.max(0, Math.trunc(derivedDuration));
  }

  if (input.status === 'RUNNING' && input.activeSession) {
    return Math.max(0, Date.now() - input.activeSession.startAt);
  }

  return 0;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  return 'Desktop session command failed.';
}

export function DesktopSessionBridge() {
  const { data: authSession } = authClient.useSession();
  const { currentCompany, isModuleEnabled } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const isSessionsEnabled = isModuleEnabled('sessions');

  const activeSession = useQuery(
    api.sessions.getActiveSession,
    isSessionsEnabled && companyId ? { companyId } : 'skip'
  );
  const tasks = useQuery(
    api.tasks.listAllTasks,
    isSessionsEnabled && companyId ? { companyId } : 'skip'
  );
  const sessionDetail = useQuery(
    api.sessions.getSession,
    isSessionsEnabled && companyId && activeSession
      ? { companyId, sessionId: activeSession._id }
      : 'skip'
  );

  const startSession = useMutation(api.sessions.startSession);
  const pauseSession = useMutation(api.sessions.pauseSession);
  const resumeSession = useMutation(api.sessions.resumeSession);
  const finishSession = useMutation(api.sessions.finishSession);
  const [commandError, setCommandError] = useState<string | null>(null);

  const scope = useMemo(() => {
    const userId = getSessionUserId(authSession);
    if (!userId || !companyId) {
      return null;
    }

    return {
      userId,
      companyId,
    };
  }, [authSession, companyId]);

  const activeSessionStatus = getDesktopSessionStatus(activeSession);
  const activeSessionId = activeSession?._id ?? null;
  const connectionState = getConnectionState({
    isSessionsEnabled,
    scope,
    activeSession:
      activeSession === undefined
        ? undefined
        : activeSession
          ? { _id: activeSession._id }
          : null,
    sessionDetail:
      sessionDetail === undefined
        ? undefined
        : sessionDetail
          ? { session: sessionDetail.session }
          : null,
  });
  const effectiveDurationMs = getEffectiveDurationMs({
    status: activeSessionStatus,
    activeSession:
      activeSession === undefined
        ? undefined
        : activeSession
          ? { startAt: activeSession.startAt }
          : null,
    sessionDetail:
      sessionDetail === undefined
        ? undefined
        : sessionDetail
          ? { durationSummary: sessionDetail.durationSummary }
          : null,
  });
  const remainingTaskCount = useMemo(() => {
    if (tasks === undefined) {
      return null;
    }

    return tasks.filter(
      task => task.status !== 'done' && task.status !== 'cancelled'
    ).length;
  }, [tasks]);

  const actionRef = useRef<{
    scope: DesktopScope | null;
    companyId: Id<'companies'> | null;
    activeSessionId: Id<'sessions'> | null;
    activeStatus: 'IDLE' | 'RUNNING' | 'PAUSED';
    connectionState: 'connected' | 'syncing';
  }>({
    scope: scope ?? null,
    companyId: companyId ?? null,
    activeSessionId,
    activeStatus: activeSessionStatus,
    connectionState,
  });

  const commandInFlightRef = useRef(false);
  const previousStatusRef = useRef<'IDLE' | 'RUNNING' | 'PAUSED' | null>(null);

  useEffect(() => {
    setCommandError(null);
  }, [scope?.companyId, scope?.userId]);

  useEffect(() => {
    actionRef.current = {
      scope: scope ?? null,
      companyId: companyId ?? null,
      activeSessionId,
      activeStatus: activeSessionStatus,
      connectionState,
    };
  }, [scope, companyId, activeSessionId, activeSessionStatus, connectionState]);

  const publishDesktopState = useCallback(() => {
    if (!window.desktopSession || !scope || !isSessionsEnabled) {
      return;
    }

    const nextConnectionState: DesktopBridgeConnectionState = commandError
      ? 'error'
      : connectionState;
    const { updatedAt, publishedAt } = createDesktopPublishTimestamps(
      Date.now()
    );

    const payload = {
      status: activeSessionStatus,
      sessionId: activeSessionId,
      effectiveDurationMs,
      remainingTaskCount,
      connectionState: nextConnectionState,
      lastError: commandError,
      updatedAt,
      publishedAt,
    };
    logDesktopBridgePublish({
      status: payload.status,
      effectiveDurationMs: payload.effectiveDurationMs,
      connectionState: payload.connectionState,
      updatedAt: payload.updatedAt,
    });

    void window.desktopSession.publishState(scope, payload).catch(error => {
      console.warn('[desktop] Failed to publish desktop session state.', error);
    });
  }, [
    activeSessionId,
    activeSessionStatus,
    commandError,
    connectionState,
    effectiveDurationMs,
    remainingTaskCount,
    isSessionsEnabled,
    scope,
  ]);

  useEffect(() => {
    publishDesktopState();
  }, [publishDesktopState]);

  useEffect(() => {
    if (!window.desktopSession || !scope || !isSessionsEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      publishDesktopState();
    }, DESKTOP_STATE_PUBLISH_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [isSessionsEnabled, publishDesktopState, scope]);

  useEffect(() => {
    if (!window.desktopNotification || !scope || !isSessionsEnabled) {
      previousStatusRef.current = activeSessionStatus;
      return;
    }
    const desktopNotification = window.desktopNotification;

    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = activeSessionStatus;

    if (!previousStatus || previousStatus === activeSessionStatus) {
      return;
    }

    const basePayload = {
      scope,
      action: 'open_sessions' as const,
      route: '/sessions',
      throttleMs: 8_000,
    };

    const emit = (payload: {
      kind:
        | 'session_started'
        | 'session_paused'
        | 'session_resumed'
        | 'session_ended'
        | 'ide_session_required'
        | 'tasks_remaining_reminder';
      title: string;
      body: string;
      action?: 'open_app' | 'open_sessions' | 'start_session';
      route?: string | null;
      throttleKey: string;
    }) => {
      void desktopNotification
        .emit({
          ...basePayload,
          ...payload,
          action: payload.action ?? basePayload.action,
          route: payload.route ?? basePayload.route,
        })
        .catch(error => {
          console.warn('[desktop] Failed to emit desktop notification.', error);
        });
    };

    if (previousStatus === 'IDLE' && activeSessionStatus === 'RUNNING') {
      emit({
        kind: 'session_started',
        title: 'Session started',
        body: 'Focus session is now running.',
        throttleKey: `${scope.userId}:${scope.companyId}:session_started`,
      });
      return;
    }

    if (previousStatus === 'RUNNING' && activeSessionStatus === 'PAUSED') {
      emit({
        kind: 'session_paused',
        title: 'Session paused',
        body: 'Your focus session is paused.',
        throttleKey: `${scope.userId}:${scope.companyId}:session_paused`,
      });
      return;
    }

    if (previousStatus === 'PAUSED' && activeSessionStatus === 'RUNNING') {
      emit({
        kind: 'session_resumed',
        title: 'Session resumed',
        body: 'Back to focus. Session resumed.',
        throttleKey: `${scope.userId}:${scope.companyId}:session_resumed`,
      });
      return;
    }

    if (
      (previousStatus === 'RUNNING' || previousStatus === 'PAUSED') &&
      activeSessionStatus === 'IDLE'
    ) {
      emit({
        kind: 'session_ended',
        title: 'Session ended',
        body: 'Focus session completed.',
        throttleKey: `${scope.userId}:${scope.companyId}:session_ended`,
      });
    }
  }, [activeSessionStatus, isSessionsEnabled, scope]);

  useEffect(() => {
    if (!window.desktopSession) {
      return;
    }

    const unsubscribe = window.desktopSession.onCommand(async command => {
      const snapshot = actionRef.current;
      if (!snapshot.scope || !snapshot.companyId) {
        return;
      }

      if (
        command.scope.userId !== snapshot.scope.userId ||
        command.scope.companyId !== snapshot.scope.companyId
      ) {
        return;
      }

      logDesktopBridgeCommandReceived({
        action: command.action,
        status: snapshot.activeStatus,
      });

      if (commandInFlightRef.current) {
        return;
      }

      if (snapshot.connectionState !== 'connected') {
        setCommandError('Desktop session is syncing. Try again in a moment.');
        return;
      }

      commandInFlightRef.current = true;
      try {
        switch (command.action) {
          case 'start': {
            if (snapshot.activeStatus !== 'IDLE') {
              break;
            }
            await startSession({
              companyId: snapshot.companyId,
            });
            break;
          }
          case 'pause': {
            if (
              snapshot.activeStatus !== 'RUNNING' ||
              !snapshot.activeSessionId
            ) {
              break;
            }
            await pauseSession({
              companyId: snapshot.companyId,
              sessionId: snapshot.activeSessionId,
            });
            break;
          }
          case 'resume': {
            if (
              snapshot.activeStatus !== 'PAUSED' ||
              !snapshot.activeSessionId
            ) {
              break;
            }
            await resumeSession({
              companyId: snapshot.companyId,
              sessionId: snapshot.activeSessionId,
            });
            break;
          }
          case 'end': {
            if (snapshot.activeStatus === 'IDLE' || !snapshot.activeSessionId) {
              break;
            }
            await finishSession({
              companyId: snapshot.companyId,
              sessionId: snapshot.activeSessionId,
            });
            break;
          }
        }
        setCommandError(null);
      } catch (error) {
        setCommandError(normalizeErrorMessage(error));
        logDesktopBridgeCommandFailed({
          action: command.action,
          error,
        });
      } finally {
        commandInFlightRef.current = false;
      }
    });

    return unsubscribe;
  }, [finishSession, pauseSession, resumeSession, startSession]);

  useEffect(() => {
    if (!window.desktopNotification) {
      return;
    }

    const unsubscribe = window.desktopNotification.onAction(actionPayload => {
      const snapshot = actionRef.current;
      if (!snapshot.scope) {
        return;
      }

      if (
        actionPayload.scope.userId !== snapshot.scope.userId ||
        actionPayload.scope.companyId !== snapshot.scope.companyId
      ) {
        return;
      }

      if (actionPayload.action === 'start_session' && window.desktopSession) {
        void window.desktopSession
          .requestAction(snapshot.scope, 'start')
          .catch(error => {
            console.warn(
              '[desktop] Failed to run start_session notification action.',
              error
            );
          });
      }

      const targetRoute =
        actionPayload.route ??
        (actionPayload.action === 'open_sessions' ||
        actionPayload.action === 'start_session'
          ? '/sessions'
          : '/');

      if (window.location.pathname !== targetRoute) {
        window.location.assign(targetRoute);
      } else {
        window.focus();
      }
    });

    return unsubscribe;
  }, []);

  return null;
}
