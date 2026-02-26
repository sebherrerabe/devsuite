import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReference } from 'convex/server';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { authClient } from '@/lib/auth';
import { showToast } from '@/lib/toast';
import { resolveGithubRouteScope } from '@/lib/github-route-scope';
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
import {
  ChevronDown,
  ExternalLink,
  Loader2,
  RefreshCw,
  Unplug,
} from 'lucide-react';
import { useCurrentCompany } from '@/lib/company-context';
import {
  disconnectNotion,
  getNotionAssigneePropertyOptions,
  getNotionConnectionStatus,
  type NotionAssigneeFilter,
  type NotionAssigneePropertyOption,
  NotionServiceRequestError,
  startNotionLogin,
  updateNotionAssigneeFilter,
} from '@/lib/notion-service-client';
import type { NotionConnectionStatus } from '@/lib/notion-service-client';
import { Switch } from '@/components/ui/switch';

export const Route = createFileRoute('/_app/settings/integrations')({
  component: IntegrationsSettingsPage,
});

const PENDING_POLL_INTERVAL_MS = 3000;
const LOGIN_SLOWDOWN_COOLDOWN_MS = 5 * 60 * 1000;
const LOGIN_COOLDOWN_STORAGE_PREFIX = 'devsuite-gh-login-cooldown-until';
const ANY_PEOPLE_PROPERTY_VALUE = '__any_people__';

interface IntegrationSettingsResponse {
  companyId: Id<'companies'>;
  userId: string;
  github: boolean;
  notion: boolean;
}

type IntegrationSettingsQueryRef = FunctionReference<
  'query',
  'public',
  { companyId: Id<'companies'> },
  IntegrationSettingsResponse
>;

type IntegrationSettingsSetEnabledRef = FunctionReference<
  'mutation',
  'public',
  {
    companyId: Id<'companies'>;
    integration: 'github' | 'notion';
    enabled: boolean;
  },
  IntegrationSettingsResponse
>;

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
    if (error.code === 'INTEGRATION_DISABLED') {
      return 'Notion integration is disabled for this company.';
    }
    if (error.code === 'WORKSPACE_CONFLICT') {
      return 'This Notion workspace is already linked to another company.';
    }
    if (error.code === 'LINK_INVALID') {
      return 'The Notion page URL is invalid, unavailable, or not shared with this integration.';
    }
    if (error.code === 'FILTER_INVALID') {
      return 'The selected assignee filter is invalid. Reload the page properties and try again.';
    }
    if (error.code === 'UNAUTHORIZED') {
      return (
        error.message ||
        'Request was rejected by notion-service. Verify VITE_NOTION_SERVICE_TOKEN matches DEVSUITE_NOTION_SERVICE_TOKEN.'
      );
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

function isHostGhAuthStatusWarning(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('not logged into any github hosts') ||
    normalized.includes('gh auth login')
  );
}

function readOptionalNumberField(source: unknown, key: string): number | null {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return null;
  }

  const value = (source as Record<string, unknown>)[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function formatDropDiagnostics(sync: GhNotificationSyncResult): string {
  return `missing org ${sync.droppedMissingOrg}, out of scope ${sync.droppedOutOfScope}, no route ${sync.droppedNoRouteMatch}, stale ${sync.droppedStaleThread}`;
}

function IntegrationsSettingsPage() {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id ?? null;
  const { data: authSession } = authClient.useSession();
  const userId = useMemo(() => getSessionUserId(authSession), [authSession]);
  const integrationSettingsApi = (
    api as unknown as {
      integrationSettings: {
        getForCompany: IntegrationSettingsQueryRef;
        setEnabled: IntegrationSettingsSetEnabledRef;
      };
    }
  ).integrationSettings;
  const integrationSettings = useQuery(
    integrationSettingsApi.getForCompany,
    companyId ? { companyId } : 'skip'
  );
  const repositories = useQuery(
    api.repositories.getByCompany,
    companyId ? { companyId } : 'skip'
  );
  const setIntegrationEnabled = useMutation(integrationSettingsApi.setEnabled);
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
  const [notionAssigneeSourceUrl, setNotionAssigneeSourceUrl] = useState('');
  const [notionAssigneeDataSourceId, setNotionAssigneeDataSourceId] = useState<
    string | null
  >(null);
  const [notionAssigneeOptions, setNotionAssigneeOptions] = useState<
    NotionAssigneePropertyOption[]
  >([]);
  const [
    selectedNotionAssigneePropertyId,
    setSelectedNotionAssigneePropertyId,
  ] = useState<string>(ANY_PEOPLE_PROPERTY_VALUE);
  const [
    selectedNotionAssigneePropertyName,
    setSelectedNotionAssigneePropertyName,
  ] = useState<string | null>(null);
  const [notionAssigneeError, setNotionAssigneeError] = useState<string | null>(
    null
  );
  const [isLoadingNotionAssigneeOptions, setIsLoadingNotionAssigneeOptions] =
    useState(false);
  const [isSavingNotionAssigneeFilter, setIsSavingNotionAssigneeFilter] =
    useState(false);
  const [isSyncingNotifications, setIsSyncingNotifications] = useState(false);
  const [lastSyncResult, setLastSyncResult] =
    useState<GhNotificationSyncResult | null>(null);
  const [isUpdatingGithubEnabled, setIsUpdatingGithubEnabled] = useState(false);
  const [isUpdatingNotionEnabled, setIsUpdatingNotionEnabled] = useState(false);
  const [expandedIntegration, setExpandedIntegration] = useState<
    'github' | 'notion'
  >('github');
  const [loginCooldownUntil, setLoginCooldownUntil] = useState<number | null>(
    null
  );
  const [clockMs, setClockMs] = useState<number>(() => Date.now());
  const githubEnabled = integrationSettings?.github ?? false;
  const notionEnabled = integrationSettings?.notion ?? false;
  const githubRouteScope = useMemo(
    () =>
      resolveGithubRouteScope({
        companyMetadata: currentCompany?.metadata,
        repositories,
      }),
    [currentCompany?.metadata, repositories]
  );

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
        setNotionAssigneeDataSourceId(null);
        setNotionAssigneeOptions([]);
        setSelectedNotionAssigneePropertyId(ANY_PEOPLE_PROPERTY_VALUE);
        setSelectedNotionAssigneePropertyName(null);
        setNotionAssigneeError(null);
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
        const currentFilter = payload.connection.assigneeFilter;
        if (
          currentFilter.mode === 'specific_property' &&
          currentFilter.propertyId
        ) {
          setSelectedNotionAssigneePropertyId(currentFilter.propertyId);
          setSelectedNotionAssigneePropertyName(currentFilter.propertyName);
          setNotionAssigneeDataSourceId(currentFilter.dataSourceId);
        } else {
          setSelectedNotionAssigneePropertyId(ANY_PEOPLE_PROPERTY_VALUE);
          setSelectedNotionAssigneePropertyName(null);
          setNotionAssigneeDataSourceId(null);
        }
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
    if (!companyId || !githubEnabled) {
      setConnection(null);
      setRuntime(null);
      setStatusError(null);
      return;
    }
    void loadStatus();
  }, [companyId, githubEnabled, loadStatus, userId]);

  useEffect(() => {
    if (!userId || !companyId || !notionEnabled) {
      setNotionConnection(null);
      return;
    }
    void loadNotionStatus();
  }, [companyId, loadNotionStatus, notionEnabled, userId]);

  useEffect(() => {
    if (connection?.state !== 'pending' || !githubEnabled) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadStatus({ silent: true });
    }, PENDING_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [connection?.state, githubEnabled, loadStatus]);

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
    if (notionEnabled) {
      void loadNotionStatus();
    }
  }, [companyId, loadNotionStatus, notionEnabled]);

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
      droppedMissingOrg:
        readOptionalNumberField(persistedSyncTelemetry, 'droppedMissingOrg') ??
        0,
      droppedOutOfScope:
        readOptionalNumberField(persistedSyncTelemetry, 'droppedOutOfScope') ??
        0,
      droppedNoRouteMatch:
        readOptionalNumberField(
          persistedSyncTelemetry,
          'droppedNoRouteMatch'
        ) ?? 0,
      droppedStaleThread:
        readOptionalNumberField(persistedSyncTelemetry, 'droppedStaleThread') ??
        0,
      attemptedAt: persistedSyncTelemetry.lastAttemptAt,
      errorCode: persistedSyncTelemetry.errorCode,
      errorMessage: persistedSyncTelemetry.errorMessage,
    } satisfies GhNotificationSyncResult;
  }, [lastSyncResult, persistedSyncTelemetry]);

  const lastSuccessfulSyncAt = persistedSyncTelemetry?.lastSuccessAt ?? null;
  const runtimeStatusMessage = useMemo(() => {
    if (!runtime?.error) {
      return null;
    }
    if (isHostGhAuthStatusWarning(runtime.error)) {
      return 'GitHub CLI is not signed in at the service host. DevSuite uses your encrypted per-user token for sync, so this is informational when your connection is connected.';
    }
    return runtime.error;
  }, [runtime?.error]);
  const showRuntimeAsError = runtime?.error
    ? !isHostGhAuthStatusWarning(runtime.error)
    : false;

  const handleStartLogin = async () => {
    if (!userId) {
      showToast.error('Unable to resolve your user identity');
      return;
    }
    if (!githubEnabled) {
      showToast.error('Enable GitHub integration for this company first');
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
    if (!githubEnabled) {
      showToast.error('Enable GitHub integration for this company first');
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
    if (!githubEnabled) {
      showToast.error('Enable GitHub integration for this company first');
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
        `Synced ${payload.sync.notificationsFiltered} in-scope GitHub notifications (${payload.sync.notificationsRouted} routed, ${payload.sync.deliveriesCreated} new, ${payload.sync.deliveriesUpdated} updated, dropped: ${formatDropDiagnostics(payload.sync)})`
      );
    } catch (error) {
      const message = formatServiceError(error);
      setStatusError(message);
      showToast.error(message);
    } finally {
      setIsSyncingNotifications(false);
    }
  };

  const handleLoadNotionAssigneeOptions = async () => {
    if (!userId) {
      showToast.error('Unable to resolve your user identity');
      return;
    }
    if (!companyId) {
      showToast.error('Select a company before configuring Notion');
      return;
    }
    if (!notionConnected) {
      showToast.error('Connect Notion before configuring assignee filters');
      return;
    }
    if (!notionEnabled) {
      showToast.error('Enable Notion integration for this company first');
      return;
    }
    if (!notionAssigneeSourceUrl.trim()) {
      showToast.error('Paste a Notion page URL to load people properties');
      return;
    }

    setIsLoadingNotionAssigneeOptions(true);
    try {
      const payload = await getNotionAssigneePropertyOptions(
        userId,
        companyId,
        notionAssigneeSourceUrl.trim()
      );
      setNotionAssigneeOptions(payload.options.options);
      setNotionAssigneeDataSourceId(payload.options.dataSourceId);
      setNotionAssigneeError(null);

      if (
        payload.options.selected.mode === 'specific_property' &&
        payload.options.selected.propertyId
      ) {
        setSelectedNotionAssigneePropertyId(
          payload.options.selected.propertyId
        );
        const matchedOption = payload.options.options.find(
          option => option.id === payload.options.selected.propertyId
        );
        setSelectedNotionAssigneePropertyName(
          matchedOption?.name ?? payload.options.selected.propertyName
        );
      } else {
        setSelectedNotionAssigneePropertyId(ANY_PEOPLE_PROPERTY_VALUE);
        setSelectedNotionAssigneePropertyName(null);
      }

      showToast.success(
        payload.options.options.length > 0
          ? `Loaded ${payload.options.options.length} people properties`
          : 'No people properties found on that page'
      );
    } catch (error) {
      const message = formatNotionServiceError(error);
      setNotionAssigneeError(message);
      showToast.error(message);
    } finally {
      setIsLoadingNotionAssigneeOptions(false);
    }
  };

  const handleSaveNotionAssigneeFilter = async () => {
    if (!userId) {
      showToast.error('Unable to resolve your user identity');
      return;
    }
    if (!companyId) {
      showToast.error('Select a company before configuring Notion');
      return;
    }
    if (!notionConnected) {
      showToast.error('Connect Notion before configuring assignee filters');
      return;
    }
    if (!notionEnabled) {
      showToast.error('Enable Notion integration for this company first');
      return;
    }

    const selectedOption = notionAssigneeOptions.find(
      option => option.id === selectedNotionAssigneePropertyId
    );

    let nextFilter: NotionAssigneeFilter;
    if (selectedNotionAssigneePropertyId === ANY_PEOPLE_PROPERTY_VALUE) {
      nextFilter = {
        mode: 'any_people',
        dataSourceId: null,
        propertyId: null,
        propertyName: null,
      };
    } else {
      if (!notionAssigneeDataSourceId) {
        showToast.error(
          'Load people properties from a Notion page before selecting a specific property'
        );
        return;
      }

      nextFilter = {
        mode: 'specific_property',
        dataSourceId: notionAssigneeDataSourceId,
        propertyId: selectedNotionAssigneePropertyId,
        propertyName:
          selectedOption?.name ?? selectedNotionAssigneePropertyName,
      };
    }

    setIsSavingNotionAssigneeFilter(true);
    try {
      const payload = await updateNotionAssigneeFilter(
        userId,
        companyId,
        nextFilter
      );
      setNotionConnection(payload.connection);
      setNotionStatusError(null);
      setNotionAssigneeError(null);
      setSelectedNotionAssigneePropertyName(nextFilter.propertyName);
      showToast.success(
        nextFilter.mode === 'specific_property'
          ? `Notion filter saved (${nextFilter.propertyName ?? 'selected property'})`
          : 'Notion filter saved (any people property)'
      );
    } catch (error) {
      const message = formatNotionServiceError(error);
      setNotionAssigneeError(message);
      showToast.error(message);
    } finally {
      setIsSavingNotionAssigneeFilter(false);
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
    if (!notionEnabled) {
      showToast.error('Enable Notion integration for this company first');
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
    if (!notionEnabled) {
      showToast.error('Enable Notion integration for this company first');
      return;
    }

    setIsDisconnectingNotion(true);
    try {
      const payload = await disconnectNotion(userId, companyId);
      setNotionConnection(payload.connection);
      setNotionStatusError(null);
      setNotionAssigneeDataSourceId(null);
      setNotionAssigneeOptions([]);
      setSelectedNotionAssigneePropertyId(ANY_PEOPLE_PROPERTY_VALUE);
      setSelectedNotionAssigneePropertyName(null);
      setNotionAssigneeError(null);
      setNotionAssigneeSourceUrl('');
      showToast.success('Notion disconnected');
    } catch (error) {
      const message = formatNotionServiceError(error);
      setNotionStatusError(message);
      showToast.error(message);
    } finally {
      setIsDisconnectingNotion(false);
    }
  };

  const handleSetIntegrationEnabled = async (
    integration: 'github' | 'notion',
    enabled: boolean
  ) => {
    if (!companyId) {
      showToast.error('Select a company before changing integration settings');
      return;
    }

    const setLoading =
      integration === 'github'
        ? setIsUpdatingGithubEnabled
        : setIsUpdatingNotionEnabled;
    setLoading(true);
    try {
      await setIntegrationEnabled({
        companyId,
        integration,
        enabled,
      });
      const label = integration === 'github' ? 'GitHub' : 'Notion';
      showToast.success(
        `${label} integration ${enabled ? 'enabled' : 'disabled'} for this company`
      );
    } catch (error) {
      showToast.error(
        error instanceof Error
          ? error.message
          : 'Failed to update integration setting'
      );
    } finally {
      setLoading(false);
    }
  };

  const isConnected = connection?.state === 'connected';
  const isPending = connection?.state === 'pending';
  const isGithubExpanded = expandedIntegration === 'github';
  const isNotionExpanded = expandedIntegration === 'notion';
  const canDisconnect = Boolean(
    connection && connection.state !== 'disconnected'
  );
  const notionConnected = notionConnection?.state === 'connected';
  const canDisconnectNotion = Boolean(
    notionConnection && notionConnection.state !== 'disconnected'
  );
  const currentNotionAssigneeFilter = notionConnection?.assigneeFilter ?? null;
  const displayedNotionAssigneePropertyName = useMemo(() => {
    if (!currentNotionAssigneeFilter) {
      return null;
    }
    if (currentNotionAssigneeFilter.mode !== 'specific_property') {
      return null;
    }
    if (selectedNotionAssigneePropertyName) {
      return selectedNotionAssigneePropertyName;
    }
    return currentNotionAssigneeFilter.propertyName;
  }, [currentNotionAssigneeFilter, selectedNotionAssigneePropertyName]);
  const notionAssigneeModeLabel =
    currentNotionAssigneeFilter?.mode === 'specific_property'
      ? `Specific people property${displayedNotionAssigneePropertyName ? ` (${displayedNotionAssigneePropertyName})` : ''}`
      : notionConnected
        ? 'Any people property'
        : '—';
  const notionAssigneeOptionsForSelect = useMemo(() => {
    if (selectedNotionAssigneePropertyId === ANY_PEOPLE_PROPERTY_VALUE) {
      return notionAssigneeOptions;
    }
    const alreadyPresent = notionAssigneeOptions.some(
      option => option.id === selectedNotionAssigneePropertyId
    );
    if (alreadyPresent) {
      return notionAssigneeOptions;
    }
    return [
      {
        id: selectedNotionAssigneePropertyId,
        name:
          displayedNotionAssigneePropertyName ?? 'Current configured property',
      },
      ...notionAssigneeOptions,
    ];
  }, [
    displayedNotionAssigneePropertyName,
    notionAssigneeOptions,
    selectedNotionAssigneePropertyId,
  ]);

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
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => setExpandedIntegration('github')}
              className="flex flex-1 items-start justify-between gap-3 text-left"
            >
              <div>
                <CardTitle>GitHub Integration</CardTitle>
                <CardDescription className="mt-1">
                  Connect your GitHub account for notifications and PR
                  discovery. Authentication runs in the dedicated `gh-service`
                  backend.
                </CardDescription>
              </div>
              <ChevronDown
                className={`mt-1 h-4 w-4 transition-transform ${isGithubExpanded ? 'rotate-180' : ''}`}
              />
            </button>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">Enabled</span>
              <Switch
                checked={githubEnabled}
                onCheckedChange={checked =>
                  void handleSetIntegrationEnabled('github', checked)
                }
                disabled={!companyId || isUpdatingGithubEnabled || !userId}
                aria-label="Toggle GitHub integration for this company"
              />
            </div>
          </div>
        </CardHeader>
        {isGithubExpanded && (
          <>
            <CardContent className="space-y-4">
              {!githubEnabled && companyId && (
                <Alert>
                  <AlertDescription>
                    GitHub integration is disabled for this company.
                    Notification routing and sync are paused.
                  </AlertDescription>
                </Alert>
              )}
              <Alert
                variant={
                  githubRouteScope.length === 0 ? 'destructive' : undefined
                }
              >
                <AlertDescription>
                  {githubRouteScope.length === 0 ? (
                    <>
                      No GitHub route scope is configured for this company. Add
                      GitHub org logins in Company settings or add GitHub
                      repositories so notifications can be routed.
                    </>
                  ) : (
                    <>
                      Active GitHub scope for this company:{' '}
                      <span className="font-medium">
                        {githubRouteScope.join(', ')}
                      </span>
                      . DevSuite only routes notifications whose repository
                      owner matches this scope.
                    </>
                  )}
                </AlertDescription>
              </Alert>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Connection status
                  </p>
                  <Badge
                    variant={getStatusBadgeVariant(connection?.state ?? null)}
                  >
                    {getStatusLabel(connection?.state ?? null)}
                  </Badge>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void loadStatus()}
                  disabled={
                    isLoadingStatus ||
                    isStartingLogin ||
                    isDisconnecting ||
                    !userId ||
                    !githubEnabled
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

              <div className="grid gap-3 text-sm sm:grid-cols-2">
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
                  <p className="text-muted-foreground">
                    GitHub service runtime
                  </p>
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

              {displayedSyncResult &&
                displayedSyncResult.status === 'error' && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Last sync failed:{' '}
                      {displayedSyncResult.errorMessage ?? 'Unknown sync error'}
                      .
                    </AlertDescription>
                  </Alert>
                )}

              {displayedSyncResult &&
                displayedSyncResult.status !== 'error' && (
                  <Alert>
                    <AlertDescription>
                      Last sync (
                      {formatTimestamp(displayedSyncResult.attemptedAt)}):
                      fetched {displayedSyncResult.notificationsFetched}, in
                      scope {displayedSyncResult.notificationsFiltered}, routed{' '}
                      {displayedSyncResult.notificationsRouted}, created{' '}
                      {displayedSyncResult.deliveriesCreated}, updated{' '}
                      {displayedSyncResult.deliveriesUpdated}, dropped{' '}
                      {formatDropDiagnostics(displayedSyncResult)}.
                      {lastSuccessfulSyncAt
                        ? ` Last successful sync: ${formatTimestamp(lastSuccessfulSyncAt)}.`
                        : ''}
                    </AlertDescription>
                  </Alert>
                )}

              {runtimeStatusMessage && (
                <Alert variant={showRuntimeAsError ? 'destructive' : undefined}>
                  <AlertDescription>{runtimeStatusMessage}</AlertDescription>
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
                  isLoginCoolingDown ||
                  !githubEnabled
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
                  !canDisconnect ||
                  isDisconnecting ||
                  isStartingLogin ||
                  !userId ||
                  !githubEnabled
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
                  !githubEnabled ||
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
          </>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => setExpandedIntegration('notion')}
              className="flex flex-1 items-start justify-between gap-3 text-left"
            >
              <div>
                <CardTitle>Notion Integration</CardTitle>
                <CardDescription className="mt-1">
                  Connect one Notion workspace per company for task link
                  validation and inbox notifications.
                </CardDescription>
              </div>
              <ChevronDown
                className={`mt-1 h-4 w-4 transition-transform ${isNotionExpanded ? 'rotate-180' : ''}`}
              />
            </button>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">Enabled</span>
              <Switch
                checked={notionEnabled}
                onCheckedChange={checked =>
                  void handleSetIntegrationEnabled('notion', checked)
                }
                disabled={!companyId || isUpdatingNotionEnabled || !userId}
                aria-label="Toggle Notion integration for this company"
              />
            </div>
          </div>
        </CardHeader>
        {isNotionExpanded && (
          <>
            <CardContent className="space-y-4">
              {!notionEnabled && companyId && (
                <Alert>
                  <AlertDescription>
                    Notion integration is disabled for this company. Webhook
                    routing and Notion-specific processing are paused.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Connection status
                  </p>
                  <Badge
                    variant={getStatusBadgeVariant(
                      notionConnection?.state ?? null
                    )}
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
                    isLoadingNotionAssigneeOptions ||
                    isSavingNotionAssigneeFilter ||
                    !userId ||
                    !companyId ||
                    !notionEnabled
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

              <div className="grid gap-3 text-sm sm:grid-cols-2">
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
                <div>
                  <p className="text-muted-foreground">Webhook assignee mode</p>
                  <p>{notionAssigneeModeLabel}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Filter data source ID</p>
                  <p className="font-mono">
                    {currentNotionAssigneeFilter?.dataSourceId ?? '—'}
                  </p>
                </div>
              </div>

              {!companyId && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Select a company to connect Notion. One company can be
                    linked to exactly one Notion workspace.
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
                  <AlertDescription>
                    {notionConnection.lastError}
                  </AlertDescription>
                </Alert>
              )}

              {notionConnected && notionEnabled && (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Assignee property filter
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Load people properties from a task page URL, then select
                      which people property should be used to route
                      notifications to the authenticated Notion user.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Source page URL
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={notionAssigneeSourceUrl}
                        onChange={event =>
                          setNotionAssigneeSourceUrl(event.currentTarget.value)
                        }
                        placeholder="https://www.notion.so/..."
                        disabled={
                          isLoadingNotionAssigneeOptions ||
                          isSavingNotionAssigneeFilter
                        }
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleLoadNotionAssigneeOptions}
                        disabled={
                          isLoadingNotionAssigneeOptions ||
                          isSavingNotionAssigneeFilter
                        }
                      >
                        {isLoadingNotionAssigneeOptions && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Load properties
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Property used for assignee matching
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Select
                        value={selectedNotionAssigneePropertyId}
                        onValueChange={value => {
                          setSelectedNotionAssigneePropertyId(value);
                          const option = notionAssigneeOptionsForSelect.find(
                            item => item.id === value
                          );
                          setSelectedNotionAssigneePropertyName(
                            option?.name ?? null
                          );
                        }}
                        disabled={isSavingNotionAssigneeFilter}
                      >
                        <SelectTrigger className="w-full sm:flex-1">
                          <SelectValue placeholder="Select a people property" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ANY_PEOPLE_PROPERTY_VALUE}>
                            Any people property
                          </SelectItem>
                          {notionAssigneeOptionsForSelect.map(option => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        type="button"
                        onClick={handleSaveNotionAssigneeFilter}
                        disabled={isSavingNotionAssigneeFilter}
                      >
                        {isSavingNotionAssigneeFilter && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Save filter
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Loaded data source ID:{' '}
                      <span className="font-mono">
                        {notionAssigneeDataSourceId ?? '—'}
                      </span>
                    </p>
                  </div>

                  {notionAssigneeError && (
                    <Alert variant="destructive">
                      <AlertDescription>{notionAssigneeError}</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleStartNotionLogin}
                disabled={
                  isStartingNotionLogin ||
                  isDisconnectingNotion ||
                  isLoadingNotionAssigneeOptions ||
                  isSavingNotionAssigneeFilter ||
                  !userId ||
                  !companyId ||
                  !notionEnabled
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
                  isLoadingNotionAssigneeOptions ||
                  isSavingNotionAssigneeFilter ||
                  !userId ||
                  !companyId ||
                  !notionEnabled
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
          </>
        )}
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
