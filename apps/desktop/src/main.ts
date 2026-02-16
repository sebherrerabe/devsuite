import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { clearInterval, setInterval } from 'node:timers';
import { promisify } from 'node:util';
import { URL, fileURLToPath } from 'node:url';
import type {
  BrowserWindow as BrowserWindowType,
  Event as ElectronEvent,
  Tray as TrayType,
} from 'electron';

import {
  DEFAULT_COMPANION_SHORTCUT,
  loadCompanionShortcut,
  loadDesktopFocusSettings,
  parseCompanionShortcut,
  saveCompanionShortcut,
  saveDesktopFocusSettings,
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
  parseDesktopSessionState,
  type DesktopSessionAction,
  type DesktopSessionState,
} from './session-control.js';
import {
  parseDesktopNotificationActionEvent,
  parseDesktopNotificationRequest,
  shouldThrottleDesktopNotification,
  type DesktopNotificationActionEvent,
} from './notifications.js';
import {
  WindowsProcessMonitor,
  createProcessWatchConfigFromFocusSettings,
  listWindowsProcessesVerbose,
  normalizeProcessWatchConfig,
  type DesktopProcessEvent,
} from './process-monitor.js';
import {
  applyStrictPolicyOverride,
  createDefaultStrictPolicyState,
  evaluateStrictPolicy,
  type DesktopWebsiteEvent,
  type StrictPolicyAuditEvent,
  type StrictPolicyState,
} from './strict-policy-engine.js';
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
  globalShortcut,
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
const WEBSITE_SOURCE_PREFIX = 'webcontents';
const ENABLE_TEST_IPC = process.env.DEVSUITE_DESKTOP_ENABLE_TEST_IPC === '1';
const TEST_IPC_RENDERER_SWITCH = '--devsuite-enable-test-ipc=1';
const TEST_IPC_RENDERER_ARGS = ENABLE_TEST_IPC
  ? [TEST_IPC_RENDERER_SWITCH]
  : [];
const SHOW_COMPANION_ARG = '--show-companion';
const DESKTOP_ADDITIONAL_NAV_ORIGINS =
  process.env.DEVSUITE_DESKTOP_NAV_ALLOW_ORIGINS;
const APP_ICON_PATH = join(__dirname, '..', 'assets', 'icon.png');

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
let processEventLog: DesktopProcessEvent[] = [];
let policyAuditLog: StrictPolicyAuditEvent[] = [];
const blockedWebsiteBySourceId = new Map<string, string>();
let policyTickTimer: ReturnType<typeof setInterval> | null = null;
let rendererProtocolRegistered = false;
let companionShortcut = DEFAULT_COMPANION_SHORTCUT;
let registeredCompanionShortcut: string | null = null;
const execFileAsync = promisify(execFile);
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

function hasShowCompanionArg(argv: readonly string[]): boolean {
  return argv.includes(SHOW_COMPANION_ARG);
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

function broadcastDesktopSessionState(): void {
  const snapshot = getDesktopSessionStateSnapshot();
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(SESSION_STATE_CHANGED_CHANNEL, snapshot);
    }
  }
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

async function executeStrictPolicyActions(
  scope: DesktopSettingsScope,
  actions: ReturnType<typeof evaluateStrictPolicy>['actions']
): Promise<void> {
  for (const action of actions) {
    if (action.type === 'notify') {
      await emitDesktopNotification({
        scope,
        kind: action.kind,
        title: action.title,
        body: action.body,
        action: action.action,
        route: action.route,
        throttleKey: action.throttleKey,
        throttleMs: action.throttleMs,
      });
      if (action.kind === 'ide_session_required') {
        void showSessionWidget();
      }
      continue;
    }

    if (action.type === 'close_process' && process.platform === 'win32') {
      try {
        await execFileAsync('taskkill', ['/PID', `${action.pid}`, '/F', '/T'], {
          windowsHide: true,
          timeout: 8_000,
          maxBuffer: 1024 * 1024,
        });
      } catch (error) {
        console.warn('[desktop] Failed to close process from policy action.', {
          executable: action.executable,
          pid: action.pid,
          reason: action.reason,
          error,
        });
      }
    }
  }
}

async function evaluateAndRunStrictPolicy(input?: {
  processEvents?: DesktopProcessEvent[];
  websiteEvents?: DesktopWebsiteEvent[];
  websiteSignalAvailable?: boolean;
}): Promise<void> {
  const activeScope = desktopSessionScope;
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
    await executeStrictPolicyActions(activeScope, evaluation.actions);
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
    return;
  }

  try {
    const settings =
      providedSettings ?? (await loadDesktopFocusSettings(scope));
    desktopFocusSettings = settings;
    const config = createProcessWatchConfigFromFocusSettings(settings);
    processMonitor.setConfig(config);
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

async function routeDesktopNotificationAction(
  requestedAction: DesktopNotificationActionEvent
): Promise<void> {
  const resolvedScope = await resolveScopedDesktopContext(
    requestedAction.scope
  );
  const actionEvent: DesktopNotificationActionEvent = {
    scope: resolvedScope,
    action: requestedAction.action,
    route: requestedAction.route,
    requestedAt: requestedAction.requestedAt,
  };

  await showMainWindow();

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(NOTIFICATION_ACTION_CHANNEL, actionEvent);
    }
  }
}

async function emitDesktopNotification(payload: unknown): Promise<{
  delivered: boolean;
  throttled: boolean;
}> {
  const request = parseDesktopNotificationRequest(payload);
  const resolvedScope = await resolveScopedDesktopContext(request.scope);
  const now = Date.now();
  const lastSentAt = notificationSentAtByKey.get(request.throttleKey) ?? null;
  const isThrottled = shouldThrottleDesktopNotification(
    lastSentAt,
    request.throttleMs,
    now
  );

  if (isThrottled) {
    return {
      delivered: false,
      throttled: true,
    };
  }

  notificationSentAtByKey.set(request.throttleKey, now);

  const actionEvent: DesktopNotificationActionEvent = {
    scope: resolvedScope,
    action: request.action,
    route: request.route,
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
  });

  toast.on('click', () => {
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
  action: DesktopSessionAction
): Promise<void> {
  if (!desktopSessionScope) {
    throw new Error('Desktop scope is not initialized.');
  }

  if (!canDispatchSessionAction(action)) {
    return;
  }

  const targetWindow = await ensureMainWindow({ show: false });
  const commandPayload = {
    scope: desktopSessionScope,
    action,
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
      label: 'Show Session Widget',
      enabled: hasScope,
      click: () => {
        void showSessionWidget();
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

function ensureTray(): void {
  if (trayRef) {
    return;
  }

  try {
    trayRef = new Tray(nativeImage.createFromPath(APP_ICON_PATH));
    trayRef.on('click', () => {
      void showMainWindow();
    });
    rebuildTrayMenu();
  } catch (error) {
    console.warn('[desktop] Failed to initialize tray menu.', error);
  }
}

function setDesktopScope(nextScope: DesktopSettingsScope | null): void {
  const hasChanged =
    !nextScope ||
    !desktopSessionScope ||
    !areScopesEqual(nextScope, desktopSessionScope);

  desktopSessionScope = nextScope;

  if (hasChanged) {
    desktopSessionState = createDefaultDesktopSessionState();
    strictPolicyState = createDefaultStrictPolicyState();
    processEventLog = [];
    policyAuditLog = [];
    blockedWebsiteBySourceId.clear();
    rebuildTrayMenu();
    broadcastDesktopSessionState();
    void refreshProcessMonitorForScope(nextScope);
  }
}

function createSessionWidgetHtml() {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DevSuite Session Widget</title>
    <style>
      :root {
        font-family: "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        padding: 14px;
        background: #0f172a;
        color: #e2e8f0;
      }
      .card {
        border-radius: 10px;
        border: 1px solid #334155;
        background: #111827;
        padding: 12px;
      }
      .status {
        font-size: 13px;
        margin-bottom: 6px;
      }
      .meta {
        font-size: 12px;
        color: #93c5fd;
        margin-bottom: 6px;
      }
      .timer {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .error {
        min-height: 16px;
        margin-bottom: 10px;
        font-size: 11px;
        color: #fca5a5;
      }
      .actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      button {
        font: inherit;
        padding: 8px;
        border-radius: 7px;
        border: 1px solid #3b82f6;
        background: #1d4ed8;
        color: #eff6ff;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="status" id="status">Status: IDLE</div>
      <div class="meta" id="meta">Syncing desktop bridge...</div>
      <div class="timer" id="timer">00:00:00</div>
      <div class="error" id="error"></div>
      <div class="actions">
        <button id="start">Start</button>
        <button id="pause">Pause</button>
        <button id="resume">Resume</button>
        <button id="end">End</button>
      </div>
    </div>
    <script>
      const statusElement = document.getElementById('status');
      const metaElement = document.getElementById('meta');
      const timerElement = document.getElementById('timer');
      const errorElement = document.getElementById('error');
      const startButton = document.getElementById('start');
      const pauseButton = document.getElementById('pause');
      const resumeButton = document.getElementById('resume');
      const endButton = document.getElementById('end');
      let currentState = null;
      let lastBridgeSignalAt = 0;

      function formatDuration(totalMs) {
        const seconds = Math.floor(Math.max(0, totalMs) / 1000);
        const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
        const remaining = String(seconds % 60).padStart(2, '0');
        return hours + ':' + minutes + ':' + remaining;
      }

      function calculateEffectiveDuration(state) {
        const base = Number.isFinite(state.effectiveDurationMs)
          ? state.effectiveDurationMs
          : 0;
        if (state.status !== 'RUNNING') {
          return base;
        }
        if (state.connectionState !== 'connected') {
          return base;
        }
        return base + Math.max(0, Date.now() - state.updatedAt);
      }

      function updateTimer() {
        if (!currentState) {
          timerElement.textContent = '00:00:00';
          return;
        }
        timerElement.textContent = formatDuration(calculateEffectiveDuration(currentState));
      }

      function setButtonStates(state) {
        const connected = state.connectionState === 'connected';
        startButton.disabled = !connected || state.status !== 'IDLE';
        pauseButton.disabled = !connected || state.status !== 'RUNNING';
        resumeButton.disabled = !connected || state.status !== 'PAUSED';
        endButton.disabled = !connected || state.status === 'IDLE';
      }

      function formatMeta(state) {
        const suffix = state.sessionId ? 'session=' + state.sessionId : 'session=none';
        const connection = 'connection=' + state.connectionState;
        return connection + ' · ' + suffix;
      }

      function renderState(state) {
        currentState = state;
        lastBridgeSignalAt = Date.now();
        statusElement.textContent = 'Status: ' + state.status;
        metaElement.textContent = formatMeta(state);
        errorElement.textContent = state.lastError || '';
        setButtonStates(state);
        updateTimer();
      }

      async function resolveScope() {
        const scope = await window.desktopAuth.getScope();
        if (!scope) {
          throw new Error('Desktop scope is not initialized.');
        }
        return scope;
      }

      async function request(action) {
        try {
          const scope = await resolveScope();
          await window.desktopSession.requestAction(scope, action);
        } catch (error) {
          const message = error && error.message ? error.message : String(error);
          errorElement.textContent = message;
        }
      }

      startButton.addEventListener('click', () => request('start'));
      pauseButton.addEventListener('click', () => request('pause'));
      resumeButton.addEventListener('click', () => request('resume'));
      endButton.addEventListener('click', () => request('end'));

      window.desktopSession.onStateChanged(nextState => {
        renderState(nextState);
      });

      resolveScope()
        .then(scope => window.desktopSession.getState(scope))
        .then(renderState)
        .catch(error => {
          const message = error && error.message ? error.message : String(error);
          errorElement.textContent = message;
        });

      setInterval(() => {
        updateTimer();

        if (!currentState) {
          return;
        }

        const staleForMs = Date.now() - lastBridgeSignalAt;
        if (staleForMs > 45000) {
          metaElement.textContent = 'connection=stale · waiting for sync';
          startButton.disabled = true;
          pauseButton.disabled = true;
          resumeButton.disabled = true;
          endButton.disabled = true;
        }
      }, 1000);
    </script>
  </body>
</html>
  `;
}

async function showSessionWidget(): Promise<void> {
  if (sessionWidgetWindowRef && !sessionWidgetWindowRef.isDestroyed()) {
    sessionWidgetWindowRef.show();
    sessionWidgetWindowRef.focus();
    return;
  }

  sessionWidgetWindowRef = new BrowserWindow({
    width: 310,
    height: 230,
    resizable: false,
    minimizable: true,
    maximizable: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    skipTaskbar: false,
    title: 'DevSuite Session Widget',
    backgroundColor: '#0f172a',
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
  applyWindowNavigationSecurity(sessionWidgetWindowRef);

  sessionWidgetWindowRef.on('closed', () => {
    sessionWidgetWindowRef = null;
  });

  await sessionWidgetWindowRef.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(createSessionWidgetHtml())}#devsuite-widget`
  );
  broadcastDesktopSessionState();
}

function tryRegisterCompanionShortcut(shortcut: string): boolean {
  try {
    return globalShortcut.register(shortcut, () => {
      void showSessionWidget();
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

  await protocol.handle(RENDERER_PROTOCOL_SCHEME, async request => {
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
  });

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
      const savedSettings = await saveDesktopFocusSettings(
        resolvedScope,
        payload
      );
      if (
        desktopSessionScope &&
        areScopesEqual(desktopSessionScope, resolvedScope)
      ) {
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

      desktopSessionState = parseDesktopSessionState(payload);
      rebuildTrayMenu();
      broadcastDesktopSessionState();
      await evaluateAndRunStrictPolicy();
      return getDesktopSessionStateSnapshot();
    }
  );
  ipcMain.handle(
    'desktop-session:request-action',
    async (_event, scope: unknown, action: unknown) => {
      const resolvedScope = await resolveScopedDesktopContext(scope);
      if (
        !desktopSessionScope ||
        !areScopesEqual(desktopSessionScope, resolvedScope)
      ) {
        desktopSessionScope = resolvedScope;
      }

      const parsedAction = parseDesktopSessionAction(action);
      await dispatchDesktopSessionAction(parsedAction);
    }
  );
  ipcMain.handle('desktop-session:show-companion', async () => {
    await showSessionWidget();
  });
  ipcMain.handle('desktop-companion:get-shortcut', async () => {
    return companionShortcut;
  });
  ipcMain.handle(
    'desktop-companion:set-shortcut',
    async (_event, shortcut: unknown) => {
      return updateCompanionShortcut(shortcut);
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
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    show,
    icon: APP_ICON_PATH,
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#e2e8f0',
      height: 36,
    },
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
  registerWebsiteSignalHandlers(mainWindow);
  await loadWindowContent(mainWindow);

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

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (hasShowCompanionArg(argv)) {
      void app.whenReady().then(() => showSessionWidget());
      return;
    }

    void app.whenReady().then(() => showMainWindow());
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.devsuite.desktop');
    await registerRendererProtocol();
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
      await showSessionWidget();
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
  processMonitor.stop();
  if (policyTickTimer) {
    clearInterval(policyTickTimer);
    policyTickTimer = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
