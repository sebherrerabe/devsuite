import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { clearInterval, setInterval } from 'node:timers';
import { URL, fileURLToPath } from 'node:url';
import type {
  BrowserWindow as BrowserWindowType,
  Event as ElectronEvent,
  MessageBoxOptions,
  Tray as TrayType,
} from 'electron';

import {
  DEFAULT_COMPANION_SHORTCUT,
  loadCompanionShortcut,
  loadDesktopRuntimePreferences,
  loadDesktopFocusSettings,
  parseCompanionShortcut,
  saveCompanionShortcut,
  saveDesktopRuntimePreferences,
  saveDesktopFocusSettings,
  type DesktopRuntimePreferences,
} from './settings-store.js';
import {
  clearDesktopSessionScope,
  loadDesktopSessionScope,
  saveDesktopSessionScope,
} from './session-scope-store.js';
import {
  createDefaultDesktopFocusSettings,
  parseDesktopSettingsScope,
  type DesktopFocusSettings,
  type DesktopSettingsScope,
} from './focus-settings.js';
import {
  createDefaultDesktopSessionState,
  getDesktopSessionActionAvailability,
  parseDesktopSessionAction,
  parseDesktopSessionEndDecision,
  parseDesktopSessionState,
  type DesktopSessionAction,
  type DesktopSessionEndDecision,
  type DesktopSessionState,
} from './session-control.js';
import {
  parseDesktopNotificationActionEvent,
  parseDesktopNotificationRequest,
  shouldThrottleDesktopNotification,
  type DesktopNotificationActionEvent,
  type DesktopNotificationRequest,
} from './notifications.js';
import {
  WindowsProcessMonitor,
  createProcessWatchConfigFromFocusSettings,
  listWindowsProcessesVerbose,
  normalizeProcessWatchConfig,
  type DesktopProcessEvent,
} from './process-monitor.js';
import {
  blockDomains,
  cleanupStaleBlocks,
  HOSTS_WRITE_HELPER_BASE64_ARG,
  HOSTS_WRITE_HELPER_FLAG,
  HOSTS_WRITE_HELPER_PATH_ARG,
  reconcileDomains,
  unblockAll,
} from './hosts-manager.js';
import {
  applyStrictPolicyOverride,
  createDefaultStrictPolicyState,
  evaluateStrictPolicy,
  type DesktopWebsiteEvent,
  type StrictPolicyAuditEvent,
  type StrictPolicyState,
} from './strict-policy-engine.js';
import { executeStrictPolicyActions } from './strict-policy-actions.js';
import { runtimeLog } from './runtime-logger.js';
import { broadcastDesktopSessionStateToWindows } from './session-state-broadcast.js';
import {
  getSessionWidgetWindowOptions,
  getSessionWidgetSize,
  positionWidgetBottomRight,
  type SessionWidgetMode,
} from './widget-window.js';
import {
  registerDesktopWindowIpcHandlers,
  wireDesktopWindowMaximizeEvents,
} from './window-controls-ipc.js';
import {
  resolveAllowedDesktopNavigationOrigins,
  shouldAllowInAppNavigation,
  shouldOpenInExternalBrowser,
} from './web-content-security.js';
import { shouldGrantDesktopPermission } from './desktop-permissions.js';
import { resolveRendererUrl as resolveRendererUrlWithOptions } from './renderer-url.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  shell,
  Menu,
  Tray,
  protocol,
  nativeImage,
  Notification,
  dialog,
  globalShortcut,
  screen,
} = require('electron') as typeof import('electron');
const DESKTOP_PARTITION = 'persist:devsuite';
const SESSION_COMMAND_CHANNEL = 'desktop-session:command';
const SESSION_STATE_CHANGED_CHANNEL = 'desktop-session:state-changed';
const NOTIFICATION_ACTION_CHANNEL = 'desktop-notification:action';
const PROCESS_EVENTS_CHANNEL = 'desktop-process-monitor:events';
const POLICY_AUDIT_CHANNEL = 'desktop-policy:audit-events';
const MAX_PROCESS_EVENT_LOG = 500;
const MAX_POLICY_AUDIT_LOG = 1000;
const POLICY_TICK_INTERVAL_MS = 5_000;
const SESSION_DURATION_REGRESSION_TOLERANCE_MS = 1_500;
const MAX_PENDING_NOTIFICATION_ACTIONS = 32;
const TRAY_ICON_SIZE_PX = 16;
const WEBSITE_SOURCE_PREFIX = 'webcontents';
const ENABLE_TEST_IPC = process.env.DEVSUITE_DESKTOP_ENABLE_TEST_IPC === '1';
const TEST_IPC_RENDERER_SWITCH = '--devsuite-enable-test-ipc=1';
const TEST_IPC_RENDERER_ARGS = ENABLE_TEST_IPC
  ? [TEST_IPC_RENDERER_SWITCH]
  : [];
const SHOW_COMPANION_ARG = '--show-companion';
const COMPANION_ROUTE_PATH = '/session-companion';
const DESKTOP_ADDITIONAL_NAV_ORIGINS =
  process.env.DEVSUITE_DESKTOP_NAV_ALLOW_ORIGINS;
const ICON_FILENAME_PRIMARY =
  process.platform === 'win32' ? 'icon.ico' : 'icon.png';
const ICON_FILENAME_FALLBACK =
  process.platform === 'win32' ? 'icon.png' : 'icon.ico';
const RUNTIME_ASSETS_DIR = join(process.resourcesPath, 'assets');
const BUNDLED_ASSETS_DIR = join(__dirname, '..', 'assets');
const APP_ICON_CANDIDATE_PATHS = [
  join(RUNTIME_ASSETS_DIR, ICON_FILENAME_PRIMARY),
  join(RUNTIME_ASSETS_DIR, ICON_FILENAME_FALLBACK),
  join(BUNDLED_ASSETS_DIR, ICON_FILENAME_PRIMARY),
  join(BUNDLED_ASSETS_DIR, ICON_FILENAME_FALLBACK),
  process.execPath,
];
const TRAY_ICON_CANDIDATE_PATHS = [
  join(RUNTIME_ASSETS_DIR, 'icon.ico'),
  join(RUNTIME_ASSETS_DIR, 'icon.png'),
  join(BUNDLED_ASSETS_DIR, 'icon.ico'),
  join(BUNDLED_ASSETS_DIR, 'icon.png'),
  process.execPath,
];

function resolveExistingPath(candidates: readonly string[]): string {
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return process.execPath;
}

const APP_ICON_PATH = resolveExistingPath(APP_ICON_CANDIDATE_PATHS);

if (
  process.env.CI === 'true' ||
  process.env.DEVSUITE_DESKTOP_DISABLE_GPU === '1'
) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
}

const BOOTSTRAP_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DevSuite Desktop</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: linear-gradient(140deg, #f8fafc, #dbeafe);
        color: #0f172a;
      }
      main {
        width: min(560px, 90vw);
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid #bfdbfe;
        border-radius: 14px;
        padding: 24px;
      }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 0 0 8px; line-height: 1.5; }
      code {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 6px;
        background: #dbeafe;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>DevSuite Desktop Started</h1>
      <p>The desktop shell is running, but the web UI is unavailable.</p>
      <p>
        Set <code>DEVSUITE_WEB_URL</code> to a running web app URL (for example:
        <code>http://localhost:5173</code>).
      </p>
    </main>
  </body>
</html>
`;
const RENDERER_PROTOCOL_SCHEME = 'devsuite';
const RENDERER_PROTOCOL_HOST = 'app';
const RENDERER_DIRECTORY = join(__dirname, '..', 'renderer');
const RENDERER_INDEX_PATH = join(RENDERER_DIRECTORY, 'index.html');
const RENDERER_MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: RENDERER_PROTOCOL_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

let ipcRegistered = false;
let mainWindowRef: BrowserWindowType | null = null;
let sessionWidgetWindowRef: BrowserWindowType | null = null;
let trayRef: TrayType | null = null;
let desktopSessionScope: DesktopSettingsScope | null = null;
let desktopSessionState: DesktopSessionState =
  createDefaultDesktopSessionState();
let desktopFocusSettings: DesktopFocusSettings =
  createDefaultDesktopFocusSettings();
let strictPolicyState: StrictPolicyState = createDefaultStrictPolicyState();
const notificationSentAtByKey = new Map<string, number>();
const pendingNotificationActions: DesktopNotificationActionEvent[] = [];
let processEventLog: DesktopProcessEvent[] = [];
let policyAuditLog: StrictPolicyAuditEvent[] = [];
const blockedWebsiteBySourceId = new Map<string, string>();
let policyTickTimer: ReturnType<typeof setInterval> | null = null;
let rendererProtocolRegistered = false;
let companionShortcut = DEFAULT_COMPANION_SHORTCUT;
let registeredCompanionShortcut: string | null = null;
let desktopRuntimePreferences: DesktopRuntimePreferences = {
  openAtLogin: true,
  runInBackgroundOnClose: false,
};
let isAppQuitting = false;
let isClosingSessionWidgetProgrammatically = false;
let sessionWidgetDismissedByUser = false;
let sessionWidgetMode: SessionWidgetMode = 'mini';
const lastEffectiveDurationBySessionId = new Map<string, number>();
const allowedDesktopNavigationOrigins = resolveAllowedDesktopNavigationOrigins({
  webUrl: process.env.DEVSUITE_WEB_URL,
  nodeEnv: process.env.NODE_ENV,
  additionalOriginsCsv: DESKTOP_ADDITIONAL_NAV_ORIGINS,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseInteger(value: unknown, fieldName: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer.`);
  }
  return value as number;
}

function parseNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return trimmed;
}

function parseSessionWidgetMode(value: unknown): SessionWidgetMode {
  if (value === 'mini' || value === 'expanded') {
    return value;
  }

  throw new Error('Session widget mode must be "mini" or "expanded".');
}

function hasShowCompanionArg(argv: readonly string[]): boolean {
  return argv.includes(SHOW_COMPANION_ARG);
}

function hasHostsWriteHelperArg(argv: readonly string[]): boolean {
  return argv.includes(HOSTS_WRITE_HELPER_FLAG);
}

function readCliArgValue(argv: readonly string[], flag: string): string | null {
  const flagIndex = argv.indexOf(flag);
  if (flagIndex === -1) {
    return null;
  }

  const value = argv[flagIndex + 1];
  return typeof value === 'string' ? value : null;
}

async function runHostsWriteHelperMode(argv: readonly string[]): Promise<void> {
  try {
    const hostsPath = parseNonEmptyString(
      readCliArgValue(argv, HOSTS_WRITE_HELPER_PATH_ARG),
      HOSTS_WRITE_HELPER_PATH_ARG
    );
    const encodedContents = parseNonEmptyString(
      readCliArgValue(argv, HOSTS_WRITE_HELPER_BASE64_ARG),
      HOSTS_WRITE_HELPER_BASE64_ARG
    );
    const decodedBytes = Buffer.from(encodedContents, 'base64');
    await writeFile(hostsPath, decodedBytes);
    process.exit(0);
  } catch (error) {
    console.error('[desktop] Elevated hosts helper failed.', error);
    process.exit(1);
  }
}

function parseDesktopProcessEventForTest(input: unknown): DesktopProcessEvent {
  if (!isRecord(input)) {
    throw new Error('Desktop process event must be an object.');
  }

  const type = input.type;
  if (type !== 'process_started' && type !== 'process_stopped') {
    throw new Error('Desktop process event type is invalid.');
  }

  const category = input.category;
  if (category !== 'ide' && category !== 'app_block') {
    throw new Error('Desktop process event category is invalid.');
  }

  return {
    type,
    executable: parseNonEmptyString(
      input.executable,
      'executable'
    ).toLowerCase(),
    pid: parseInteger(input.pid, 'pid'),
    category,
    timestamp: parseInteger(input.timestamp, 'timestamp'),
  };
}

function parseDesktopProcessEventsForTest(
  input: unknown
): DesktopProcessEvent[] {
  if (!Array.isArray(input)) {
    throw new Error('Desktop process events payload must be an array.');
  }

  return input.map(parseDesktopProcessEventForTest);
}

function parseDesktopWebsiteEventForTest(input: unknown): DesktopWebsiteEvent {
  if (!isRecord(input)) {
    throw new Error('Desktop website event must be an object.');
  }

  const type = input.type;
  if (
    type !== 'website_blocked_started' &&
    type !== 'website_blocked_stopped'
  ) {
    throw new Error('Desktop website event type is invalid.');
  }

  return {
    type,
    domain: parseNonEmptyString(input.domain, 'domain').toLowerCase(),
    sourceId: parseNonEmptyString(input.sourceId, 'sourceId'),
    timestamp: parseInteger(input.timestamp, 'timestamp'),
  };
}

function parseDesktopWebsiteEventsForTest(
  input: unknown
): DesktopWebsiteEvent[] {
  if (!Array.isArray(input)) {
    throw new Error('Desktop website events payload must be an array.');
  }

  return input.map(parseDesktopWebsiteEventForTest);
}

const processMonitor = new WindowsProcessMonitor({
  onEvents: async events => {
    await handleDesktopProcessEvents(events);
  },
});

function areScopesEqual(
  left: DesktopSettingsScope,
  right: DesktopSettingsScope
) {
  return left.userId === right.userId && left.companyId === right.companyId;
}

function getDesktopSessionStateSnapshot(): DesktopSessionState {
  return {
    ...desktopSessionState,
  };
}

function getAuthenticatedDesktopScope(): DesktopSettingsScope | null {
  if (!desktopSessionScope) {
    return null;
  }

  if (desktopSessionState.connectionState !== 'connected') {
    return null;
  }

  return desktopSessionScope;
}

function isRunningOrPaused(status: DesktopSessionState['status']): boolean {
  return status === 'RUNNING' || status === 'PAUSED';
}

async function syncHostsBlockingForSessionTransition(params: {
  previousStatus: DesktopSessionState['status'];
  nextStatus: DesktopSessionState['status'];
  domains: string[];
}): Promise<void> {
  if (params.previousStatus === 'IDLE' && params.nextStatus === 'RUNNING') {
    const result = await blockDomains(params.domains);
    runtimeLog.info(
      'hosts-manager',
      `session transition to RUNNING: hosts block ${result.applied ? 'applied' : 'skipped'} for domains=${result.normalizedDomains.join(',') || 'none'}`
    );
    return;
  }

  if (
    isRunningOrPaused(params.previousStatus) &&
    params.nextStatus === 'IDLE'
  ) {
    const result = await unblockAll();
    runtimeLog.info(
      'hosts-manager',
      `session transition to IDLE: hosts unblock ${result.applied ? 'applied' : 'skipped'}`
    );
  }
}

function broadcastDesktopSessionState(): void {
  const snapshot = getDesktopSessionStateSnapshot();
  broadcastDesktopSessionStateToWindows({
    windows: BrowserWindow.getAllWindows(),
    channel: SESSION_STATE_CHANGED_CHANNEL,
    snapshot,
    logger: runtimeLog,
  });
}

function appendProcessEvents(events: DesktopProcessEvent[]): void {
  processEventLog = [...processEventLog, ...events].slice(
    -MAX_PROCESS_EVENT_LOG
  );

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(PROCESS_EVENTS_CHANNEL, events);
    }
  }
}

function getProcessEventLogSnapshot(): DesktopProcessEvent[] {
  return [...processEventLog];
}

function appendPolicyAuditEvents(
  events: StrictPolicyAuditEvent[],
  scope?: DesktopSettingsScope | null
): void {
  if (events.length === 0) {
    return;
  }

  const enrichedEvents = events.map(event => ({
    ...event,
    metadata: {
      ...event.metadata,
      userId: scope?.userId ?? null,
      companyId: scope?.companyId ?? null,
    },
  }));

  policyAuditLog = [...policyAuditLog, ...enrichedEvents].slice(
    -MAX_POLICY_AUDIT_LOG
  );

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(POLICY_AUDIT_CHANNEL, enrichedEvents);
    }
  }
}

function getPolicyAuditLogSnapshot(): StrictPolicyAuditEvent[] {
  return [...policyAuditLog];
}

function normalizeDomainFromUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    const normalizedHost = parsed.hostname.trim().toLowerCase();
    if (!normalizedHost) {
      return null;
    }

    return normalizedHost.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isBlockedDomainMatch(domain: string, blockedDomain: string): boolean {
  return domain === blockedDomain || domain.endsWith(`.${blockedDomain}`);
}

function findBlockedDomainForUrl(
  rawUrl: string,
  settings: DesktopFocusSettings
): string | null {
  const domain = normalizeDomainFromUrl(rawUrl);
  if (!domain) {
    return null;
  }

  for (const blockedDomain of settings.websiteBlockList) {
    if (isBlockedDomainMatch(domain, blockedDomain)) {
      return blockedDomain;
    }
  }

  return null;
}

async function clearBlockedWebsiteSource(
  sourceId: string,
  timestamp: number
): Promise<void> {
  const previousDomain = blockedWebsiteBySourceId.get(sourceId);
  if (!previousDomain) {
    return;
  }

  blockedWebsiteBySourceId.delete(sourceId);
  await evaluateAndRunStrictPolicy({
    websiteEvents: [
      {
        type: 'website_blocked_stopped',
        domain: previousDomain,
        sourceId,
        timestamp,
      },
    ],
    websiteSignalAvailable: true,
  });
}

async function handleWebsiteNavigationSignal(
  sourceId: string,
  rawUrl: string,
  timestamp: number
): Promise<void> {
  const nextBlockedDomain = findBlockedDomainForUrl(
    rawUrl,
    desktopFocusSettings
  );
  const previousBlockedDomain = blockedWebsiteBySourceId.get(sourceId) ?? null;
  const websiteEvents: DesktopWebsiteEvent[] = [];

  if (previousBlockedDomain && previousBlockedDomain !== nextBlockedDomain) {
    websiteEvents.push({
      type: 'website_blocked_stopped',
      domain: previousBlockedDomain,
      sourceId,
      timestamp,
    });
  }

  if (nextBlockedDomain && previousBlockedDomain !== nextBlockedDomain) {
    websiteEvents.push({
      type: 'website_blocked_started',
      domain: nextBlockedDomain,
      sourceId,
      timestamp,
    });
  }

  if (nextBlockedDomain) {
    blockedWebsiteBySourceId.set(sourceId, nextBlockedDomain);
  } else {
    blockedWebsiteBySourceId.delete(sourceId);
  }

  if (websiteEvents.length > 0) {
    await evaluateAndRunStrictPolicy({
      websiteEvents,
      websiteSignalAvailable: true,
    });
  }
}

async function reconcileBlockedWebsiteSignals(): Promise<void> {
  if (blockedWebsiteBySourceId.size === 0) {
    return;
  }

  const now = Date.now();
  const websiteEvents: DesktopWebsiteEvent[] = [];
  for (const [sourceId, blockedDomain] of blockedWebsiteBySourceId.entries()) {
    const stillBlocked = desktopFocusSettings.websiteBlockList.some(domain =>
      isBlockedDomainMatch(blockedDomain, domain)
    );

    if (stillBlocked) {
      continue;
    }

    blockedWebsiteBySourceId.delete(sourceId);
    websiteEvents.push({
      type: 'website_blocked_stopped',
      domain: blockedDomain,
      sourceId,
      timestamp: now,
    });
  }

  if (websiteEvents.length > 0) {
    await evaluateAndRunStrictPolicy({
      websiteEvents,
      websiteSignalAvailable: true,
    });
  }
}

async function evaluateAndRunStrictPolicy(input?: {
  processEvents?: DesktopProcessEvent[];
  websiteEvents?: DesktopWebsiteEvent[];
  websiteSignalAvailable?: boolean;
}): Promise<void> {
  const activeScope = getAuthenticatedDesktopScope();
  if (!activeScope) {
    return;
  }

  try {
    const evaluation = evaluateStrictPolicy(strictPolicyState, {
      scope: activeScope,
      settings: desktopFocusSettings,
      sessionState: desktopSessionState,
      processEvents: input?.processEvents ?? [],
      websiteEvents: input?.websiteEvents ?? [],
      websiteSignalAvailable: input?.websiteSignalAvailable ?? false,
      remainingTaskCount: desktopSessionState.remainingTaskCount,
      nowMs: Date.now(),
    });
    strictPolicyState = evaluation.nextState;
    appendPolicyAuditEvents(evaluation.auditEvents, activeScope);
    await executeStrictPolicyActions({
      scope: activeScope,
      actions: evaluation.actions,
      dependencies: {
        emitNotification: emitDesktopNotification,
        showSessionWidget,
        logger: runtimeLog,
        platform: process.platform,
      },
    });
  } catch (error) {
    console.warn('[desktop] Strict policy evaluation failed.', error);
  }
}

async function refreshProcessMonitorForScope(
  scope: DesktopSettingsScope | null,
  providedSettings?: DesktopFocusSettings
): Promise<void> {
  if (!scope) {
    desktopFocusSettings = createDefaultDesktopFocusSettings();
    processMonitor.setConfig(normalizeProcessWatchConfig({}));
    await unblockAll();
    return;
  }

  try {
    const settings =
      providedSettings ?? (await loadDesktopFocusSettings(scope));
    desktopFocusSettings = settings;
    const config = createProcessWatchConfigFromFocusSettings(settings);
    processMonitor.setConfig(config);
    if (desktopSessionState.status === 'RUNNING') {
      await blockDomains(desktopFocusSettings.websiteBlockList);
    }
    await reconcileBlockedWebsiteSignals();
    await evaluateAndRunStrictPolicy();
  } catch (error) {
    desktopFocusSettings = createDefaultDesktopFocusSettings();
    processMonitor.setConfig(normalizeProcessWatchConfig({}));
    console.warn('[desktop] Failed to refresh process monitor config.', error);
  }
}

async function handleDesktopProcessEvents(
  events: DesktopProcessEvent[]
): Promise<void> {
  appendProcessEvents(events);
  await evaluateAndRunStrictPolicy({ processEvents: events });
}

function canDispatchSessionAction(action: DesktopSessionAction): boolean {
  if (!desktopSessionScope) {
    return false;
  }
  if (desktopSessionState.connectionState !== 'connected') {
    return false;
  }

  const availability = getDesktopSessionActionAvailability(desktopSessionState);
  switch (action) {
    case 'start':
      return availability.start;
    case 'pause':
      return availability.pause;
    case 'resume':
      return availability.resume;
    case 'end':
      return availability.end;
  }
}

async function showMainWindow(): Promise<void> {
  const window = await ensureMainWindow({ show: true });
  if (window.isMinimized()) {
    window.restore();
  }
  window.show();
  window.focus();
}

function buildNotificationActionKey(
  action: DesktopNotificationActionEvent
): string {
  return [
    action.scope.userId,
    action.scope.companyId,
    action.action,
    action.route ?? 'none',
    `${action.requestedAt}`,
  ].join(':');
}

function enqueuePendingNotificationAction(
  action: DesktopNotificationActionEvent
): void {
  const key = buildNotificationActionKey(action);
  const alreadyQueued = pendingNotificationActions.some(
    entry => buildNotificationActionKey(entry) === key
  );

  if (alreadyQueued) {
    return;
  }

  pendingNotificationActions.push(action);
  if (pendingNotificationActions.length > MAX_PENDING_NOTIFICATION_ACTIONS) {
    pendingNotificationActions.splice(
      0,
      pendingNotificationActions.length - MAX_PENDING_NOTIFICATION_ACTIONS
    );
  }

  runtimeLog.debug(
    'session-sync',
    `queued notification action: action=${action.action}, route=${action.route ?? 'none'}, queueSize=${pendingNotificationActions.length}`
  );
}

function consumePendingNotificationActions(
  scope: DesktopSettingsScope
): DesktopNotificationActionEvent[] {
  if (pendingNotificationActions.length === 0) {
    return [];
  }

  const remaining: DesktopNotificationActionEvent[] = [];
  const consumed: DesktopNotificationActionEvent[] = [];
  for (const action of pendingNotificationActions) {
    if (areScopesEqual(action.scope, scope)) {
      consumed.push(action);
    } else {
      remaining.push(action);
    }
  }

  pendingNotificationActions.length = 0;
  pendingNotificationActions.push(...remaining);

  if (consumed.length > 0) {
    runtimeLog.info(
      'session-sync',
      `consumed pending notification actions: count=${consumed.length}, queueSize=${pendingNotificationActions.length}`
    );
  }

  return consumed;
}

async function routeDesktopNotificationAction(
  requestedAction: DesktopNotificationActionEvent
): Promise<void> {
  const activeScope = desktopSessionScope;
  if (!activeScope || !areScopesEqual(activeScope, requestedAction.scope)) {
    runtimeLog.warn(
      'session-sync',
      `notification route dropped: scope mismatch, action=${requestedAction.action}, route=${requestedAction.route ?? 'none'}`
    );
    return;
  }

  const actionEvent: DesktopNotificationActionEvent = {
    scope: activeScope,
    action: requestedAction.action,
    route: requestedAction.route,
    requestedAt: requestedAction.requestedAt,
  };

  runtimeLog.info(
    'session-sync',
    `routing notification action: action=${actionEvent.action}, route=${actionEvent.route ?? 'none'}, requestedAt=${actionEvent.requestedAt}`
  );
  enqueuePendingNotificationAction(actionEvent);

  await showMainWindow();

  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue;
    }

    const sendActionEvent = () => {
      if (!window.isDestroyed()) {
        runtimeLog.debug(
          'session-sync',
          `dispatching notification action to renderer: action=${actionEvent.action}, route=${actionEvent.route ?? 'none'}`
        );
        window.webContents.send(NOTIFICATION_ACTION_CHANNEL, actionEvent);
      }
    };

    if (window.webContents.isLoading()) {
      runtimeLog.debug(
        'session-sync',
        `notification action queued until renderer finishes load: action=${actionEvent.action}`
      );
      window.webContents.once('did-finish-load', sendActionEvent);
    } else {
      sendActionEvent();
    }
  }
}

function resolveDesktopNotificationRoute(
  request: DesktopNotificationRequest
): string | null {
  if (request.route) {
    return request.route;
  }

  if (
    request.kind === 'session_started' ||
    request.kind === 'session_paused' ||
    request.kind === 'session_resumed' ||
    request.kind === 'session_ended' ||
    request.kind === 'ide_session_required' ||
    request.kind === 'distractor_app_detected' ||
    request.kind === 'website_blocked_detected' ||
    request.kind === 'tasks_remaining_reminder'
  ) {
    return '/sessions';
  }

  if (
    request.action === 'open_sessions' ||
    request.action === 'start_session'
  ) {
    return '/sessions';
  }

  if (request.action === 'open_app') {
    return '/';
  }

  return null;
}

async function emitDesktopNotification(payload: unknown): Promise<{
  delivered: boolean;
  throttled: boolean;
}> {
  const request = parseDesktopNotificationRequest(payload);
  const activeScope = getAuthenticatedDesktopScope();
  if (!activeScope || !areScopesEqual(activeScope, request.scope)) {
    return {
      delivered: false,
      throttled: false,
    };
  }

  const now = Date.now();
  const lastSentAt = notificationSentAtByKey.get(request.throttleKey) ?? null;
  const isThrottled = shouldThrottleDesktopNotification(
    lastSentAt,
    request.throttleMs,
    now
  );

  if (isThrottled) {
    runtimeLog.debug(
      'session-sync',
      `notification throttled: kind=${request.kind}, throttleKey=${request.throttleKey}, throttleMs=${request.throttleMs}`
    );
    return {
      delivered: false,
      throttled: true,
    };
  }

  notificationSentAtByKey.set(request.throttleKey, now);
  const route = resolveDesktopNotificationRoute(request);
  runtimeLog.info(
    'session-sync',
    `notification emit accepted: kind=${request.kind}, action=${request.action}, route=${route ?? 'none'}, throttleKey=${request.throttleKey}`
  );

  const actionEvent: DesktopNotificationActionEvent = {
    scope: activeScope,
    action: request.action,
    route,
    requestedAt: now,
  };

  if (!Notification.isSupported()) {
    await routeDesktopNotificationAction(actionEvent);
    return {
      delivered: false,
      throttled: false,
    };
  }

  const toast = new Notification({
    title: request.title,
    body: request.body,
    silent: false,
    icon: APP_ICON_PATH,
  });

  toast.on('click', () => {
    runtimeLog.info(
      'session-sync',
      `notification clicked: kind=${request.kind}, action=${actionEvent.action}, route=${actionEvent.route ?? 'none'}`
    );
    void routeDesktopNotificationAction(actionEvent);
  });
  toast.show();

  return {
    delivered: true,
    throttled: false,
  };
}

function parseOverrideDurationMs(value: unknown): number {
  if (!Number.isInteger(value)) {
    throw new Error('Override duration must be an integer.');
  }

  const numericValue = value as number;
  if (numericValue < 0 || numericValue > 8 * 60 * 60 * 1000) {
    throw new Error(
      'Override duration must be between 0 and 28800000 milliseconds.'
    );
  }

  return numericValue;
}

function parseOverrideReason(value: unknown): string {
  if (typeof value !== 'string') {
    return 'user_override';
  }

  const trimmed = value.trim();
  return trimmed || 'user_override';
}

async function dispatchDesktopSessionAction(
  action: DesktopSessionAction,
  options?: {
    endDecision?: DesktopSessionEndDecision;
  }
): Promise<void> {
  if (!desktopSessionScope) {
    throw new Error('Desktop scope is not initialized.');
  }

  if (!canDispatchSessionAction(action)) {
    return;
  }

  let endDecision = options?.endDecision;
  if (action === 'end' && !endDecision) {
    const focusedWindow =
      BrowserWindow.getFocusedWindow() ??
      sessionWidgetWindowRef ??
      mainWindowRef ??
      undefined;
    const decisionPrompt: MessageBoxOptions = {
      type: 'question',
      buttons: ['Keep ongoing', 'Mark all done', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      title: 'End session',
      message: 'How do you want to handle ongoing tasks before ending?',
      detail:
        'Keep ongoing leaves active tasks in progress. Mark all done completes all remaining tasks in this session scope.',
    };
    const decisionResult = focusedWindow
      ? await dialog.showMessageBox(focusedWindow, decisionPrompt)
      : await dialog.showMessageBox(decisionPrompt);
    if (decisionResult.response === 2 || decisionResult.response === -1) {
      endDecision = 'cancel';
    } else if (decisionResult.response === 1) {
      endDecision = 'mark_all_done';
    } else {
      endDecision = 'keep_ongoing';
    }
  }

  if (action === 'end' && endDecision === 'cancel') {
    return;
  }

  const targetWindow = await ensureMainWindow({ show: false });
  const commandPayload = {
    scope: desktopSessionScope,
    action,
    ...(action === 'end' && endDecision ? { endDecision } : {}),
    requestedAt: Date.now(),
  };

  if (targetWindow.webContents.isLoading()) {
    targetWindow.webContents.once('did-finish-load', () => {
      if (!targetWindow.isDestroyed()) {
        targetWindow.webContents.send(SESSION_COMMAND_CHANNEL, commandPayload);
      }
    });
    return;
  }

  targetWindow.webContents.send(SESSION_COMMAND_CHANNEL, commandPayload);
}

function rebuildTrayMenu(): void {
  if (!trayRef) {
    return;
  }

  const availability = getDesktopSessionActionAvailability(desktopSessionState);
  const hasScope = desktopSessionScope !== null;
  const isConnected = desktopSessionState.connectionState === 'connected';
  const statusLabel = `${desktopSessionState.status} [${desktopSessionState.connectionState}]`;

  const menu = Menu.buildFromTemplate([
    {
      label: `Status: ${statusLabel}`,
      enabled: false,
    },
    {
      type: 'separator',
    },
    {
      label: 'Start Session',
      enabled: hasScope && isConnected && availability.start,
      click: () => {
        void dispatchDesktopSessionAction('start');
      },
    },
    {
      label: 'Pause Session',
      enabled: hasScope && isConnected && availability.pause,
      click: () => {
        void dispatchDesktopSessionAction('pause');
      },
    },
    {
      label: 'Resume Session',
      enabled: hasScope && isConnected && availability.resume,
      click: () => {
        void dispatchDesktopSessionAction('resume');
      },
    },
    {
      label: 'End Session',
      enabled: hasScope && isConnected && availability.end,
      click: () => {
        void dispatchDesktopSessionAction('end');
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Toggle Session Widget',
      enabled: hasScope && isConnected,
      click: () => {
        void toggleSessionWidget({
          forceOpen: true,
          origin: 'tray_menu',
          mode: 'mini',
        });
      },
    },
    {
      label: 'Open DevSuite',
      click: () => {
        void showMainWindow();
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Quit',
      role: 'quit',
    },
  ]);

  trayRef.setToolTip(`DevSuite (${statusLabel})`);
  trayRef.setContextMenu(menu);
}

function createTrayIcon(): {
  image: ReturnType<typeof nativeImage.createFromPath>;
  sourcePath: string | null;
} {
  for (const candidatePath of TRAY_ICON_CANDIDATE_PATHS) {
    const candidateImage = nativeImage.createFromPath(candidatePath);
    if (candidateImage.isEmpty()) {
      continue;
    }

    const image =
      process.platform === 'win32'
        ? candidateImage.resize({
            width: TRAY_ICON_SIZE_PX,
            height: TRAY_ICON_SIZE_PX,
          })
        : candidateImage;

    return {
      image,
      sourcePath: candidatePath,
    };
  }

  return {
    image: nativeImage.createEmpty(),
    sourcePath: null,
  };
}

function ensureTray(): void {
  if (trayRef) {
    return;
  }

  try {
    const trayIcon = createTrayIcon();
    if (trayIcon.image.isEmpty()) {
      throw new Error(
        `tray icon image is empty (candidates=${TRAY_ICON_CANDIDATE_PATHS.join(',')})`
      );
    }

    trayRef = new Tray(trayIcon.image);
    trayRef.on('click', () => {
      void showMainWindow();
    });
    rebuildTrayMenu();
    runtimeLog.info(
      'widget',
      `tray initialized (trayIconPath=${trayIcon.sourcePath ?? 'none'}, appIconPath=${APP_ICON_PATH})`
    );
  } catch (error) {
    runtimeLog.error(
      'widget',
      `failed to initialize tray: ${error instanceof Error ? error.message : String(error)}`
    );
    console.warn('[desktop] Failed to initialize tray menu.', error);
  }
}

function applyLoginItemPreferences(
  preferences: DesktopRuntimePreferences
): void {
  try {
    app.setLoginItemSettings({
      openAtLogin: preferences.openAtLogin,
      openAsHidden: true,
      path: process.execPath,
    });
  } catch (error) {
    console.warn('[desktop] Failed to apply login item preferences.', error);
  }
}

async function initializeRuntimePreferences(): Promise<void> {
  const loaded = await loadDesktopRuntimePreferences();
  desktopRuntimePreferences = loaded;
  applyLoginItemPreferences(loaded);
}

async function updateRuntimePreferences(
  nextPreferences: unknown
): Promise<DesktopRuntimePreferences> {
  const saved = await saveDesktopRuntimePreferences(nextPreferences);
  desktopRuntimePreferences = saved;
  applyLoginItemPreferences(saved);
  return saved;
}

function setDesktopScope(nextScope: DesktopSettingsScope | null): void {
  const hasChanged =
    !nextScope ||
    !desktopSessionScope ||
    !areScopesEqual(nextScope, desktopSessionScope);

  desktopSessionScope = nextScope;

  if (hasChanged) {
    closeSessionWidgetIfOpen();
    sessionWidgetDismissedByUser = false;
    desktopSessionState = createDefaultDesktopSessionState();
    strictPolicyState = createDefaultStrictPolicyState();
    lastEffectiveDurationBySessionId.clear();
    pendingNotificationActions.length = 0;
    processEventLog = [];
    policyAuditLog = [];
    blockedWebsiteBySourceId.clear();
    void unblockAll().catch(error => {
      console.warn(
        '[desktop] Failed to clear hosts block on scope change.',
        error
      );
    });
    rebuildTrayMenu();
    broadcastDesktopSessionState();
    void refreshProcessMonitorForScope(nextScope);
  }
}

function closeSessionWidgetIfOpen(): void {
  if (!sessionWidgetWindowRef) {
    return;
  }

  if (sessionWidgetWindowRef.isDestroyed()) {
    sessionWidgetWindowRef = null;
    return;
  }

  isClosingSessionWidgetProgrammatically = true;
  sessionWidgetWindowRef.close();
}

function buildSessionWidgetUrl(mode: SessionWidgetMode): string {
  const rendererUrl = resolveRendererUrl();
  if (!rendererUrl) {
    return `data:text/html;charset=utf-8,${encodeURIComponent(BOOTSTRAP_HTML)}`;
  }

  if (rendererUrl.startsWith('data:')) {
    return rendererUrl;
  }

  try {
    const companionUrl = new URL(COMPANION_ROUTE_PATH, rendererUrl);
    companionUrl.searchParams.set('mode', mode);
    return companionUrl.toString();
  } catch {
    return rendererUrl;
  }
}

function applySessionWidgetMode(mode: SessionWidgetMode): void {
  sessionWidgetMode = mode;
  if (!sessionWidgetWindowRef || sessionWidgetWindowRef.isDestroyed()) {
    return;
  }

  const { width, height } = getSessionWidgetSize(mode);
  sessionWidgetWindowRef.setSize(width, height, true);
  positionWidgetBottomRight({
    window: sessionWidgetWindowRef,
    workAreaSize: screen.getPrimaryDisplay().workAreaSize,
  });
}

async function showSessionWidget(options?: {
  force?: boolean;
  origin?: string;
  mode?: SessionWidgetMode;
}): Promise<void> {
  const force = options?.force ?? false;
  const origin = options?.origin ?? 'unknown';
  const mode = options?.mode ?? sessionWidgetMode;

  if (!getAuthenticatedDesktopScope()) {
    return;
  }

  if (sessionWidgetDismissedByUser && !force) {
    runtimeLog.info(
      'widget',
      `widget show suppressed after user close: origin=${origin}`
    );
    return;
  }

  if (force && sessionWidgetDismissedByUser) {
    sessionWidgetDismissedByUser = false;
    runtimeLog.info(
      'widget',
      `widget dismissal cleared by explicit user action: origin=${origin}`
    );
  }

  if (sessionWidgetWindowRef && !sessionWidgetWindowRef.isDestroyed()) {
    applySessionWidgetMode(mode);
    const companionUrl = buildSessionWidgetUrl(mode);
    if (sessionWidgetWindowRef.webContents.getURL() !== companionUrl) {
      await sessionWidgetWindowRef.loadURL(companionUrl);
    }
    runtimeLog.debug(
      'widget',
      `widget already open; focusing, origin=${origin}`
    );
    sessionWidgetWindowRef.show();
    sessionWidgetWindowRef.focus();
    return;
  }

  sessionWidgetWindowRef = new BrowserWindow(
    getSessionWidgetWindowOptions({
      iconPath: APP_ICON_PATH,
      preloadPath: join(__dirname, 'preload.js'),
      partition: DESKTOP_PARTITION,
      additionalArguments: TEST_IPC_RENDERER_ARGS,
      mode,
    })
  );
  const applyBottomRightPosition = () => {
    if (!sessionWidgetWindowRef || sessionWidgetWindowRef.isDestroyed()) {
      return;
    }

    positionWidgetBottomRight({
      window: sessionWidgetWindowRef,
      workAreaSize: screen.getPrimaryDisplay().workAreaSize,
    });
  };
  screen.on('display-metrics-changed', applyBottomRightPosition);

  sessionWidgetWindowRef.once('ready-to-show', () => {
    applyBottomRightPosition();
  });
  applyWindowNavigationSecurity(sessionWidgetWindowRef);

  sessionWidgetWindowRef.on('closed', () => {
    const closedProgrammatically = isClosingSessionWidgetProgrammatically;
    isClosingSessionWidgetProgrammatically = false;
    if (closedProgrammatically) {
      runtimeLog.debug('widget', 'widget closed programmatically');
    } else {
      sessionWidgetDismissedByUser = true;
      runtimeLog.info(
        'widget',
        'widget closed by user; auto-reopen suppressed'
      );
    }
    screen.removeListener('display-metrics-changed', applyBottomRightPosition);
    sessionWidgetWindowRef = null;
  });

  applySessionWidgetMode(mode);
  await sessionWidgetWindowRef.loadURL(buildSessionWidgetUrl(mode));
  runtimeLog.info('widget', `widget opened: origin=${origin}, force=${force}`);
  broadcastDesktopSessionState();
}

async function toggleSessionWidget(options?: {
  forceOpen?: boolean;
  origin?: string;
  mode?: SessionWidgetMode;
}): Promise<void> {
  const origin = options?.origin ?? 'unknown';

  if (sessionWidgetWindowRef && !sessionWidgetWindowRef.isDestroyed()) {
    if (sessionWidgetWindowRef.isVisible()) {
      sessionWidgetWindowRef.hide();
      runtimeLog.info('widget', `widget hidden by toggle: origin=${origin}`);
      return;
    }

    await showSessionWidget({
      force: options?.forceOpen ?? false,
      origin,
      ...(options?.mode ? { mode: options.mode } : {}),
    });
    return;
  }

  await showSessionWidget({
    force: options?.forceOpen ?? false,
    origin,
    ...(options?.mode ? { mode: options.mode } : {}),
  });
}

function tryRegisterCompanionShortcut(shortcut: string): boolean {
  try {
    return globalShortcut.register(shortcut, () => {
      void toggleSessionWidget({
        forceOpen: true,
        origin: 'shortcut',
        mode: 'mini',
      });
    });
  } catch (error) {
    console.warn('[desktop] Companion shortcut registration failed.', {
      shortcut,
      error,
    });
    return false;
  }
}

function applyCompanionShortcutRegistration(shortcut: string): boolean {
  const previousShortcut = registeredCompanionShortcut;

  if (previousShortcut) {
    globalShortcut.unregister(previousShortcut);
    registeredCompanionShortcut = null;
  }

  if (tryRegisterCompanionShortcut(shortcut)) {
    registeredCompanionShortcut = shortcut;
    companionShortcut = shortcut;
    return true;
  }

  if (previousShortcut && tryRegisterCompanionShortcut(previousShortcut)) {
    registeredCompanionShortcut = previousShortcut;
    companionShortcut = previousShortcut;
  }

  return false;
}

async function initializeCompanionShortcut(): Promise<void> {
  const persistedShortcut = await loadCompanionShortcut();
  if (applyCompanionShortcutRegistration(persistedShortcut)) {
    return;
  }

  if (persistedShortcut !== DEFAULT_COMPANION_SHORTCUT) {
    if (applyCompanionShortcutRegistration(DEFAULT_COMPANION_SHORTCUT)) {
      await saveCompanionShortcut(DEFAULT_COMPANION_SHORTCUT);
      return;
    }
  }

  console.warn('[desktop] Unable to register any companion shortcut.');
}

async function updateCompanionShortcut(nextShortcut: unknown): Promise<string> {
  const parsedShortcut = parseCompanionShortcut(nextShortcut);
  if (!applyCompanionShortcutRegistration(parsedShortcut)) {
    throw new Error(
      `Unable to register shortcut "${parsedShortcut}". Check accelerator format and OS shortcut conflicts.`
    );
  }

  await saveCompanionShortcut(parsedShortcut);
  return parsedShortcut;
}

function registerWebsiteSignalHandlers(browserWindow: BrowserWindowType): void {
  const sourceId = `${WEBSITE_SOURCE_PREFIX}:${browserWindow.webContents.id}`;
  const handleNavigation = (_event: unknown, rawUrl: string) => {
    void handleWebsiteNavigationSignal(sourceId, rawUrl, Date.now());
  };

  browserWindow.webContents.on('did-navigate', handleNavigation);
  browserWindow.webContents.on('did-navigate-in-page', handleNavigation);

  browserWindow.on('closed', () => {
    void clearBlockedWebsiteSource(sourceId, Date.now());
  });
}

function applyWindowNavigationSecurity(browserWindow: BrowserWindowType): void {
  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      shouldAllowInAppNavigation({
        url,
        allowedOrigins: allowedDesktopNavigationOrigins,
      })
    ) {
      return { action: 'allow' };
    }

    if (
      shouldOpenInExternalBrowser({
        url,
        allowedOrigins: allowedDesktopNavigationOrigins,
      })
    ) {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  const handleBlockedNavigation = (event: ElectronEvent, url: string) => {
    if (
      shouldAllowInAppNavigation({
        url,
        allowedOrigins: allowedDesktopNavigationOrigins,
      })
    ) {
      return;
    }

    event.preventDefault();
    if (
      shouldOpenInExternalBrowser({
        url,
        allowedOrigins: allowedDesktopNavigationOrigins,
      })
    ) {
      void shell.openExternal(url);
    }
  };

  browserWindow.webContents.on('will-navigate', handleBlockedNavigation);
  browserWindow.webContents.on('will-redirect', handleBlockedNavigation);
  browserWindow.webContents.on('will-attach-webview', event => {
    event.preventDefault();
  });
}

const BUNDLED_RENDERER_ORIGIN = `${RENDERER_PROTOCOL_SCHEME}://${RENDERER_PROTOCOL_HOST}`;

function applyDesktopPermissionPolicy(): void {
  const desktopSession = session.fromPartition(DESKTOP_PARTITION);

  desktopSession.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin) => {
      return shouldGrantDesktopPermission({
        permission,
        requestingOrigin,
        allowedOrigins: allowedDesktopNavigationOrigins,
      });
    }
  );

  desktopSession.setPermissionRequestHandler(
    (_webContents, permission, callback, details) => {
      const granted = shouldGrantDesktopPermission({
        permission,
        requestingOrigin: details.requestingUrl,
        allowedOrigins: allowedDesktopNavigationOrigins,
      });
      callback(granted);
    }
  );

  desktopSession.setDevicePermissionHandler(() => false);

  desktopSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    const isExternalRequest =
      details.url.startsWith('https://') || details.url.startsWith('http://');
    const isFromBundledRenderer =
      !details.referrer ||
      details.referrer.startsWith(`${BUNDLED_RENDERER_ORIGIN}/`);

    if (isExternalRequest && isFromBundledRenderer) {
      headers['Origin'] = BUNDLED_RENDERER_ORIGIN;
    }

    callback({ requestHeaders: headers });
  });

  desktopSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders: Record<string, string | string[]> = {
      ...(details.responseHeaders ?? {}),
    };
    const isExternalRequest =
      details.url.startsWith('https://') || details.url.startsWith('http://');

    if (!isExternalRequest) {
      callback({ responseHeaders });
      return;
    }

    responseHeaders['access-control-allow-origin'] = BUNDLED_RENDERER_ORIGIN;
    responseHeaders['access-control-allow-credentials'] = 'true';

    if (details.method === 'OPTIONS') {
      responseHeaders['access-control-allow-methods'] =
        'GET, POST, PUT, PATCH, DELETE, OPTIONS';
      responseHeaders['access-control-allow-headers'] = '*';
      responseHeaders['access-control-max-age'] = '86400';
    }

    callback({ responseHeaders });
  });
}

async function resolveScopedDesktopContext(
  requestedScope: unknown
): Promise<DesktopSettingsScope> {
  const parsedScope = parseDesktopSettingsScope(requestedScope);
  const activeScope = desktopSessionScope ?? (await loadDesktopSessionScope());

  if (!activeScope) {
    const savedScope = await saveDesktopSessionScope(parsedScope);
    setDesktopScope(savedScope);
    return savedScope;
  }

  if (!areScopesEqual(activeScope, parsedScope)) {
    throw new Error('Desktop scope mismatch. Re-authenticate and try again.');
  }

  setDesktopScope(activeScope);
  return activeScope;
}

function resolveRendererUrl(): string | undefined {
  return resolveRendererUrlWithOptions({
    envUrl: process.env.DEVSUITE_WEB_URL,
    isPackaged: app.isPackaged,
    rendererExists: existsSync(RENDERER_INDEX_PATH),
  });
}

function resolveRendererContentType(filePath: string): string {
  const extension = extname(filePath).toLowerCase();
  return RENDERER_MIME_TYPES[extension] ?? 'application/octet-stream';
}

function parseRendererRequestPath(requestUrl: string): string | null {
  try {
    const parsed = new URL(requestUrl);
    if (
      parsed.protocol !== `${RENDERER_PROTOCOL_SCHEME}:` ||
      parsed.hostname !== RENDERER_PROTOCOL_HOST
    ) {
      return null;
    }

    const decodedPath = decodeURIComponent(parsed.pathname);
    const trimmedPath = decodedPath.replace(/^\/+/, '');
    return trimmedPath || 'index.html';
  } catch {
    return null;
  }
}

function resolveRendererFilePath(requestUrl: string): string | null {
  const requestPath = parseRendererRequestPath(requestUrl);
  if (!requestPath) {
    return null;
  }

  const sanitizedSegments = requestPath
    .split('/')
    .filter(
      segment => segment.length > 0 && segment !== '.' && segment !== '..'
    )
    .join(sep);
  const normalizedRoot = normalize(RENDERER_DIRECTORY);
  const resolvedFilePath = normalize(join(normalizedRoot, sanitizedSegments));

  if (
    resolvedFilePath !== normalizedRoot &&
    !resolvedFilePath.startsWith(`${normalizedRoot}${sep}`)
  ) {
    return null;
  }

  if (existsSync(resolvedFilePath)) {
    return resolvedFilePath;
  }

  if (extname(resolvedFilePath) === '' && existsSync(RENDERER_INDEX_PATH)) {
    return RENDERER_INDEX_PATH;
  }

  return null;
}

async function registerRendererProtocol(): Promise<void> {
  if (rendererProtocolRegistered) {
    return;
  }

  const handler = async (request: { url: string }) => {
    const resolvedPath = resolveRendererFilePath(request.url);
    if (!resolvedPath) {
      return new globalThis.Response('Not found', { status: 404 });
    }

    try {
      const contents = await readFile(resolvedPath);
      return new globalThis.Response(contents, {
        status: 200,
        headers: {
          'content-type': resolveRendererContentType(resolvedPath),
        },
      });
    } catch (error) {
      console.warn('[desktop] Failed to serve renderer asset.', {
        requestUrl: request.url,
        resolvedPath,
        error,
      });
      return new globalThis.Response('Not found', { status: 404 });
    }
  };

  await protocol.handle(RENDERER_PROTOCOL_SCHEME, handler);
  const desktopSession = session.fromPartition(DESKTOP_PARTITION);
  await desktopSession.protocol.handle(RENDERER_PROTOCOL_SCHEME, handler);

  rendererProtocolRegistered = true;
}

async function loadWindowContent(mainWindow: BrowserWindowType): Promise<void> {
  const rendererUrl = resolveRendererUrl();
  if (rendererUrl) {
    try {
      await mainWindow.loadURL(rendererUrl);
      return;
    } catch (error) {
      console.warn(
        '[desktop] Failed to load renderer URL, falling back to bootstrap page.',
        error
      );
    }
  }

  await mainWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(BOOTSTRAP_HTML)}`
  );
}

function registerIpcHandlers(): void {
  if (ipcRegistered) {
    return;
  }

  registerDesktopWindowIpcHandlers({
    ipcMain,
    browserWindowModule: {
      fromWebContents: sender =>
        BrowserWindow.fromWebContents(
          sender as Parameters<typeof BrowserWindow.fromWebContents>[0]
        ),
    },
  });

  ipcMain.handle(
    'desktop-focus-settings:get',
    async (_event, scope: unknown) => {
      const resolvedScope = await resolveScopedDesktopContext(scope);
      return loadDesktopFocusSettings(resolvedScope);
    }
  );
  ipcMain.handle(
    'desktop-focus-settings:set',
    async (_event, scope: unknown, payload: unknown) => {
      const resolvedScope = await resolveScopedDesktopContext(scope);
      const previousWebsiteBlockList =
        desktopSessionScope &&
        areScopesEqual(desktopSessionScope, resolvedScope)
          ? [...desktopFocusSettings.websiteBlockList]
          : null;
      const savedSettings = await saveDesktopFocusSettings(
        resolvedScope,
        payload
      );
      if (
        desktopSessionScope &&
        areScopesEqual(desktopSessionScope, resolvedScope)
      ) {
        if (isRunningOrPaused(desktopSessionState.status)) {
          await reconcileDomains({
            currentDomains: previousWebsiteBlockList ?? [],
            newDomains: savedSettings.websiteBlockList,
          });
        }
        await refreshProcessMonitorForScope(desktopSessionScope, savedSettings);
      }
      return savedSettings;
    }
  );
  ipcMain.handle('desktop-auth:get-scope', async () => {
    const scope = desktopSessionScope ?? (await loadDesktopSessionScope());
    if (scope) {
      setDesktopScope(scope);
    }
    return scope;
  });
  ipcMain.handle('desktop-auth:set-scope', async (_event, scope: unknown) => {
    const savedScope = await saveDesktopSessionScope(scope);
    setDesktopScope(savedScope);
    return savedScope;
  });
  ipcMain.handle('desktop-auth:clear-scope', async () => {
    await clearDesktopSessionScope();
    setDesktopScope(null);
  });
  ipcMain.handle('desktop-auth:clear-local-state', async () => {
    await clearDesktopSessionScope();
    setDesktopScope(null);
    const desktopSession = session.fromPartition(DESKTOP_PARTITION);
    await desktopSession.clearStorageData();
    await desktopSession.clearCache();
  });
  ipcMain.handle(
    'desktop-session:get-state',
    async (_event, scope: unknown) => {
      await resolveScopedDesktopContext(scope);
      return getDesktopSessionStateSnapshot();
    }
  );
  ipcMain.handle(
    'desktop-session:publish-state',
    async (_event, scope: unknown, payload: unknown) => {
      const resolvedScope = await resolveScopedDesktopContext(scope);
      if (
        !desktopSessionScope ||
        !areScopesEqual(desktopSessionScope, resolvedScope)
      ) {
        desktopSessionScope = resolvedScope;
      }

      const previousStatus = desktopSessionState.status;
      const incomingState = parseDesktopSessionState(payload);
      let normalizedState = incomingState;

      runtimeLog.debug(
        'session-sync',
        `publish-state received: status=${incomingState.status}, sessionId=${incomingState.sessionId ?? 'none'}, effectiveDurationMs=${incomingState.effectiveDurationMs}, connectionState=${incomingState.connectionState}, updatedAt=${incomingState.updatedAt}, publishedAt=${incomingState.publishedAt}`
      );

      if (incomingState.sessionId) {
        const previousKnownDuration =
          lastEffectiveDurationBySessionId.get(incomingState.sessionId) ?? null;
        if (
          previousKnownDuration !== null &&
          incomingState.status === 'RUNNING' &&
          incomingState.effectiveDurationMs <
            previousKnownDuration - SESSION_DURATION_REGRESSION_TOLERANCE_MS
        ) {
          runtimeLog.warn(
            'session-sync',
            `effectiveDuration regression detected; clamping: sessionId=${incomingState.sessionId}, previousMs=${previousKnownDuration}, incomingMs=${incomingState.effectiveDurationMs}`
          );
          normalizedState = {
            ...incomingState,
            effectiveDurationMs: previousKnownDuration,
          };
        }
        lastEffectiveDurationBySessionId.set(
          incomingState.sessionId,
          Math.max(
            previousKnownDuration ?? 0,
            normalizedState.effectiveDurationMs
          )
        );
      } else if (incomingState.status === 'IDLE') {
        lastEffectiveDurationBySessionId.clear();
      }

      desktopSessionState = normalizedState;
      await syncHostsBlockingForSessionTransition({
        previousStatus,
        nextStatus: desktopSessionState.status,
        domains: desktopFocusSettings.websiteBlockList,
      });
      if (
        previousStatus !== 'RUNNING' &&
        desktopSessionState.status === 'RUNNING'
      ) {
        try {
          await processMonitor.triggerImmediatePoll({
            resetPreviousEntries: true,
          });
        } catch (error) {
          console.warn(
            '[desktop] Failed to refresh process monitor on start.',
            {
              error,
            }
          );
        }
      }
      rebuildTrayMenu();
      broadcastDesktopSessionState();
      await evaluateAndRunStrictPolicy();
      return getDesktopSessionStateSnapshot();
    }
  );
  ipcMain.handle(
    'desktop-session:request-action',
    async (_event, scope: unknown, action: unknown, endDecision: unknown) => {
      const resolvedScope = await resolveScopedDesktopContext(scope);
      if (
        !desktopSessionScope ||
        !areScopesEqual(desktopSessionScope, resolvedScope)
      ) {
        desktopSessionScope = resolvedScope;
      }

      const parsedAction = parseDesktopSessionAction(action);
      const parsedEndDecision =
        parsedAction === 'end'
          ? parseDesktopSessionEndDecision(endDecision)
          : undefined;
      await dispatchDesktopSessionAction(
        parsedAction,
        parsedEndDecision ? { endDecision: parsedEndDecision } : undefined
      );
    }
  );
  ipcMain.handle(
    'desktop-session:show-companion',
    async (_event, mode: unknown) => {
      const parsedMode =
        mode === undefined || mode === null
          ? 'expanded'
          : parseSessionWidgetMode(mode);
      await showSessionWidget({
        force: true,
        origin: 'ipc_show_companion',
        mode: parsedMode,
      });
    }
  );
  ipcMain.handle(
    'desktop-session:set-companion-mode',
    async (_event, mode: unknown) => {
      applySessionWidgetMode(parseSessionWidgetMode(mode));
    }
  );
  ipcMain.handle('desktop-companion:get-shortcut', async () => {
    return companionShortcut;
  });
  ipcMain.handle(
    'desktop-companion:set-shortcut',
    async (_event, shortcut: unknown) => {
      return updateCompanionShortcut(shortcut);
    }
  );
  ipcMain.handle('desktop-runtime-preferences:get', async () => {
    return desktopRuntimePreferences;
  });
  ipcMain.handle(
    'desktop-runtime-preferences:set',
    async (_event, nextPreferences: unknown) => {
      return updateRuntimePreferences(nextPreferences);
    }
  );
  ipcMain.handle(
    'desktop-process-monitor:get-events',
    async (_event, scope: unknown) => {
      await resolveScopedDesktopContext(scope);
      return getProcessEventLogSnapshot();
    }
  );
  ipcMain.handle('desktop-process-monitor:list-running', async () => {
    if (process.platform !== 'win32') {
      return [];
    }

    return listWindowsProcessesVerbose();
  });
  ipcMain.handle(
    'desktop-policy:get-audit-events',
    async (_event, scope: unknown) => {
      await resolveScopedDesktopContext(scope);
      return getPolicyAuditLogSnapshot();
    }
  );
  ipcMain.handle(
    'desktop-policy:apply-override',
    async (_event, scope: unknown, durationMs: unknown, reason: unknown) => {
      const resolvedScope = await resolveScopedDesktopContext(scope);
      const parsedDurationMs = parseOverrideDurationMs(durationMs);
      const parsedReason = parseOverrideReason(reason);
      const applied = applyStrictPolicyOverride(strictPolicyState, {
        nowMs: Date.now(),
        durationMs: parsedDurationMs,
        reason: parsedReason,
      });
      strictPolicyState = applied.nextState;
      appendPolicyAuditEvents([applied.auditEvent], resolvedScope);
      await evaluateAndRunStrictPolicy();

      return {
        scope: resolvedScope,
        overrideUntilMs: strictPolicyState.overrideUntilMs,
      };
    }
  );
  ipcMain.handle(
    'desktop-notification:emit',
    async (_event, payload: unknown) => {
      return emitDesktopNotification(payload);
    }
  );
  ipcMain.handle(
    'desktop-notification:consume-pending-actions',
    async (_event, scope: unknown) => {
      const resolvedScope = await resolveScopedDesktopContext(scope);
      return consumePendingNotificationActions(resolvedScope);
    }
  );
  ipcMain.handle(
    'desktop-notification:route-action',
    async (_event, actionPayload: unknown) => {
      const parsedAction = parseDesktopNotificationActionEvent(actionPayload);
      await routeDesktopNotificationAction(parsedAction);
    }
  );

  if (ENABLE_TEST_IPC) {
    ipcMain.handle(
      'desktop-test:inject-process-events',
      async (_event, payload: unknown) => {
        const events = parseDesktopProcessEventsForTest(payload);
        await handleDesktopProcessEvents(events);
        return {
          accepted: events.length,
        };
      }
    );
    ipcMain.handle(
      'desktop-test:inject-website-events',
      async (_event, payload: unknown) => {
        const events = parseDesktopWebsiteEventsForTest(payload);
        await evaluateAndRunStrictPolicy({
          websiteEvents: events,
          websiteSignalAvailable: true,
        });
        return {
          accepted: events.length,
        };
      }
    );
    ipcMain.handle('desktop-test:reset-policy-state', async () => {
      strictPolicyState = createDefaultStrictPolicyState();
      processEventLog = [];
      policyAuditLog = [];
      blockedWebsiteBySourceId.clear();
      return {
        reset: true,
      };
    });
  }

  ipcRegistered = true;
}

async function createMainWindow(options?: {
  show?: boolean;
}): Promise<BrowserWindowType> {
  const show = options?.show ?? true;
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 680,
    minHeight: 640,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    show,
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      partition: DESKTOP_PARTITION,
      additionalArguments: TEST_IPC_RENDERER_ARGS,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  applyWindowNavigationSecurity(mainWindow);
  wireDesktopWindowMaximizeEvents({
    window: mainWindow,
  });
  registerWebsiteSignalHandlers(mainWindow);
  await loadWindowContent(mainWindow);
  mainWindow.on('close', event => {
    if (!desktopRuntimePreferences.runInBackgroundOnClose || isAppQuitting) {
      return;
    }

    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    if (mainWindowRef === mainWindow) {
      mainWindowRef = null;
    }
  });

  return mainWindow;
}

async function ensureMainWindow(options?: {
  show?: boolean;
}): Promise<BrowserWindowType> {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    if (options?.show) {
      mainWindowRef.show();
    }
    return mainWindowRef;
  }

  mainWindowRef = await createMainWindow(options);
  return mainWindowRef;
}

function configureCompanionTaskbarTask(): void {
  if (process.platform !== 'win32') {
    return;
  }

  try {
    app.setUserTasks([
      {
        program: process.execPath,
        arguments: SHOW_COMPANION_ARG,
        iconPath: process.execPath,
        iconIndex: 0,
        title: 'Open companion window',
        description: 'Show the DevSuite session companion widget',
      },
    ]);
  } catch (error) {
    console.warn('[desktop] Failed to configure companion jump list task.', {
      error,
    });
  }
}

if (hasHostsWriteHelperArg(process.argv)) {
  void runHostsWriteHelperMode(process.argv);
} else {
  const hasSingleInstanceLock = app.requestSingleInstanceLock();
  if (!hasSingleInstanceLock) {
    app.quit();
  } else {
    app.on('second-instance', (_event, argv) => {
      if (hasShowCompanionArg(argv)) {
        void app.whenReady().then(() =>
          showSessionWidget({
            force: true,
            origin: 'second_instance_arg',
            mode: 'expanded',
          })
        );
        return;
      }

      void app.whenReady().then(() => showMainWindow());
    });

    app.whenReady().then(async () => {
      app.setAppUserModelId('com.devsuite.desktop');
      runtimeLog.info(
        'widget',
        `desktop icon paths resolved (appIcon=${APP_ICON_PATH}, trayCandidates=${TRAY_ICON_CANDIDATE_PATHS.join(',')})`
      );
      try {
        await cleanupStaleBlocks();
      } catch (error) {
        console.warn(
          '[desktop] Failed to clean stale hosts block on startup.',
          error
        );
      }
      await registerRendererProtocol();
      await initializeRuntimePreferences();
      registerIpcHandlers();
      setDesktopScope(await loadDesktopSessionScope());
      applyDesktopPermissionPolicy();
      ensureTray();
      if (!policyTickTimer) {
        policyTickTimer = setInterval(() => {
          void evaluateAndRunStrictPolicy();
        }, POLICY_TICK_INTERVAL_MS);
      }
      await ensureMainWindow({ show: true });
      configureCompanionTaskbarTask();
      await initializeCompanionShortcut();
      if (hasShowCompanionArg(process.argv)) {
        await showSessionWidget({
          force: true,
          origin: 'startup_arg',
          mode: 'expanded',
        });
      }

      app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          await ensureMainWindow({ show: true });
        }
      });
    });

    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
    });
  }

  app.on('before-quit', () => {
    isAppQuitting = true;
    processMonitor.stop();
    if (policyTickTimer) {
      clearInterval(policyTickTimer);
      policyTickTimer = null;
    }
    void unblockAll().catch(error => {
      console.warn('[desktop] Failed to clear hosts block before quit.', error);
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
