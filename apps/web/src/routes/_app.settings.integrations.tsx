import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import {
  CardFooter,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authClient } from '@/lib/auth';
import { showToast } from '@/lib/toast';
import {
  disconnectGithub,
  getGhServiceBaseUrl,
  getGithubConnectionStatus,
  GhServiceRequestError,
  syncGithubNotifications,
  startGithubLogin,
} from '@/lib/gh-service-client';
import type {
  GhConnectionStatus,
  GhNotificationSyncResult,
  GhRuntimeSnapshot,
} from '@/lib/gh-service-client';
import { ExternalLink, Loader2, RefreshCw, Unplug } from 'lucide-react';
import { useCurrentCompany } from '@/lib/company-context';
import {
  disconnectNotion,
  getNotionConnectionStatus,
  NotionServiceRequestError,
  startNotionLogin,
} from '@/lib/notion-service-client';
import type { NotionConnectionStatus } from '@/lib/notion-service-client';

export const Route = createFileRoute('/_app/settings/integrations')({
  component: IntegrationsSettingsPage,
});

const PENDING_POLL_INTERVAL_MS = 3000;
const LOGIN_SLOWDOWN_COOLDOWN_MS = 5 * 60 * 1000;
const LOGIN_COOLDOWN_STORAGE_PREFIX = 'devsuite-gh-login-cooldown-until';

function formatTimestamp(value: number | null): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDuration(valueMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getStatusBadgeVariant(
  state: GhConnectionStatus['state'] | null
): 'secondary' | 'outline' | 'destructive' | 'default' {
  if (state === 'connected') {
    return 'default';
  }
  if (state === 'pending') {
    return 'secondary';
  }
  if (state === 'error') {
    return 'destructive';
  }
  return 'outline';
}

function getStatusLabel(state: GhConnectionStatus['state'] | null): string {
  if (!state) {
    return 'Unknown';
  }
  if (state === 'connected') {
    return 'Connected';
  }
  if (state === 'pending') {
    return 'Pending Login';
  }
  if (state === 'error') {
    return 'Error';
  }
  return 'Disconnected';
}

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

function formatServiceError(error: unknown): string {
  if (error instanceof GhServiceRequestError) {
    if (error.code === 'BACKEND_NOT_CONFIGURED') {
      return 'GitHub notification backend is not configured. Set DEVSUITE_GH_SERVICE_BACKEND_TOKEN in gh-service and Convex, then restart services.';
    }
    if (error.code === 'NOT_CONNECTED') {
      return 'GitHub is not connected for this account. Start login again from this page.';
    }
    if (error.code === 'LOGIN_PENDING') {
      return 'GitHub login is still pending. Complete the browser device flow and refresh status.';
    }
    if (error.code === 'TOKEN_INVALID') {
      return 'Stored GitHub token is invalid. Reconnect your GitHub account.';
    }
    if (error.code === 'UNAUTHORIZED') {
      return 'Request was rejected by gh-service. Verify DEVSUITE_GH_SERVICE_TOKEN matches between client and service.';
    }
    if (error.code === 'COMMAND_FAILED') {
      return `GitHub CLI request failed: ${error.message}`;
    }
    return error.requestId
      ? `${error.message} (request ${error.requestId})`
      : error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected GitHub integration error';
}

function formatNotionServiceError(error: unknown): string {
  if (error instanceof NotionServiceRequestError) {
    if (
      error.code === 'NOTION_NOT_CONFIGURED' ||
      error.code === 'NOT_CONFIGURED'
    ) {
      return 'Notion OAuth is not configured. Set DEVSUITE_NOTION_OAUTH_CLIENT_ID, DEVSUITE_NOTION_OAUTH_CLIENT_SECRET, and DEVSUITE_NOTION_OAUTH_REDIRECT_URI in notion-service.';
    }
    if (error.code === 'BACKEND_NOT_CONFIGURED') {
      return 'Notion backend routing is not configured. Set DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN in notion-service and Convex, then restart services.';
    }
    if (error.code === 'TOKEN_INVALID') {
      return 'Stored Notion token is invalid or expired. Reconnect Notion.';
    }
    if (error.code === 'NOT_CONNECTED') {
      return 'Notion is not connected for this company.';
    }
    if (error.code === 'WORKSPACE_CONFLICT') {
      return 'This Notion workspace is already linked to another company.';
    }
    if (error.code === 'UNAUTHORIZED') {
      return 'Request was rejected by notion-service. Verify DEVSUITE_NOTION_SERVICE_TOKEN matches between client and service.';
    }
    return error.requestId
      ? `${error.message} (request ${error.requestId})`
      : error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected Notion integration error';
}

function isSlowDownError(message: string | null | undefined): boolean {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes('slow_down') || normalized.includes('too many requests')
  );
}

function getCooldownStorageKey(userId: string): string {
  return `${LOGIN_COOLDOWN_STORAGE_PREFIX}:${userId}`;
}

function readLoginCooldownUntil(userId: string): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(getCooldownStorageKey(userId));
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    window.localStorage.removeItem(getCooldownStorageKey(userId));
    return null;
  }

  if (parsed <= Date.now()) {
    window.localStorage.removeItem(getCooldownStorageKey(userId));
    return null;
  }

  return parsed;
}

function writeLoginCooldownUntil(userId: string, value: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getCooldownStorageKey(userId), String(value));
}

function clearLoginCooldown(userId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(getCooldownStorageKey(userId));
}

function IntegrationsSettingsPage() {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id ?? null;
  const { data: authSession } = authClient.useSession();
  const userId = useMemo(() => getSessionUserId(authSession), [authSession]);
  const persistedSyncTelemetry = useQuery(
    api.githubService.getNotificationSyncTelemetryForCurrentUser
  );

  const [connection, setConnection] = useState<GhConnectionStatus | null>(null);
  const [notionConnection, setNotionConnection] =
    useState<NotionConnectionStatus | null>(null);
  const [runtime, setRuntime] = useState<GhRuntimeSnapshot | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [notionStatusError, setNotionStatusError] = useState<string | null>(
    null
  );
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isLoadingNotionStatus, setIsLoadingNotionStatus] = useState(false);
  const [isStartingLogin, setIsStartingLogin] = useState(false);
  const [isStartingNotionLogin, setIsStartingNotionLogin] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isDisconnectingNotion, setIsDisconnectingNotion] = useState(false);
  const [isSyncingNotifications, setIsSyncingNotifications] = useState(false);
  const [lastSyncResult, setLastSyncResult] =
    useState<GhNotificationSyncResult | null>(null);
  const [loginCooldownUntil, setLoginCooldownUntil] = useState<number | null>(
    null
  );
  const [clockMs, setClockMs] = useState<number>(() => Date.now());

  const registerSlowDownCooldown = useCallback(
    (baseTimeMs: number) => {
      if (!userId) {
        return;
      }

      const existing = readLoginCooldownUntil(userId) ?? 0;
      const candidate = Math.max(
        existing,
        baseTimeMs + LOGIN_SLOWDOWN_COOLDOWN_MS
      );
      writeLoginCooldownUntil(userId, candidate);
      setLoginCooldownUntil(candidate);
    },
    [userId]
  );

  const loadStatus = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!userId) {
        setConnection(null);
        setRuntime(null);
        setStatusError(
          'Unable to resolve your user identity. Sign out/in and try again.'
        );
        return;
      }

      const silent = options?.silent === true;
      if (!silent) {
        setIsLoadingStatus(true);
      }

      try {
        const payload = await getGithubConnectionStatus(userId);
        setConnection(payload.connection);
        setRuntime(payload.runtime);
        setStatusError(null);
        if (
          isSlowDownError(payload.connection.lastError) &&
          payload.connection.checkedAt
        ) {
          registerSlowDownCooldown(payload.connection.checkedAt);
        }
      } catch (error) {
        const message = formatServiceError(error);
        setStatusError(message);
        if (isSlowDownError(message)) {
          registerSlowDownCooldown(Date.now());
        }
      } finally {
        if (!silent) {
          setIsLoadingStatus(false);
        }
      }
    },
    [registerSlowDownCooldown, userId]
  );

  const loadNotionStatus = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!userId || !companyId) {
        setNotionConnection(null);
        setNotionStatusError(
          !userId
            ? 'Unable to resolve your user identity. Sign out/in and try again.'
            : 'Select a company to manage Notion integration.'
        );
        return;
      }

      const silent = options?.silent === true;
      if (!silent) {
        setIsLoadingNotionStatus(true);
      }

      try {
        const payload = await getNotionConnectionStatus(userId, companyId);
        setNotionConnection(payload.connection);
        setNotionStatusError(null);
      } catch (error) {
        setNotionStatusError(formatNotionServiceError(error));
      } finally {
        if (!silent) {
          setIsLoadingNotionStatus(false);
        }
      }
    },
    [companyId, userId]
  );

  useEffect(() => {
    if (!userId) {
      setLoginCooldownUntil(null);
      return;
    }

    setLoginCooldownUntil(readLoginCooldownUntil(userId));
    void loadStatus();
  }, [loadStatus, userId]);

  useEffect(() => {
    if (!userId || !companyId) {
      setNotionConnection(null);
      return;
    }
    void loadNotionStatus();
  }, [companyId, loadNotionStatus, userId]);

  useEffect(() => {
    if (connection?.state !== 'pending') {
      return;
    }

    const timer = window.setInterval(() => {
      void loadStatus({ silent: true });
    }, PENDING_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [connection?.state, loadStatus]);

  useEffect(() => {
    if (!loginCooldownUntil) {
      return;
    }

    const timer = window.setInterval(() => {
      setClockMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loginCooldownUntil]);

  useEffect(() => {
    if (!userId || !loginCooldownUntil) {
      return;
    }

    if (loginCooldownUntil <= Date.now()) {
      clearLoginCooldown(userId);
      setLoginCooldownUntil(null);
    }
  }, [clockMs, loginCooldownUntil, userId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const currentUrl = new URL(window.location.href);
    const notionAuth = currentUrl.searchParams.get('notionAuth');
    if (!notionAuth) {
      return;
    }

    const notionMessage = currentUrl.searchParams.get('notionMessage');
    const notionCompanyId = currentUrl.searchParams.get('notionCompanyId');

    if (notionAuth === 'success') {
      showToast.success('Notion connected');
      if (companyId && notionCompanyId && notionCompanyId !== companyId) {
        showToast.info(
          'Notion was connected to a different company than currently selected.'
        );
      }
    } else {
      showToast.error(notionMessage || 'Notion connection failed');
    }

    currentUrl.searchParams.delete('notionAuth');
    currentUrl.searchParams.delete('notionMessage');
    currentUrl.searchParams.delete('notionCompanyId');
    window.history.replaceState({}, '', currentUrl.toString());
    void loadNotionStatus();
  }, [companyId, loadNotionStatus]);

  const loginCooldownRemainingMs = loginCooldownUntil
    ? Math.max(0, loginCooldownUntil - clockMs)
    : 0;
  const isLoginCoolingDown = loginCooldownRemainingMs > 0;
  const displayedSyncResult = useMemo(() => {
    if (lastSyncResult) {
      return lastSyncResult;
    }
    if (!persistedSyncTelemetry) {
      return null;
    }
    return {
      githubUser: persistedSyncTelemetry.githubUser,
      status: persistedSyncTelemetry.status,
      companiesMatched: persistedSyncTelemetry.companiesMatched,
      hasRouteMappings: persistedSyncTelemetry.hasRouteMappings,
      notificationsFetched: persistedSyncTelemetry.notificationsFetched,
      notificationsFiltered: persistedSyncTelemetry.notificationsFiltered,
      notificationsReceived: persistedSyncTelemetry.notificationsReceived,
      notificationsRouted: persistedSyncTelemetry.notificationsRouted,
      notificationsUnmatched: persistedSyncTelemetry.notificationsUnmatched,
      deliveriesCreated: persistedSyncTelemetry.deliveriesCreated,
      deliveriesUpdated: persistedSyncTelemetry.deliveriesUpdated,
      attemptedAt: persistedSyncTelemetry.lastAttemptAt,
      errorCode: persistedSyncTelemetry.errorCode,
      errorMessage: persistedSyncTelemetry.errorMessage,
    } satisfies GhNotificationSyncResult;
  }, [lastSyncResult, persistedSyncTelemetry]);

  const lastSuccessfulSyncAt = persistedSyncTelemetry?.lastSuccessAt ?? null;

  const handleStartLogin = async () => {
    if (!userId) {
      showToast.error('Unable to resolve your user identity');
      return;
    }
    if (isLoginCoolingDown) {
      showToast.warning(
        `Please wait ${formatDuration(loginCooldownRemainingMs)} before retrying GitHub login`
      );
      return;
    }

    setIsStartingLogin(true);
    try {
      const payload = await startGithubLogin(userId);
      setConnection(payload.connection);
      setStatusError(null);
      showToast.success('GitHub login started');
      if (payload.connection.verificationUri && payload.connection.userCode) {
        showToast.info('Open the GitHub URL and enter your device code');
      }
    } catch (error) {
      const message = formatServiceError(error);
      setStatusError(message);
      if (isSlowDownError(message)) {
        registerSlowDownCooldown(Date.now());
      }
      showToast.error(message);
    } finally {
      setIsStartingLogin(false);
    }
  };

  const handleDisconnect = async () => {
    if (!userId) {
      showToast.error('Unable to resolve your user identity');
      return;
    }

    setIsDisconnecting(true);
    try {
      const payload = await disconnectGithub(userId);
      setConnection(payload.connection);
      setStatusError(null);
      showToast.success('GitHub disconnected');
    } catch (error) {
      const message = formatServiceError(error);
      setStatusError(message);
      showToast.error(message);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSyncNotifications = async () => {
    if (!userId) {
      showToast.error('Unable to resolve your user identity');
      return;
    }

    setIsSyncingNotifications(true);
    try {
      const payload = await syncGithubNotifications(userId);
      setLastSyncResult(payload.sync);
      setStatusError(null);

      if (!payload.sync.hasRouteMappings) {
        showToast.warning(
          'No company GitHub routes were found. Add GitHub repositories or org mappings in company settings.'
        );
        return;
      }

      showToast.success(
        `Synced ${payload.sync.notificationsFiltered} GitHub notifications (${payload.sync.deliveriesCreated} new, ${payload.sync.deliveriesUpdated} updated)`
      );
    } catch (error) {
      const message = formatServiceError(error);
      setStatusError(message);
      showToast.error(message);
    } finally {
      setIsSyncingNotifications(false);
    }
  };

  const handleStartNotionLogin = async () => {
    if (!userId) {
      showToast.error('Unable to resolve your user identity');
      return;
    }
    if (!companyId) {
      showToast.error('Select a company before connecting Notion');
      return;
    }

    setIsStartingNotionLogin(true);
    try {
      const payload = await startNotionLogin(userId, companyId);
      setNotionConnection(payload.connection);
      setNotionStatusError(null);
      if (payload.connection.verificationUri) {
        window.location.assign(payload.connection.verificationUri);
        return;
      }
      showToast.error('Notion authorization URL is missing');
    } catch (error) {
      const message = formatNotionServiceError(error);
      setNotionStatusError(message);
      showToast.error(message);
    } finally {
      setIsStartingNotionLogin(false);
    }
  };

  const handleDisconnectNotion = async () => {
    if (!userId) {
      showToast.error('Unable to resolve your user identity');
      return;
    }
    if (!companyId) {
      showToast.error('Select a company before disconnecting Notion');
      return;
    }

    setIsDisconnectingNotion(true);
    try {
      const payload = await disconnectNotion(userId, companyId);
      setNotionConnection(payload.connection);
      setNotionStatusError(null);
      showToast.success('Notion disconnected');
    } catch (error) {
      const message = formatNotionServiceError(error);
      setNotionStatusError(message);
      showToast.error(message);
    } finally {
      setIsDisconnectingNotion(false);
    }
  };

  const isConnected = connection?.state === 'connected';
  const isPending = connection?.state === 'pending';
  const canDisconnect = Boolean(
    connection && connection.state !== 'disconnected'
  );
  const notionConnected = notionConnection?.state === 'connected';
  const canDisconnectNotion = Boolean(
    notionConnection && notionConnection.state !== 'disconnected'
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h3 className="text-lg font-medium">Integrations</h3>
        <p className="text-sm text-muted-foreground">
          Manage third-party connections and API tokens.
        </p>
      </div>
      <div className="h-[1px] bg-border" />
      <Card>
        <CardHeader>
          <CardTitle>GitHub Integration</CardTitle>
          <CardDescription>
            Connect your GitHub account for notifications and PR discovery.
            Authentication runs in the dedicated `gh-service` backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Connection status</p>
              <Badge variant={getStatusBadgeVariant(connection?.state ?? null)}>
                {getStatusLabel(connection?.state ?? null)}
              </Badge>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void loadStatus()}
              disabled={
                isLoadingStatus || isStartingLogin || isDisconnecting || !userId
              }
            >
              {isLoadingStatus ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground">Authenticated user</p>
              <p>{connection?.githubUser ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last checked</p>
              <p>{formatTimestamp(connection?.checkedAt ?? null)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Device code</p>
              <p className="font-mono">{connection?.userCode ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">GitHub service runtime</p>
              <p>
                {runtime
                  ? runtime.ghInstalled
                    ? `Installed${runtime.ghVersion ? ` (${runtime.ghVersion})` : ''}`
                    : 'Missing'
                  : '—'}
              </p>
            </div>
          </div>

          {isPending && connection?.verificationUri && (
            <Alert>
              <AlertDescription>
                Finish login in GitHub:
                <a
                  href={connection.verificationUri}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 underline"
                >
                  {connection.verificationUri}
                </a>
              </AlertDescription>
            </Alert>
          )}

          {connection?.lastError && (
            <Alert variant="destructive">
              <AlertDescription>{connection.lastError}</AlertDescription>
            </Alert>
          )}

          {isLoginCoolingDown && (
            <Alert variant="destructive">
              <AlertDescription>
                GitHub asked us to slow down. Login retry is locked for{' '}
                {formatDuration(loginCooldownRemainingMs)} (until{' '}
                {formatTimestamp(loginCooldownUntil)}).
              </AlertDescription>
            </Alert>
          )}

          {statusError && (
            <Alert variant="destructive">
              <AlertDescription>{statusError}</AlertDescription>
            </Alert>
          )}

          {displayedSyncResult && displayedSyncResult.status === 'error' && (
            <Alert variant="destructive">
              <AlertDescription>
                Last sync failed:{' '}
                {displayedSyncResult.errorMessage ?? 'Unknown sync error'}.
              </AlertDescription>
            </Alert>
          )}

          {displayedSyncResult && displayedSyncResult.status !== 'error' && (
            <Alert>
              <AlertDescription>
                Last sync ({formatTimestamp(displayedSyncResult.attemptedAt)}):
                fetched {displayedSyncResult.notificationsFetched}, routed{' '}
                {displayedSyncResult.notificationsFiltered}, created{' '}
                {displayedSyncResult.deliveriesCreated}, updated{' '}
                {displayedSyncResult.deliveriesUpdated}.
                {lastSuccessfulSyncAt
                  ? ` Last successful sync: ${formatTimestamp(lastSuccessfulSyncAt)}.`
                  : ''}
              </AlertDescription>
            </Alert>
          )}

          {runtime?.error && (
            <Alert variant="destructive">
              <AlertDescription>{runtime.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={handleStartLogin}
            disabled={
              isStartingLogin ||
              isDisconnecting ||
              !userId ||
              isLoginCoolingDown
            }
          >
            {isStartingLogin && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isLoginCoolingDown
              ? `Retry in ${formatDuration(loginCooldownRemainingMs)}`
              : isConnected
                ? 'Reconnect GitHub'
                : 'Start GitHub Login'}
          </Button>

          {isPending && connection?.verificationUri && (
            <Button type="button" variant="secondary" asChild>
              <a
                href={connection.verificationUri}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open GitHub Login
              </a>
            </Button>
          )}

          <Button
            type="button"
            variant="destructive"
            onClick={handleDisconnect}
            disabled={
              !canDisconnect || isDisconnecting || isStartingLogin || !userId
            }
          >
            {isDisconnecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Unplug className="mr-2 h-4 w-4" />
            )}
            Disconnect
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={handleSyncNotifications}
            disabled={
              !isConnected ||
              !userId ||
              isSyncingNotifications ||
              isDisconnecting ||
              isStartingLogin
            }
          >
            {isSyncingNotifications && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Sync notifications now
          </Button>

          <p className="w-full text-xs text-muted-foreground">
            Service endpoint: {getGhServiceBaseUrl()}
          </p>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notion Integration</CardTitle>
          <CardDescription>
            Connect one Notion workspace per company for task link validation
            and inbox notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Connection status</p>
              <Badge
                variant={getStatusBadgeVariant(notionConnection?.state ?? null)}
              >
                {getStatusLabel(notionConnection?.state ?? null)}
              </Badge>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void loadNotionStatus()}
              disabled={
                isLoadingNotionStatus ||
                isStartingNotionLogin ||
                isDisconnectingNotion ||
                !userId ||
                !companyId
              }
            >
              {isLoadingNotionStatus ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground">Selected company</p>
              <p>{currentCompany?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last checked</p>
              <p>{formatTimestamp(notionConnection?.checkedAt ?? null)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Workspace</p>
              <p>{notionConnection?.workspaceName ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Workspace ID</p>
              <p className="font-mono">
                {notionConnection?.workspaceId ?? '—'}
              </p>
            </div>
          </div>

          {!companyId && (
            <Alert variant="destructive">
              <AlertDescription>
                Select a company to connect Notion. One company can be linked to
                exactly one Notion workspace.
              </AlertDescription>
            </Alert>
          )}

          {notionStatusError && (
            <Alert variant="destructive">
              <AlertDescription>{notionStatusError}</AlertDescription>
            </Alert>
          )}

          {notionConnection?.lastError && (
            <Alert variant="destructive">
              <AlertDescription>{notionConnection.lastError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={handleStartNotionLogin}
            disabled={
              isStartingNotionLogin ||
              isDisconnectingNotion ||
              !userId ||
              !companyId
            }
          >
            {isStartingNotionLogin && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {notionConnected ? 'Reconnect Notion' : 'Connect Notion'}
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={handleDisconnectNotion}
            disabled={
              !canDisconnectNotion ||
              isDisconnectingNotion ||
              isStartingNotionLogin ||
              !userId ||
              !companyId
            }
          >
            {isDisconnectingNotion ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Unplug className="mr-2 h-4 w-4" />
            )}
            Disconnect
          </Button>
        </CardFooter>
      </Card>

      {!userId && (
        <Card>
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertDescription>
                User identity is unavailable in this session. Sign out and sign
                in again to use GitHub integration.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
