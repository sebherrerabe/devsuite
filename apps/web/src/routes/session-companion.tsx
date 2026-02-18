import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { authClient } from '@/lib/auth';
import { CompanyProvider, useCurrentCompany } from '@/lib/company-context';
import { DesktopSessionBridge } from '@/lib/desktop-session-bridge';
import { SessionWidget } from '@/components/session-widget';
import { CompanySwitcher } from '@/components/company-switcher';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { showToast } from '@/lib/toast';
import { formatDurationMs } from '@/lib/time';
import { cn } from '@/lib/utils';
import { Loader2, Pause, Play, Square, Timer } from 'lucide-react';

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

function SessionCompanionRoute() {
  return (
    <CompanyProvider>
      <DesktopSessionBridge />
      <SessionCompanionContent />
    </CompanyProvider>
  );
}

function SessionCompanionContent() {
  const navigate = useNavigate({ from: '/session-companion' });
  const search = Route.useSearch();
  const { data: authSession } = authClient.useSession();
  const { currentCompany } = useCurrentCompany();

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

  if (!currentCompany) {
    return (
      <div className="min-h-screen bg-transparent p-4">
        <div className="rounded-xl border bg-background/95 p-4">
          <p className="text-sm text-muted-foreground">
            Select a company in DevSuite before using the companion.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-3">
      <div className="mx-auto flex max-w-[460px] flex-col gap-2">
        <div className="rounded-xl border bg-background/85 p-2 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <CompanySwitcher />
            <div className="flex items-center gap-1 rounded-md border p-1">
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
          </div>
        </div>

        {mode === 'mini' ? (
          <MiniCompanionCard
            scope={scope}
            onExpand={() => setMode('expanded')}
          />
        ) : (
          <SessionWidget
            displayMode="embedded"
            className="max-h-[calc(100vh-84px)] w-[460px] overflow-y-auto bg-background/90 shadow-xl backdrop-blur-md"
          />
        )}
      </div>
    </div>
  );
}

function MiniCompanionCard({
  scope,
  onExpand,
}: {
  scope: CompanionScope | null;
  onExpand: () => void;
}) {
  const [state, setState] = useState<CompanionDesktopSessionState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (state?.status !== 'RUNNING') {
      return;
    }

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [state?.status]);

  useEffect(() => {
    if (!window.desktopSession || !scope) {
      return;
    }

    let disposed = false;
    void window.desktopSession
      .getState(scope)
      .then(currentState => {
        if (!disposed) {
          setState(currentState);
        }
      })
      .catch(error => {
        console.warn('[desktop] Failed to read desktop session state.', error);
      });

    const unsubscribe = window.desktopSession.onStateChanged(nextState => {
      if (!disposed) {
        setState(nextState);
      }
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [scope]);

  const status = state?.status ?? 'IDLE';
  const connectionState = state?.connectionState ?? 'syncing';
  const effectiveDurationMs = state?.effectiveDurationMs ?? 0;
  const displayDurationMs =
    status === 'RUNNING'
      ? Math.max(0, effectiveDurationMs + (nowMs - (state?.updatedAt ?? nowMs)))
      : effectiveDurationMs;

  const runAction = async (action: CompanionDesktopSessionAction) => {
    if (!window.desktopSession || !scope) {
      return;
    }

    try {
      await window.desktopSession.requestAction(scope, action);
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

      <div className="mb-2 grid grid-cols-2 gap-2">
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
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={onExpand}>
          Expanded
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void runAction('end')}
          disabled={isBusy || status === 'IDLE'}
        >
          <Square className="mr-2 h-3.5 w-3.5" />
          End
        </Button>
      </div>

      {connectionState !== 'connected' && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Syncing desktop state...
        </div>
      )}
    </div>
  );
}
