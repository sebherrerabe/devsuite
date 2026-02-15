// NOTE: This preload runs in Electron's sandboxed renderer context.
// Electron's sandbox loader ignores package.json "type" and loads .js as CJS,
// so this file MUST be compiled to CommonJS (see tsconfig.preload.json).
// TypeScript downlevels the `import` below to `require('electron')` which the
// sandbox shims for preload scripts.
import { contextBridge, ipcRenderer } from 'electron';

import type { DesktopFocusSettings } from './focus-settings.js';
import type { DesktopSettingsScope } from './focus-settings.js';
import {
  resolveTrustedDesktopOrigins,
  shouldExposeDesktopApis,
} from './preload-origin-guard.js';
import type {
  DesktopSessionAction,
  DesktopSessionCommand,
  DesktopSessionState,
} from './session-control.js';
import type {
  DesktopNotificationAction,
  DesktopNotificationActionEvent,
  DesktopNotificationKind,
} from './notifications.js';
import type { DesktopProcessEvent } from './process-monitor.js';
import type { StrictPolicyAuditEvent } from './strict-policy-engine.js';

type DesktopFocusApi = {
  get: (scope: DesktopSettingsScope) => Promise<DesktopFocusSettings>;
  set: (
    scope: DesktopSettingsScope,
    nextSettings: DesktopFocusSettings
  ) => Promise<DesktopFocusSettings>;
};

type DesktopAuthApi = {
  getScope: () => Promise<DesktopSettingsScope | null>;
  setScope: (scope: DesktopSettingsScope) => Promise<DesktopSettingsScope>;
  clearScope: () => Promise<void>;
  clearLocalState: () => Promise<void>;
};

type DesktopSessionApi = {
  getState: (scope: DesktopSettingsScope) => Promise<DesktopSessionState>;
  publishState: (
    scope: DesktopSettingsScope,
    nextState: DesktopSessionState
  ) => Promise<DesktopSessionState>;
  requestAction: (
    scope: DesktopSettingsScope,
    action: DesktopSessionAction
  ) => Promise<void>;
  onCommand: (
    listener: (command: DesktopSessionCommand) => void | Promise<void>
  ) => () => void;
  onStateChanged: (
    listener: (state: DesktopSessionState) => void | Promise<void>
  ) => () => void;
};

type DesktopNotificationPayload = {
  scope: DesktopSettingsScope;
  kind: DesktopNotificationKind;
  title: string;
  body: string;
  action: DesktopNotificationAction;
  route?: string | null;
  throttleKey?: string;
  throttleMs?: number;
};

type DesktopNotificationApi = {
  emit: (
    payload: DesktopNotificationPayload
  ) => Promise<{ delivered: boolean; throttled: boolean }>;
  routeAction: (actionPayload: DesktopNotificationActionEvent) => Promise<void>;
  onAction: (
    listener: (
      actionPayload: DesktopNotificationActionEvent
    ) => void | Promise<void>
  ) => () => void;
};

type DesktopProcessMonitorApi = {
  getEvents: (scope: DesktopSettingsScope) => Promise<DesktopProcessEvent[]>;
  onEvents: (
    listener: (events: DesktopProcessEvent[]) => void | Promise<void>
  ) => () => void;
};

type DesktopPolicyApi = {
  getAuditEvents: (
    scope: DesktopSettingsScope
  ) => Promise<StrictPolicyAuditEvent[]>;
  onAuditEvents: (
    listener: (events: StrictPolicyAuditEvent[]) => void | Promise<void>
  ) => () => void;
  applyOverride: (params: {
    scope: DesktopSettingsScope;
    durationMs: number;
    reason: string;
  }) => Promise<{
    scope: DesktopSettingsScope;
    overrideUntilMs: number | null;
  }>;
};

type DesktopTestWebsiteEvent = {
  type: 'website_blocked_started' | 'website_blocked_stopped';
  domain: string;
  sourceId: string;
  timestamp: number;
};

type DesktopTestApi = {
  injectProcessEvents: (
    events: DesktopProcessEvent[]
  ) => Promise<{ accepted: number }>;
  injectWebsiteEvents: (
    events: DesktopTestWebsiteEvent[]
  ) => Promise<{ accepted: number }>;
  resetPolicyState: () => Promise<{ reset: boolean }>;
};

const desktopFocusApi: DesktopFocusApi = {
  get: async scope =>
    ipcRenderer.invoke(
      'desktop-focus-settings:get',
      scope
    ) as Promise<DesktopFocusSettings>,
  set: async (scope, nextSettings) =>
    ipcRenderer.invoke(
      'desktop-focus-settings:set',
      scope,
      nextSettings
    ) as Promise<DesktopFocusSettings>,
};

const desktopAuthApi: DesktopAuthApi = {
  getScope: async () =>
    ipcRenderer.invoke(
      'desktop-auth:get-scope'
    ) as Promise<DesktopSettingsScope | null>,
  setScope: async scope =>
    ipcRenderer.invoke(
      'desktop-auth:set-scope',
      scope
    ) as Promise<DesktopSettingsScope>,
  clearScope: async () => {
    await ipcRenderer.invoke('desktop-auth:clear-scope');
  },
  clearLocalState: async () => {
    await ipcRenderer.invoke('desktop-auth:clear-local-state');
  },
};

const SESSION_COMMAND_CHANNEL = 'desktop-session:command';
const SESSION_STATE_CHANGED_CHANNEL = 'desktop-session:state-changed';
const NOTIFICATION_ACTION_CHANNEL = 'desktop-notification:action';
const PROCESS_EVENTS_CHANNEL = 'desktop-process-monitor:events';
const POLICY_AUDIT_CHANNEL = 'desktop-policy:audit-events';

const desktopSessionApi: DesktopSessionApi = {
  getState: async scope =>
    ipcRenderer.invoke(
      'desktop-session:get-state',
      scope
    ) as Promise<DesktopSessionState>,
  publishState: async (scope, nextState) =>
    ipcRenderer.invoke(
      'desktop-session:publish-state',
      scope,
      nextState
    ) as Promise<DesktopSessionState>,
  requestAction: async (scope, action) => {
    await ipcRenderer.invoke('desktop-session:request-action', scope, action);
  },
  onCommand: listener => {
    const wrapped = (_event: unknown, payload: DesktopSessionCommand) => {
      void listener(payload);
    };
    ipcRenderer.on(SESSION_COMMAND_CHANNEL, wrapped);
    return () => {
      ipcRenderer.removeListener(SESSION_COMMAND_CHANNEL, wrapped);
    };
  },
  onStateChanged: listener => {
    const wrapped = (_event: unknown, payload: DesktopSessionState) => {
      void listener(payload);
    };
    ipcRenderer.on(SESSION_STATE_CHANGED_CHANNEL, wrapped);
    return () => {
      ipcRenderer.removeListener(SESSION_STATE_CHANGED_CHANNEL, wrapped);
    };
  },
};

const desktopNotificationApi: DesktopNotificationApi = {
  emit: async payload =>
    ipcRenderer.invoke('desktop-notification:emit', payload) as Promise<{
      delivered: boolean;
      throttled: boolean;
    }>,
  routeAction: async actionPayload => {
    await ipcRenderer.invoke(
      'desktop-notification:route-action',
      actionPayload
    );
  },
  onAction: listener => {
    const wrapped = (
      _event: unknown,
      payload: DesktopNotificationActionEvent
    ) => {
      void listener(payload);
    };
    ipcRenderer.on(NOTIFICATION_ACTION_CHANNEL, wrapped);
    return () => {
      ipcRenderer.removeListener(NOTIFICATION_ACTION_CHANNEL, wrapped);
    };
  },
};

const desktopProcessMonitorApi: DesktopProcessMonitorApi = {
  getEvents: async scope =>
    ipcRenderer.invoke('desktop-process-monitor:get-events', scope) as Promise<
      DesktopProcessEvent[]
    >,
  onEvents: listener => {
    const wrapped = (_event: unknown, payload: DesktopProcessEvent[]) => {
      void listener(payload);
    };
    ipcRenderer.on(PROCESS_EVENTS_CHANNEL, wrapped);
    return () => {
      ipcRenderer.removeListener(PROCESS_EVENTS_CHANNEL, wrapped);
    };
  },
};

const desktopPolicyApi: DesktopPolicyApi = {
  getAuditEvents: async scope =>
    ipcRenderer.invoke('desktop-policy:get-audit-events', scope) as Promise<
      StrictPolicyAuditEvent[]
    >,
  onAuditEvents: listener => {
    const wrapped = (_event: unknown, payload: StrictPolicyAuditEvent[]) => {
      void listener(payload);
    };
    ipcRenderer.on(POLICY_AUDIT_CHANNEL, wrapped);
    return () => {
      ipcRenderer.removeListener(POLICY_AUDIT_CHANNEL, wrapped);
    };
  },
  applyOverride: async params =>
    ipcRenderer.invoke(
      'desktop-policy:apply-override',
      params.scope,
      params.durationMs,
      params.reason
    ) as Promise<{
      scope: DesktopSettingsScope;
      overrideUntilMs: number | null;
    }>,
};

const desktopTestApi: DesktopTestApi = {
  injectProcessEvents: async events =>
    ipcRenderer.invoke(
      'desktop-test:inject-process-events',
      events
    ) as Promise<{
      accepted: number;
    }>,
  injectWebsiteEvents: async events =>
    ipcRenderer.invoke(
      'desktop-test:inject-website-events',
      events
    ) as Promise<{
      accepted: number;
    }>,
  resetPolicyState: async () =>
    ipcRenderer.invoke('desktop-test:reset-policy-state') as Promise<{
      reset: boolean;
    }>,
};
const trustedOrigins = resolveTrustedDesktopOrigins({
  webUrl: process.env.DEVSUITE_WEB_URL,
  nodeEnv: process.env.NODE_ENV,
});
const hasTestIpcRendererSwitch =
  process.argv?.includes('--devsuite-enable-test-ipc=1') ?? false;
const isE2ETestHarnessPage =
  globalThis.location?.origin === 'null' &&
  globalThis.location?.hash === '#devsuite-e2e';
const shouldForceExposeApisForTestHarness =
  hasTestIpcRendererSwitch && isE2ETestHarnessPage;
const shouldExposeApis =
  shouldExposeDesktopApis({
    currentOrigin: globalThis.location?.origin,
    currentHash: globalThis.location?.hash,
    trustedOrigins,
  }) || shouldForceExposeApisForTestHarness;

if (shouldExposeApis) {
  contextBridge.exposeInMainWorld('desktopFocus', desktopFocusApi);
  contextBridge.exposeInMainWorld('desktopAuth', desktopAuthApi);
  contextBridge.exposeInMainWorld('desktopSession', desktopSessionApi);
  contextBridge.exposeInMainWorld(
    'desktopNotification',
    desktopNotificationApi
  );
  contextBridge.exposeInMainWorld(
    'desktopProcessMonitor',
    desktopProcessMonitorApi
  );
  contextBridge.exposeInMainWorld('desktopPolicy', desktopPolicyApi);
  if (shouldForceExposeApisForTestHarness) {
    contextBridge.exposeInMainWorld('desktopTest', desktopTestApi);
  }
}

declare global {
  interface Window {
    desktopFocus: DesktopFocusApi;
    desktopAuth?: DesktopAuthApi;
    desktopSession?: DesktopSessionApi;
    desktopNotification?: DesktopNotificationApi;
    desktopProcessMonitor?: DesktopProcessMonitorApi;
    desktopPolicy?: DesktopPolicyApi;
    desktopTest?: DesktopTestApi;
  }
}
