/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string;
  readonly VITE_CONVEX_SITE_URL?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_GH_SERVICE_URL?: string;
  readonly VITE_GH_SERVICE_TOKEN?: string;
  readonly VITE_NOTION_SERVICE_URL?: string;
  readonly VITE_NOTION_SERVICE_TOKEN?: string;
  readonly VITE_WEB_PUSH_VAPID_PUBLIC_KEY?: string;
  readonly VITE_DESKTOP_INSTALLER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface DesktopSettingsScope {
  userId: string;
  companyId: string;
}

type DesktopStrictMode = 'prompt_only' | 'prompt_then_close';
type DesktopAppActionMode = 'warn' | 'warn_then_close';
type DesktopWebsiteActionMode = 'warn_only' | 'escalate';

interface DesktopFocusSettings {
  ideWatchList: string[];
  appBlockList: string[];
  websiteBlockList: string[];
  strictMode: DesktopStrictMode;
  appActionMode: DesktopAppActionMode;
  websiteActionMode: DesktopWebsiteActionMode;
  graceSeconds: number;
  reminderIntervalSeconds: number;
}

type DesktopSessionStatus = 'IDLE' | 'RUNNING' | 'PAUSED';
type DesktopSessionAction = 'start' | 'pause' | 'resume' | 'end';
type DesktopSessionEndDecision = 'keep_ongoing' | 'mark_all_done' | 'cancel';
type DesktopCompanionMode = 'mini' | 'expanded';
type DesktopCompanionSwitchDecision =
  | 'stay_here'
  | 'leave_running'
  | 'pause_session'
  | 'end_session';
type DesktopSessionConnectionState = 'connected' | 'syncing' | 'error';
type DesktopNotificationKind =
  | 'session_started'
  | 'session_paused'
  | 'session_resumed'
  | 'session_ended'
  | 'ide_session_required'
  | 'distractor_app_detected'
  | 'website_blocked_detected'
  | 'tasks_remaining_reminder'
  | 'inbox_item';
type DesktopNotificationAction =
  | 'open_app'
  | 'open_sessions'
  | 'start_session'
  | 'open_inbox';
type DesktopProcessCategory = 'ide' | 'app_block';
type DesktopProcessEventType = 'process_started' | 'process_stopped';

interface DesktopSessionState {
  status: DesktopSessionStatus;
  sessionId: string | null;
  effectiveDurationMs: number;
  remainingTaskCount: number | null;
  connectionState: DesktopSessionConnectionState;
  lastError: string | null;
  updatedAt: number;
  publishedAt?: number;
  recordingIDE?: string | null;
}

interface IdeFocusEventPayload {
  executable: string;
  processId?: number;
  path?: string;
}

interface IdeFocusEvent {
  type: 'IDE_FOCUS_GAINED' | 'IDE_FOCUS_LOST';
  payload: IdeFocusEventPayload;
  clientTimestamp: number;
}

interface DesktopSessionCommand {
  scope: DesktopSettingsScope;
  action: DesktopSessionAction;
  endDecision?: DesktopSessionEndDecision;
  requestedAt: number;
}

interface DesktopNotificationActionEvent {
  scope: DesktopSettingsScope;
  action: DesktopNotificationAction;
  route: string | null;
  requestedAt: number;
}

interface DesktopProcessEvent {
  type: DesktopProcessEventType;
  executable: string;
  pid: number;
  category: DesktopProcessCategory;
  timestamp: number;
}

type DesktopStrictPolicyAuditEventType =
  | 'ide_prompt_started'
  | 'ide_reminder_sent'
  | 'ide_close_requested'
  | 'ide_entry_cleared'
  | 'app_prompt_started'
  | 'app_reminder_sent'
  | 'app_close_requested'
  | 'app_entry_cleared'
  | 'website_prompt_started'
  | 'website_reminder_sent'
  | 'website_escalated'
  | 'website_entry_cleared'
  | 'website_signal_unavailable'
  | 'tasks_reminder_sent'
  | 'tasks_escalation_sent'
  | 'tasks_reminder_cleared'
  | 'override_applied'
  | 'fail_safe_engaged'
  | 'fail_safe_recovered';

interface DesktopStrictPolicyAuditEvent {
  type: DesktopStrictPolicyAuditEventType;
  timestamp: number;
  metadata: Record<string, string | number | boolean | null>;
}

interface DesktopRuntimePreferences {
  openAtLogin: boolean;
  runInBackgroundOnClose: boolean;
}

interface Window {
  desktopAuth?: {
    getScope: () => Promise<DesktopSettingsScope | null>;
    setScope: (scope: DesktopSettingsScope) => Promise<DesktopSettingsScope>;
    clearScope: () => Promise<void>;
    clearLocalState: () => Promise<void>;
  };
  desktopCompany?: {
    getSelection: () => Promise<string | null>;
    setSelection: (companyId: string | null) => Promise<string | null>;
    onSelectionChanged: (
      listener: (companyId: string | null) => void | Promise<void>
    ) => () => void;
  };
  desktopFocus?: {
    get: (scope: DesktopSettingsScope) => Promise<DesktopFocusSettings>;
    set: (
      scope: DesktopSettingsScope,
      settings: DesktopFocusSettings
    ) => Promise<DesktopFocusSettings>;
  };
  desktopSession?: {
    getState: (scope: DesktopSettingsScope) => Promise<DesktopSessionState>;
    publishState: (
      scope: DesktopSettingsScope,
      state: DesktopSessionState
    ) => Promise<DesktopSessionState>;
    requestAction: (
      scope: DesktopSettingsScope,
      action: DesktopSessionAction,
      endDecision?: DesktopSessionEndDecision
    ) => Promise<void>;
    showCompanion: (mode?: DesktopCompanionMode) => Promise<void>;
    setCompanionMode: (mode: DesktopCompanionMode) => Promise<void>;
    setWidgetMousePassthrough: (enabled: boolean) => Promise<void>;
    onCommand: (
      listener: (command: DesktopSessionCommand) => void | Promise<void>
    ) => () => void;
    onStateChanged: (
      listener: (state: DesktopSessionState) => void | Promise<void>
    ) => () => void;
    onIdeFocusEvent: (
      listener: (event: IdeFocusEvent) => void | Promise<void>
    ) => () => void;
    onStaleAutoEndRequested: (
      listener: (payload: {
        companyId: string;
        sessionId: string;
      }) => void | Promise<void>
    ) => () => void;
  };
  desktopCompanion?: {
    getShortcut: () => Promise<string>;
    setShortcut: (shortcut: string) => Promise<string>;
  };
  desktopCompanionUi?: {
    confirmCompanySwitch: (
      nextCompanyName: string
    ) => Promise<DesktopCompanionSwitchDecision>;
    notify: (payload: {
      level: 'success' | 'info' | 'warning' | 'error';
      title: string;
      body?: string | null;
    }) => Promise<void>;
  };
  desktopRuntimePreferences?: {
    get: () => Promise<DesktopRuntimePreferences>;
    set: (
      nextPreferences: DesktopRuntimePreferences
    ) => Promise<DesktopRuntimePreferences>;
  };
  desktopNotification?: {
    emit: (payload: {
      scope: DesktopSettingsScope;
      kind: DesktopNotificationKind;
      title: string;
      body: string;
      action: DesktopNotificationAction;
      route?: string | null;
      throttleKey?: string;
      throttleMs?: number;
    }) => Promise<{ delivered: boolean; throttled: boolean }>;
    consumePendingActions: (
      scope: DesktopSettingsScope
    ) => Promise<DesktopNotificationActionEvent[]>;
    routeAction: (
      actionPayload: DesktopNotificationActionEvent
    ) => Promise<void>;
    onAction: (
      listener: (
        actionPayload: DesktopNotificationActionEvent
      ) => void | Promise<void>
    ) => () => void;
  };
  desktopProcessMonitor?: {
    getEvents: (scope: DesktopSettingsScope) => Promise<DesktopProcessEvent[]>;
    listRunningProcesses: () => Promise<
      Array<{ executable: string; windowTitle: string }>
    >;
    onEvents: (
      listener: (events: DesktopProcessEvent[]) => void | Promise<void>
    ) => () => void;
  };
  desktopPolicy?: {
    getAuditEvents: (
      scope: DesktopSettingsScope
    ) => Promise<DesktopStrictPolicyAuditEvent[]>;
    onAuditEvents: (
      listener: (
        events: DesktopStrictPolicyAuditEvent[]
      ) => void | Promise<void>
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
  desktopWidget?: {
    close: () => Promise<void>;
  };
  desktopWindow?: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    onMaximizeChange: (
      listener: (maximized: boolean) => void | Promise<void>
    ) => () => void;
  };
}
