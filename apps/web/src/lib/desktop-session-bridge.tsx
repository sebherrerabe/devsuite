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
type DesktopNotificationActionPayload = {
  scope: DesktopScope;
  action: 'open_app' | 'open_sessions' | 'start_session';
  route: string | null;
  requestedAt: number;
};
const BRIDGE_DURATION_REGRESSION_TOLERANCE_MS = 1_500;

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
  const deactivateTask = useMutation(api.sessions.deactivateTask);
  const markTaskDone = useMutation(api.sessions.markTaskDone);
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
  const stableDurationRef = useRef<{
    sessionId: Id<'sessions'> | null;
    valueMs: number;
  }>({
    sessionId: null,
    valueMs: 0,
  });
  let stableEffectiveDurationMs = effectiveDurationMs;
  if (activeSessionStatus === 'RUNNING' && activeSessionId) {
    if (stableDurationRef.current.sessionId !== activeSessionId) {
      stableDurationRef.current = {
        sessionId: activeSessionId,
        valueMs: Math.max(0, effectiveDurationMs),
      };
    } else if (
      effectiveDurationMs <
      stableDurationRef.current.valueMs -
        BRIDGE_DURATION_REGRESSION_TOLERANCE_MS
    ) {
      console.warn('[desktop] duration regression detected in bridge publish', {
        sessionId: activeSessionId,
        previousMs: stableDurationRef.current.valueMs,
        incomingMs: effectiveDurationMs,
      });
    } else {
      stableDurationRef.current.valueMs = Math.max(0, effectiveDurationMs);
    }

    stableEffectiveDurationMs = stableDurationRef.current.valueMs;
  } else if (activeSessionStatus === 'PAUSED' && activeSessionId) {
    if (stableDurationRef.current.sessionId !== activeSessionId) {
      stableDurationRef.current = {
        sessionId: activeSessionId,
        valueMs: Math.max(0, effectiveDurationMs),
      };
    } else {
      stableDurationRef.current.valueMs = Math.max(
        stableDurationRef.current.valueMs,
        Math.max(0, effectiveDurationMs)
      );
    }
    stableEffectiveDurationMs = stableDurationRef.current.valueMs;
  } else {
    stableDurationRef.current = {
      sessionId: activeSessionId,
      valueMs: Math.max(0, effectiveDurationMs),
    };
    stableEffectiveDurationMs = Math.max(0, effectiveDurationMs);
  }
  const sessionProjectIds = useMemo(() => {
    if (!activeSession) {
      return null;
    }

    const projectIds =
      sessionDetail?.session?.projectIds ?? activeSession.projectIds ?? [];
    if (projectIds.length === 0) {
      return null;
    }

    return new Set(projectIds);
  }, [activeSession, sessionDetail?.session?.projectIds]);
  const sessionRelevantTasks = useMemo(() => {
    if (tasks === undefined) {
      return null;
    }

    return tasks.filter(task => {
      if (!sessionProjectIds) {
        return true;
      }
      return !!task.projectId && sessionProjectIds.has(task.projectId);
    });
  }, [sessionProjectIds, tasks]);
  const activeRecordingTaskIds = useMemo(() => {
    const activeIds = new Set<Id<'tasks'>>();
    if (!sessionDetail?.events) {
      return activeIds;
    }

    for (const event of sessionDetail.events) {
      const payloadTaskId = (event.payload as { taskId?: Id<'tasks'> }).taskId;
      if (!payloadTaskId) {
        continue;
      }

      if (event.type === 'TASK_ACTIVATED') {
        activeIds.add(payloadTaskId);
        continue;
      }

      if (
        event.type === 'TASK_DEACTIVATED' ||
        event.type === 'TASK_RESET' ||
        event.type === 'TASK_MARKED_DONE'
      ) {
        activeIds.delete(payloadTaskId);
        continue;
      }

      if (
        event.type === 'SESSION_FINISHED' ||
        event.type === 'SESSION_CANCELLED'
      ) {
        activeIds.clear();
      }
    }

    return activeIds;
  }, [sessionDetail?.events]);
  const remainingTaskCount = useMemo(() => {
    if (!activeSession) {
      return 0;
    }

    if (sessionRelevantTasks === null || sessionDetail === undefined) {
      return null;
    }

    if (activeRecordingTaskIds.size > 0) {
      return 0;
    }

    return sessionRelevantTasks.filter(
      task => task.status !== 'done' && task.status !== 'cancelled'
    ).length;
  }, [
    activeRecordingTaskIds,
    activeSession,
    sessionDetail,
    sessionRelevantTasks,
  ]);

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
      effectiveDurationMs: stableEffectiveDurationMs,
      remainingTaskCount,
      connectionState: nextConnectionState,
      lastError: commandError,
      updatedAt,
      publishedAt,
    };
    logDesktopBridgePublish({
      status: payload.status,
      sessionId: payload.sessionId,
      effectiveDurationMs: payload.effectiveDurationMs,
      connectionState: payload.connectionState,
      updatedAt: payload.updatedAt,
      publishedAt: payload.publishedAt,
    });

    void window.desktopSession.publishState(scope, payload).catch(error => {
      console.warn('[desktop] Failed to publish desktop session state.', error);
    });
  }, [
    activeSessionId,
    activeSessionStatus,
    commandError,
    connectionState,
    stableEffectiveDurationMs,
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
            const endDecision = command.endDecision ?? 'keep_ongoing';
            if (endDecision === 'cancel') {
              break;
            }
            if (endDecision === 'mark_all_done') {
              if (
                sessionRelevantTasks === null ||
                sessionDetail === undefined
              ) {
                throw new Error('Session tasks are still syncing. Try again.');
              }

              const pendingTasks = sessionRelevantTasks.filter(
                task => task.status !== 'done' && task.status !== 'cancelled'
              );
              for (const task of pendingTasks) {
                if (activeRecordingTaskIds.has(task._id)) {
                  await deactivateTask({
                    companyId: snapshot.companyId,
                    sessionId: snapshot.activeSessionId,
                    taskId: task._id,
                  });
                }
                await markTaskDone({
                  companyId: snapshot.companyId,
                  sessionId: snapshot.activeSessionId,
                  taskId: task._id,
                });
              }
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
  }, [
    activeRecordingTaskIds,
    deactivateTask,
    finishSession,
    markTaskDone,
    pauseSession,
    resumeSession,
    sessionDetail,
    sessionRelevantTasks,
    startSession,
  ]);

  const handledNotificationActionKeysRef = useRef<string[]>([]);

  const handleDesktopNotificationAction = useCallback(
    (actionPayload: DesktopNotificationActionPayload) => {
      const snapshot = actionRef.current;
      if (!snapshot.scope) {
        console.debug(
          '[desktop-bridge] notification action ignored: scope not ready'
        );
        return;
      }

      if (
        actionPayload.scope.userId !== snapshot.scope.userId ||
        actionPayload.scope.companyId !== snapshot.scope.companyId
      ) {
        console.debug(
          '[desktop-bridge] notification action ignored: scope mismatch',
          actionPayload
        );
        return;
      }

      const actionKey = [
        actionPayload.scope.userId,
        actionPayload.scope.companyId,
        actionPayload.action,
        actionPayload.route ?? 'none',
        actionPayload.requestedAt,
      ].join(':');
      if (handledNotificationActionKeysRef.current.includes(actionKey)) {
        console.debug(
          '[desktop-bridge] notification action skipped: already handled',
          actionPayload
        );
        return;
      }

      handledNotificationActionKeysRef.current.push(actionKey);
      if (handledNotificationActionKeysRef.current.length > 64) {
        handledNotificationActionKeysRef.current.splice(
          0,
          handledNotificationActionKeysRef.current.length - 64
        );
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
      const currentRoute = `${window.location.pathname}${window.location.search}`;
      console.debug('[desktop-bridge] handling notification action', {
        action: actionPayload.action,
        route: actionPayload.route,
        requestedAt: actionPayload.requestedAt,
        targetRoute,
        currentRoute,
      });

      if (currentRoute !== targetRoute) {
        window.location.assign(targetRoute);
      } else {
        window.focus();
      }
    },
    []
  );

  useEffect(() => {
    if (!window.desktopNotification) {
      return;
    }

    const unsubscribe = window.desktopNotification.onAction(actionPayload => {
      handleDesktopNotificationAction(actionPayload);
    });

    return unsubscribe;
  }, [handleDesktopNotificationAction]);

  useEffect(() => {
    if (!window.desktopNotification || !scope || !isSessionsEnabled) {
      return;
    }

    let cancelled = false;
    void window.desktopNotification
      .consumePendingActions(scope)
      .then(pendingActions => {
        if (cancelled || pendingActions.length === 0) {
          return;
        }

        console.debug(
          '[desktop-bridge] consumed pending notification actions',
          {
            count: pendingActions.length,
          }
        );
        for (const actionPayload of pendingActions) {
          handleDesktopNotificationAction(actionPayload);
        }
      })
      .catch(error => {
        console.warn(
          '[desktop] Failed to consume pending desktop notification actions.',
          error
        );
      });

    return () => {
      cancelled = true;
    };
  }, [handleDesktopNotificationAction, isSessionsEnabled, scope]);

  return null;
}
