import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { Id } from '../../../../convex/_generated/dataModel';
import { api } from '../../../../convex/_generated/api';
import { authClient } from '@/lib/auth';
import { CompanyProvider, useCurrentCompany } from '@/lib/company-context';
import { SessionWidget } from '@/components/session-widget';
import { CompanySwitcher } from '@/components/company-switcher';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { showToast } from '@/lib/toast';
import { formatDurationMs } from '@/lib/time';
import { cn } from '@/lib/utils';
import { Loader2, Pause, Play, Square, Timer, X } from 'lucide-react';

export const Route = createFileRoute('/session-companion')({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === 'mini' ? 'mini' : 'expanded',
  }),
  component: SessionCompanionRoute,
});

type CompanionMode = 'mini' | 'expanded';
type CompanionScope = {
  userId: string;
  companyId: string;
};
type CompanionDesktopSessionState = {
  status: 'IDLE' | 'RUNNING' | 'PAUSED';
  connectionState: 'connected' | 'syncing' | 'error';
  effectiveDurationMs: number;
  updatedAt: number;
  publishedAt?: number;
};
type CompanionDesktopSessionAction = 'start' | 'pause' | 'resume' | 'end';

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

function computeSessionDurationFromDetail(
  sessionDetail:
    | {
        session?: {
          status?: string;
          startAt?: number;
        } | null;
        events?: Array<{
          type: string;
          timestamp: number;
        }> | null;
        durationSummary?: {
          effectiveDurationMs?: number;
        } | null;
      }
    | null
    | undefined,
  nowMs: number
): number {
  if (!sessionDetail?.session) {
    return 0;
  }

  const session = sessionDetail.session;
  if (session.status !== 'RUNNING') {
    return Math.max(0, sessionDetail.durationSummary?.effectiveDurationMs ?? 0);
  }

  const startAt = session.startAt ?? nowMs;
  const events = sessionDetail.events ?? [];
  if (events.length === 0) {
    return Math.max(0, nowMs - startAt);
  }

  let effectiveDurationMs = 0;
  let isRunning = false;
  let lastTimestamp = startAt;
  const orderedEvents = [...events].sort((left, right) => {
    return left.timestamp - right.timestamp;
  });

  for (const event of orderedEvents) {
    if (isRunning) {
      effectiveDurationMs += Math.max(0, event.timestamp - lastTimestamp);
    }

    if (event.type === 'SESSION_STARTED' || event.type === 'SESSION_RESUMED') {
      isRunning = true;
    } else if (
      event.type === 'SESSION_PAUSED' ||
      event.type === 'SESSION_FINISHED' ||
      event.type === 'SESSION_CANCELLED'
    ) {
      isRunning = false;
    }

    lastTimestamp = event.timestamp;
  }

  if (isRunning) {
    effectiveDurationMs += Math.max(0, nowMs - lastTimestamp);
  }

  return effectiveDurationMs;
}

function SessionCompanionRoute() {
  return (
    <CompanyProvider
      syncDesktopScope={false}
      clearScopeOnMissingContext={false}
      desktopCompanyMode="consumer"
    >
      <SessionCompanionContent />
    </CompanyProvider>
  );
}

function SessionCompanionContent() {
  const navigate = useNavigate({ from: '/session-companion' });
  const search = Route.useSearch();
  const { data: authSession } = authClient.useSession();
  const { currentCompany, isLoading } = useCurrentCompany();
  const mode = search.mode as CompanionMode;
  const scope = useMemo(() => {
    const userId = getSessionUserId(authSession);
    const companyId = currentCompany?._id;
    if (!userId || !companyId) {
      return null;
    }
    return { userId, companyId };
  }, [authSession, currentCompany?._id]);

  useEffect(() => {
    if (!window.desktopSession?.setCompanionMode) {
      return;
    }
    void window.desktopSession.setCompanionMode(mode).catch(error => {
      console.warn('[desktop] Failed to update companion mode.', error);
    });
  }, [mode]);

  const setMode = (nextMode: CompanionMode) => {
    void navigate({
      to: '/session-companion',
      search: {
        mode: nextMode,
      },
      replace: true,
    });
  };

  const closeCompanion = () => {
    if (!window.desktopWidget?.close) {
      return;
    }
    void window.desktopWidget.close().catch(error => {
      console.warn('[desktop] Failed to close companion.', error);
    });
  };

  return (
    <div className="h-full w-full bg-transparent p-2">
      <div className="mx-auto flex h-full w-full max-w-[560px] flex-col gap-2">
        <div className="group rounded-xl border bg-background/85 p-2 backdrop-blur-md">
          <div className="desktop-companion-drag-handle mb-2 flex items-center justify-center rounded-md py-1">
            <div
              aria-hidden="true"
              className="h-1.5 w-14 rounded-full bg-border/80"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="desktop-companion-no-drag min-w-0 flex-1">
              <CompanySwitcher useNativeDesktopDialogs />
            </div>
            <div className="desktop-companion-no-drag flex items-center gap-1 rounded-md border p-1">
              <Button
                variant={mode === 'mini' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setMode('mini')}
              >
                Mini
              </Button>
              <Button
                variant={mode === 'expanded' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setMode('expanded')}
              >
                Expanded
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="desktop-companion-no-drag h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={closeCompanion}
              aria-label="Close companion"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-20 items-center justify-center rounded-xl border bg-background/85">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !currentCompany ? (
          <div className="rounded-xl border bg-background/95 p-4">
            <p className="text-sm text-muted-foreground">
              Select a company in DevSuite before using the companion.
            </p>
          </div>
        ) : mode === 'mini' ? (
          <MiniCompanionCard scope={scope} companyId={currentCompany._id} />
        ) : (
          <SessionWidget
            displayMode="embedded"
            className="max-h-[calc(100vh-74px)] w-full overflow-y-auto bg-background/90 shadow-xl backdrop-blur-md"
          />
        )}
      </div>
    </div>
  );
}

const DEFAULT_IDE_LIST = ['code.exe', 'cursor.exe', 'idea64.exe'];

function MiniCompanionCard({
  scope,
  companyId,
}: {
  scope: CompanionScope | null;
  companyId: Id<'companies'>;
}) {
  const [desktopState, setDesktopState] =
    useState<CompanionDesktopSessionState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedRecordingIDE, setSelectedRecordingIDE] = useState<string>(
    DEFAULT_IDE_LIST[0] ?? 'code.exe'
  );

  const userSettings = useQuery(api.userSettings.get, { companyId });
  const ideWatchList =
    (userSettings?.desktopFocus?.devCoreList?.length ?? 0) > 0
      ? (userSettings?.desktopFocus?.devCoreList ?? [])
      : (userSettings?.desktopFocus?.ideWatchList?.length ?? 0) > 0
        ? (userSettings?.desktopFocus?.ideWatchList ?? [])
        : DEFAULT_IDE_LIST;
  const isDesktop = typeof window !== 'undefined' && !!window.desktopSession;

  const startSession = useMutation(api.sessions.startSession);
  const activeSession = useQuery(api.sessions.getActiveSession, { companyId });
  const sessionDetail = useQuery(
    api.sessions.getSession,
    activeSession ? { companyId, sessionId: activeSession._id } : 'skip'
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!window.desktopSession || !scope) {
      return;
    }

    let disposed = false;
    void window.desktopSession
      .getState(scope)
      .then(currentState => {
        if (!disposed) {
          setDesktopState(currentState);
        }
      })
      .catch(error => {
        console.warn('[desktop] Failed to read desktop session state.', error);
      });

    const unsubscribe = window.desktopSession.onStateChanged(nextState => {
      if (!disposed) {
        setDesktopState(nextState);
      }
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [scope]);

  const status: CompanionDesktopSessionState['status'] = activeSession
    ? activeSession.status === 'PAUSED'
      ? 'PAUSED'
      : 'RUNNING'
    : (desktopState?.status ?? 'IDLE');
  const connectionState = desktopState?.connectionState ?? 'syncing';
  const convexDurationMs = sessionDetail
    ? computeSessionDurationFromDetail(sessionDetail, nowMs)
    : null;
  const fallbackPublishedAt =
    desktopState?.publishedAt ?? desktopState?.updatedAt ?? nowMs;
  const fallbackDurationMs =
    status === 'RUNNING'
      ? Math.max(
          0,
          (desktopState?.effectiveDurationMs ?? 0) +
            (nowMs - fallbackPublishedAt)
        )
      : Math.max(0, desktopState?.effectiveDurationMs ?? 0);
  const displayDurationMs = convexDurationMs ?? fallbackDurationMs;

  const runAction = async (action: CompanionDesktopSessionAction) => {
    if (!window.desktopSession || !scope) {
      return;
    }

    try {
      if (action === 'start' && isDesktop) {
        await startSession({
          companyId,
          recordingIDE: selectedRecordingIDE,
        });
        showToast.success('Session started');
      } else {
        await window.desktopSession.requestAction(scope, action);
      }
    } catch (error) {
      showToast.error(
        error instanceof Error
          ? error.message
          : 'Failed to run desktop session action'
      );
    }
  };

  const isBusy = !scope || connectionState !== 'connected';

  return (
    <div className="rounded-xl border bg-background/80 p-3 shadow-lg backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm text-primary">
            {formatDurationMs(displayDurationMs)}
          </span>
        </div>
        <Badge
          variant={status === 'RUNNING' ? 'default' : 'secondary'}
          className={cn(status === 'IDLE' && 'bg-muted text-muted-foreground')}
        >
          {status}
        </Badge>
      </div>

      {isDesktop && status === 'IDLE' && (
        <div className="mb-3 space-y-1.5">
          <Label className="text-xs">IDE for this session</Label>
          <Select
            value={selectedRecordingIDE}
            onValueChange={setSelectedRecordingIDE}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select IDE" />
            </SelectTrigger>
            <SelectContent>
              {ideWatchList.map(ide => (
                <SelectItem key={ide} value={ide} className="text-xs">
                  {ide}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          onClick={() => void runAction('start')}
          disabled={isBusy || status !== 'IDLE'}
        >
          <Play className="mr-2 h-3.5 w-3.5" />
          Start
        </Button>
        {status === 'RUNNING' ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void runAction('pause')}
            disabled={isBusy}
          >
            <Pause className="mr-2 h-3.5 w-3.5" />
            Pause
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void runAction('resume')}
            disabled={isBusy || status !== 'PAUSED'}
          >
            <Play className="mr-2 h-3.5 w-3.5" />
            Resume
          </Button>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="mt-2 w-full"
        onClick={() => void runAction('end')}
        disabled={isBusy || status === 'IDLE'}
      >
        <Square className="mr-2 h-3.5 w-3.5" />
        End
      </Button>

      {connectionState !== 'connected' && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Syncing desktop state...
        </div>
      )}
    </div>
  );
}
