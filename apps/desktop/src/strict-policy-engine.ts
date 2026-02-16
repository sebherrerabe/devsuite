import type { DesktopFocusSettings } from './focus-settings.js';
import type { DesktopProcessEvent } from './process-monitor.js';
import { runtimeLog, type RuntimeLogWriter } from './runtime-logger.js';
import type { DesktopSessionState } from './session-control.js';

type SessionStatus = DesktopSessionState['status'];

export type StrictPolicyAuditEventType =
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

export interface StrictPolicyAuditEvent {
  type: StrictPolicyAuditEventType;
  timestamp: number;
  metadata: Record<string, string | number | boolean | null>;
}

export type StrictPolicyNotificationKind =
  | 'ide_session_required'
  | 'distractor_app_detected'
  | 'website_blocked_detected'
  | 'tasks_remaining_reminder';

export interface StrictPolicyNotificationAction {
  type: 'notify';
  kind: StrictPolicyNotificationKind;
  title: string;
  body: string;
  action: 'open_sessions' | 'start_session';
  route: '/sessions';
  throttleKey: string;
  throttleMs: number;
}

export interface StrictPolicyCloseProcessAction {
  type: 'close_process';
  executable: string;
  pid: number;
  reason: 'ide_no_session' | 'distractor_app';
}

export type StrictPolicyAction =
  | StrictPolicyNotificationAction
  | StrictPolicyCloseProcessAction;

interface PolicyEntry {
  executable: string;
  pid: number;
  firstDetectedAt: number;
  lastReminderAt: number;
  reminderCount: number;
  closeIssued: boolean;
}

interface WebsitePolicyEntry {
  domain: string;
  sourceId: string;
  firstDetectedAt: number;
  lastReminderAt: number;
  reminderCount: number;
}

interface TaskReminderState {
  lastReminderAt: number | null;
  reminderCount: number;
  lastKnownRemainingTaskCount: number;
}

export interface StrictPolicyState {
  version: 1;
  ideEntries: Record<string, PolicyEntry>;
  appEntries: Record<string, PolicyEntry>;
  websiteEntries: Record<string, WebsitePolicyEntry>;
  taskReminder: TaskReminderState;
  lastWebsiteSignalUnavailableAt: number | null;
  overrideUntilMs: number | null;
  recentActionTimestamps: number[];
  failSafeActive: boolean;
}

export interface DesktopWebsiteEvent {
  type: 'website_blocked_started' | 'website_blocked_stopped';
  domain: string;
  sourceId: string;
  timestamp: number;
}

export interface StrictPolicyInput {
  scope: {
    userId: string;
    companyId: string;
  };
  settings: DesktopFocusSettings;
  sessionState: DesktopSessionState;
  processEvents: DesktopProcessEvent[];
  websiteEvents: DesktopWebsiteEvent[];
  websiteSignalAvailable: boolean;
  remainingTaskCount: number | null;
  nowMs: number;
}

export interface StrictPolicyEvaluationResult {
  nextState: StrictPolicyState;
  actions: StrictPolicyAction[];
  auditEvents: StrictPolicyAuditEvent[];
}

const RECENT_ACTION_WINDOW_MS = 60_000;
const FAIL_SAFE_ACTION_THRESHOLD = 30;
const FAIL_SAFE_RECOVERY_THRESHOLD = 5;

function toEntryKey(executable: string, pid: number): string {
  return `${executable}:${pid}`;
}

function toWebsiteEntryKey(domain: string, sourceId: string): string {
  return `${domain}:${sourceId}`;
}

function pruneRecentActionTimestamps(
  recentActionTimestamps: number[],
  nowMs: number
): number[] {
  return recentActionTimestamps.filter(
    timestamp => nowMs - timestamp <= RECENT_ACTION_WINDOW_MS
  );
}

function isOverrideActive(state: StrictPolicyState, nowMs: number): boolean {
  return state.overrideUntilMs !== null && nowMs < state.overrideUntilMs;
}

function isSessionActive(status: SessionStatus): boolean {
  return status === 'RUNNING' || status === 'PAUSED';
}

function createEntry(event: DesktopProcessEvent): PolicyEntry {
  return {
    executable: event.executable,
    pid: event.pid,
    firstDetectedAt: event.timestamp,
    lastReminderAt: event.timestamp,
    reminderCount: 0,
    closeIssued: false,
  };
}

function createWebsiteEntry(event: DesktopWebsiteEvent): WebsitePolicyEntry {
  return {
    domain: event.domain,
    sourceId: event.sourceId,
    firstDetectedAt: event.timestamp,
    lastReminderAt: event.timestamp,
    reminderCount: 0,
  };
}

function createTaskReminderState(): TaskReminderState {
  return {
    lastReminderAt: null,
    reminderCount: 0,
    lastKnownRemainingTaskCount: 0,
  };
}

function toAuditEvent(
  type: StrictPolicyAuditEventType,
  timestamp: number,
  metadata: Record<string, string | number | boolean | null>
): StrictPolicyAuditEvent {
  return {
    type,
    timestamp,
    metadata,
  };
}

function buildIdePromptNotification(params: {
  scope: StrictPolicyInput['scope'];
  executable: string;
  throttleSuffix: string;
  throttleMs: number;
  bodyPrefix: string;
}): StrictPolicyNotificationAction {
  return {
    type: 'notify',
    kind: 'ide_session_required',
    title: 'Start a session before coding',
    body: `${params.bodyPrefix} ${params.executable} is open without an active session.`,
    action: 'start_session',
    route: '/sessions',
    throttleKey: `${params.scope.userId}:${params.scope.companyId}:ide:${params.executable}:${params.throttleSuffix}`,
    throttleMs: params.throttleMs,
  };
}

function buildAppPromptNotification(params: {
  scope: StrictPolicyInput['scope'];
  executable: string;
  throttleSuffix: string;
  throttleMs: number;
  bodyPrefix: string;
}): StrictPolicyNotificationAction {
  return {
    type: 'notify',
    kind: 'distractor_app_detected',
    title: 'Distractor app detected',
    body: `${params.bodyPrefix} ${params.executable} is open during an active focus session.`,
    action: 'open_sessions',
    route: '/sessions',
    throttleKey: `${params.scope.userId}:${params.scope.companyId}:app:${params.executable}:${params.throttleSuffix}`,
    throttleMs: params.throttleMs,
  };
}

function buildWebsitePromptNotification(params: {
  scope: StrictPolicyInput['scope'];
  domain: string;
  throttleSuffix: string;
  throttleMs: number;
  bodyPrefix: string;
}): StrictPolicyNotificationAction {
  return {
    type: 'notify',
    kind: 'website_blocked_detected',
    title: 'Blocked website detected',
    body: `${params.bodyPrefix} ${params.domain} is on your focus block list.`,
    action: 'open_sessions',
    route: '/sessions',
    throttleKey: `${params.scope.userId}:${params.scope.companyId}:website:${params.domain}:${params.throttleSuffix}`,
    throttleMs: params.throttleMs,
  };
}

function buildTasksReminderNotification(params: {
  scope: StrictPolicyInput['scope'];
  remainingTaskCount: number;
  reminderCount: number;
  throttleMs: number;
  escalated: boolean;
}): StrictPolicyNotificationAction {
  const taskLabel = params.remainingTaskCount === 1 ? 'task' : 'tasks';
  return {
    type: 'notify',
    kind: 'tasks_remaining_reminder',
    title: params.escalated
      ? 'Tasks still pending'
      : 'Tasks remaining in session',
    body: params.escalated
      ? `Escalation: ${params.remainingTaskCount} ${taskLabel} remain. Complete one now or intentionally end the session.`
      : `You still have ${params.remainingTaskCount} ${taskLabel} remaining in this focus session.`,
    action: 'open_sessions',
    route: '/sessions',
    throttleKey: `${params.scope.userId}:${params.scope.companyId}:tasks:${params.escalated ? 'escalated' : 'routine'}:${params.reminderCount}`,
    throttleMs: params.throttleMs,
  };
}

export function createDefaultStrictPolicyState(): StrictPolicyState {
  return {
    version: 1,
    ideEntries: {},
    appEntries: {},
    websiteEntries: {},
    taskReminder: createTaskReminderState(),
    lastWebsiteSignalUnavailableAt: null,
    overrideUntilMs: null,
    recentActionTimestamps: [],
    failSafeActive: false,
  };
}

export function applyStrictPolicyOverride(
  state: StrictPolicyState,
  params: {
    nowMs: number;
    durationMs: number;
    reason: string;
  }
): { nextState: StrictPolicyState; auditEvent: StrictPolicyAuditEvent } {
  const safeDurationMs = Math.max(0, Math.trunc(params.durationMs));
  const overrideUntilMs = params.nowMs + safeDurationMs;

  const resetEntries = (entries: Record<string, PolicyEntry>) => {
    const nextEntries: Record<string, PolicyEntry> = {};
    for (const [key, entry] of Object.entries(entries)) {
      nextEntries[key] = {
        ...entry,
        firstDetectedAt: params.nowMs,
        lastReminderAt: params.nowMs,
        reminderCount: 0,
        closeIssued: false,
      };
    }
    return nextEntries;
  };

  const resetWebsiteEntries = (
    entries: Record<string, WebsitePolicyEntry>
  ): Record<string, WebsitePolicyEntry> => {
    const nextEntries: Record<string, WebsitePolicyEntry> = {};
    for (const [key, entry] of Object.entries(entries)) {
      nextEntries[key] = {
        ...entry,
        firstDetectedAt: params.nowMs,
        lastReminderAt: params.nowMs,
        reminderCount: 0,
      };
    }
    return nextEntries;
  };

  return {
    nextState: {
      ...state,
      overrideUntilMs,
      ideEntries: resetEntries(state.ideEntries),
      appEntries: resetEntries(state.appEntries),
      websiteEntries: resetWebsiteEntries(state.websiteEntries),
      taskReminder: createTaskReminderState(),
    },
    auditEvent: toAuditEvent('override_applied', params.nowMs, {
      reason: params.reason || 'user_override',
      durationMs: safeDurationMs,
      overrideUntilMs,
    }),
  };
}

function normalizeRemainingTaskCount(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value)) {
    return null;
  }

  return Math.max(0, value);
}

export function evaluateStrictPolicy(
  state: StrictPolicyState,
  input: StrictPolicyInput,
  logger: RuntimeLogWriter = runtimeLog
): StrictPolicyEvaluationResult {
  const auditEvents: StrictPolicyAuditEvent[] = [];
  const actions: StrictPolicyAction[] = [];
  const reminderIntervalMs = input.settings.reminderIntervalSeconds * 1000;
  const graceWindowMs = input.settings.graceSeconds * 1000;

  let ideEntries = { ...state.ideEntries };
  let appEntries = { ...state.appEntries };
  let websiteEntries = { ...state.websiteEntries };
  let taskReminder = { ...state.taskReminder };
  let lastWebsiteSignalUnavailableAt = state.lastWebsiteSignalUnavailableAt;

  let recentActionTimestamps = pruneRecentActionTimestamps(
    state.recentActionTimestamps,
    input.nowMs
  );
  const failSafeWasActive = state.failSafeActive;
  let failSafeActive = failSafeWasActive;

  const overrideActive = isOverrideActive(state, input.nowMs);
  const sessionIsIdle = input.sessionState.status === 'IDLE';
  const sessionIsActive = isSessionActive(input.sessionState.status);

  for (const event of input.processEvents) {
    const key = toEntryKey(event.executable, event.pid);

    if (event.category === 'ide') {
      if (event.type === 'process_started') {
        const existingEntry = ideEntries[key];
        const entry = existingEntry ?? createEntry(event);
        ideEntries[key] = entry;

        if (sessionIsIdle && !overrideActive) {
          actions.push(
            buildIdePromptNotification({
              scope: input.scope,
              executable: entry.executable,
              throttleSuffix: 'initial',
              throttleMs: 60_000,
              bodyPrefix: 'Focus mode requires a session before coding.',
            })
          );
          auditEvents.push(
            toAuditEvent('ide_prompt_started', event.timestamp, {
              executable: event.executable,
              pid: event.pid,
            })
          );
        }
      } else if (event.type === 'process_stopped' && ideEntries[key]) {
        delete ideEntries[key];
        auditEvents.push(
          toAuditEvent('ide_entry_cleared', event.timestamp, {
            executable: event.executable,
            pid: event.pid,
            reason: 'process_stopped',
          })
        );
      }
      continue;
    }

    if (event.category === 'app_block') {
      if (event.type === 'process_started') {
        const existingEntry = appEntries[key];
        const entry = existingEntry ?? createEntry(event);
        appEntries[key] = entry;
        const shouldEnforce = sessionIsActive && !overrideActive;

        logger.debug(
          'strict-policy',
          `app_block rule evaluated: executable=${entry.executable}, pid=${entry.pid}, sessionActive=${sessionIsActive}, overrideActive=${overrideActive}, result=${shouldEnforce ? 'action' : 'skip'}`
        );

        if (!existingEntry) {
          logger.info(
            'strict-policy',
            `app entry created: ${entry.executable}:${entry.pid}, reason=process_started`
          );
        }

        if (shouldEnforce) {
          actions.push(
            buildAppPromptNotification({
              scope: input.scope,
              executable: entry.executable,
              throttleSuffix: 'initial',
              throttleMs: 60_000,
              bodyPrefix: 'Focus mode warning:',
            })
          );
          auditEvents.push(
            toAuditEvent('app_prompt_started', event.timestamp, {
              executable: event.executable,
              pid: event.pid,
            })
          );
        }
      } else if (event.type === 'process_stopped' && appEntries[key]) {
        const clearedEntry = appEntries[key];
        delete appEntries[key];
        logger.info(
          'strict-policy',
          `app entry cleared: ${clearedEntry.executable}:${clearedEntry.pid}, reason=process_stopped`
        );
        auditEvents.push(
          toAuditEvent('app_entry_cleared', event.timestamp, {
            executable: event.executable,
            pid: event.pid,
            reason: 'process_stopped',
          })
        );
      }
    }
  }

  for (const event of input.websiteEvents) {
    const key = toWebsiteEntryKey(event.domain, event.sourceId);

    if (event.type === 'website_blocked_started') {
      const existingEntry = websiteEntries[key];
      const entry = existingEntry ?? createWebsiteEntry(event);
      websiteEntries[key] = entry;
      const shouldEnforce = sessionIsActive && !overrideActive;

      logger.debug(
        'strict-policy',
        `website rule evaluated: domain=${entry.domain}, sessionActive=${sessionIsActive}, result=${shouldEnforce ? 'action' : 'skip'}`
      );

      if (shouldEnforce) {
        actions.push(
          buildWebsitePromptNotification({
            scope: input.scope,
            domain: entry.domain,
            throttleSuffix: 'initial',
            throttleMs: 60_000,
            bodyPrefix: 'Focus mode warning:',
          })
        );
        auditEvents.push(
          toAuditEvent('website_prompt_started', event.timestamp, {
            domain: event.domain,
            sourceId: event.sourceId,
          })
        );
      }
      continue;
    }

    if (event.type === 'website_blocked_stopped' && websiteEntries[key]) {
      delete websiteEntries[key];
      auditEvents.push(
        toAuditEvent('website_entry_cleared', event.timestamp, {
          domain: event.domain,
          sourceId: event.sourceId,
          reason: 'signal_cleared',
        })
      );
    }
  }

  if (!sessionIsIdle) {
    for (const entry of Object.values(ideEntries)) {
      auditEvents.push(
        toAuditEvent('ide_entry_cleared', input.nowMs, {
          executable: entry.executable,
          pid: entry.pid,
          reason: 'session_active',
        })
      );
    }
    ideEntries = {};
  }

  if (!sessionIsActive) {
    for (const entry of Object.values(appEntries)) {
      logger.info(
        'strict-policy',
        `app entry cleared: ${entry.executable}:${entry.pid}, reason=session_inactive`
      );
      auditEvents.push(
        toAuditEvent('app_entry_cleared', input.nowMs, {
          executable: entry.executable,
          pid: entry.pid,
          reason: 'session_inactive',
        })
      );
    }
    appEntries = {};

    for (const entry of Object.values(websiteEntries)) {
      auditEvents.push(
        toAuditEvent('website_entry_cleared', input.nowMs, {
          domain: entry.domain,
          sourceId: entry.sourceId,
          reason: 'session_inactive',
        })
      );
    }
    websiteEntries = {};
  }

  if (!overrideActive) {
    if (sessionIsIdle) {
      for (const [key, entry] of Object.entries(ideEntries)) {
        const needsReminder =
          input.nowMs - entry.lastReminderAt >= reminderIntervalMs;
        if (needsReminder) {
          actions.push(
            buildIdePromptNotification({
              scope: input.scope,
              executable: entry.executable,
              throttleSuffix: `reminder-${entry.reminderCount + 1}`,
              throttleMs: Math.min(60_000, reminderIntervalMs),
              bodyPrefix: 'Reminder:',
            })
          );
          ideEntries[key] = {
            ...entry,
            lastReminderAt: input.nowMs,
            reminderCount: entry.reminderCount + 1,
          };
          auditEvents.push(
            toAuditEvent('ide_reminder_sent', input.nowMs, {
              executable: entry.executable,
              pid: entry.pid,
              reminderCount: entry.reminderCount + 1,
            })
          );
        }

        const closeEligible =
          input.settings.strictMode === 'prompt_then_close' &&
          !entry.closeIssued &&
          input.nowMs - entry.firstDetectedAt >= graceWindowMs;
        if (closeEligible) {
          actions.push({
            type: 'close_process',
            executable: entry.executable,
            pid: entry.pid,
            reason: 'ide_no_session',
          });
          ideEntries[key] = {
            ...entry,
            closeIssued: true,
          };
          auditEvents.push(
            toAuditEvent('ide_close_requested', input.nowMs, {
              executable: entry.executable,
              pid: entry.pid,
            })
          );
        }
      }
    }

    if (sessionIsActive) {
      for (const [key, entry] of Object.entries(appEntries)) {
        const needsReminder =
          input.nowMs - entry.lastReminderAt >= reminderIntervalMs;
        if (needsReminder) {
          actions.push(
            buildAppPromptNotification({
              scope: input.scope,
              executable: entry.executable,
              throttleSuffix: `reminder-${entry.reminderCount + 1}`,
              throttleMs: Math.min(60_000, reminderIntervalMs),
              bodyPrefix: 'Reminder:',
            })
          );
          appEntries[key] = {
            ...entry,
            lastReminderAt: input.nowMs,
            reminderCount: entry.reminderCount + 1,
          };
          auditEvents.push(
            toAuditEvent('app_reminder_sent', input.nowMs, {
              executable: entry.executable,
              pid: entry.pid,
              reminderCount: entry.reminderCount + 1,
            })
          );
        }

        const closeEligible =
          input.settings.appActionMode === 'warn_then_close' &&
          !entry.closeIssued &&
          input.nowMs - entry.firstDetectedAt >= graceWindowMs;
        if (closeEligible) {
          actions.push({
            type: 'close_process',
            executable: entry.executable,
            pid: entry.pid,
            reason: 'distractor_app',
          });
          appEntries[key] = {
            ...entry,
            closeIssued: true,
          };
          auditEvents.push(
            toAuditEvent('app_close_requested', input.nowMs, {
              executable: entry.executable,
              pid: entry.pid,
            })
          );
        }
      }

      for (const [key, entry] of Object.entries(websiteEntries)) {
        const needsReminder =
          input.nowMs - entry.lastReminderAt >= reminderIntervalMs;
        if (!needsReminder) {
          continue;
        }

        const reminderCount = entry.reminderCount + 1;
        const escalated =
          input.settings.websiteActionMode === 'escalate' && reminderCount >= 2;

        actions.push(
          buildWebsitePromptNotification({
            scope: input.scope,
            domain: entry.domain,
            throttleSuffix: `reminder-${reminderCount}`,
            throttleMs: Math.min(60_000, reminderIntervalMs),
            bodyPrefix: escalated ? 'Escalation:' : 'Reminder:',
          })
        );

        websiteEntries[key] = {
          ...entry,
          lastReminderAt: input.nowMs,
          reminderCount,
        };

        auditEvents.push(
          toAuditEvent('website_reminder_sent', input.nowMs, {
            domain: entry.domain,
            sourceId: entry.sourceId,
            reminderCount,
            escalated,
          })
        );

        if (escalated) {
          auditEvents.push(
            toAuditEvent('website_escalated', input.nowMs, {
              domain: entry.domain,
              sourceId: entry.sourceId,
              reminderCount,
            })
          );
        }
      }

      if (
        input.settings.websiteBlockList.length > 0 &&
        !input.websiteSignalAvailable
      ) {
        const shouldLogUnavailable =
          lastWebsiteSignalUnavailableAt === null ||
          input.nowMs - lastWebsiteSignalUnavailableAt >= reminderIntervalMs;

        if (shouldLogUnavailable) {
          lastWebsiteSignalUnavailableAt = input.nowMs;
          auditEvents.push(
            toAuditEvent('website_signal_unavailable', input.nowMs, {
              reason: 'no_reliable_url_signal',
            })
          );
        }
      } else if (input.websiteSignalAvailable) {
        lastWebsiteSignalUnavailableAt = null;
      }

      const remainingTaskCount = normalizeRemainingTaskCount(
        input.remainingTaskCount
      );
      if (remainingTaskCount !== null && remainingTaskCount > 0) {
        const shouldSendReminder =
          taskReminder.lastReminderAt === null ||
          input.nowMs - taskReminder.lastReminderAt >= reminderIntervalMs;

        if (shouldSendReminder) {
          const reminderCount = taskReminder.reminderCount + 1;
          const escalated = reminderCount >= 3;
          actions.push(
            buildTasksReminderNotification({
              scope: input.scope,
              remainingTaskCount,
              reminderCount,
              throttleMs: Math.min(60_000, reminderIntervalMs),
              escalated,
            })
          );

          taskReminder = {
            lastReminderAt: input.nowMs,
            reminderCount,
            lastKnownRemainingTaskCount: remainingTaskCount,
          };

          auditEvents.push(
            toAuditEvent('tasks_reminder_sent', input.nowMs, {
              remainingTaskCount,
              reminderCount,
              escalated,
            })
          );

          if (escalated) {
            auditEvents.push(
              toAuditEvent('tasks_escalation_sent', input.nowMs, {
                remainingTaskCount,
                reminderCount,
              })
            );
          }
        }
      } else if (
        taskReminder.reminderCount > 0 ||
        taskReminder.lastKnownRemainingTaskCount > 0
      ) {
        taskReminder = createTaskReminderState();
        auditEvents.push(
          toAuditEvent('tasks_reminder_cleared', input.nowMs, {
            reason:
              remainingTaskCount === 0
                ? 'no_remaining_tasks'
                : 'count_unavailable',
          })
        );
      }
    }
  }

  if (overrideActive || !sessionIsActive) {
    if (
      taskReminder.reminderCount > 0 ||
      taskReminder.lastKnownRemainingTaskCount > 0
    ) {
      taskReminder = createTaskReminderState();
      auditEvents.push(
        toAuditEvent('tasks_reminder_cleared', input.nowMs, {
          reason: overrideActive ? 'override_active' : 'session_inactive',
        })
      );
    }
  }

  let filteredActions = actions;
  const projectedActionTimestamps = [
    ...recentActionTimestamps,
    ...actions.map(() => input.nowMs),
  ];
  const projectedActionCount = projectedActionTimestamps.length;

  if (!failSafeActive && projectedActionCount > FAIL_SAFE_ACTION_THRESHOLD) {
    failSafeActive = true;
    auditEvents.push(
      toAuditEvent('fail_safe_engaged', input.nowMs, {
        projectedActionCount,
      })
    );
  }

  if (failSafeActive) {
    const hadCloseActions = filteredActions.some(
      action => action.type === 'close_process'
    );
    filteredActions = filteredActions.filter(
      action => action.type !== 'close_process'
    );

    if (
      failSafeWasActive &&
      !hadCloseActions &&
      recentActionTimestamps.length <= FAIL_SAFE_RECOVERY_THRESHOLD
    ) {
      failSafeActive = false;
      auditEvents.push(
        toAuditEvent('fail_safe_recovered', input.nowMs, {
          recentActionCount: recentActionTimestamps.length,
        })
      );
    }
  }

  recentActionTimestamps = pruneRecentActionTimestamps(
    [...recentActionTimestamps, ...filteredActions.map(() => input.nowMs)],
    input.nowMs
  );

  return {
    nextState: {
      ...state,
      ideEntries,
      appEntries,
      websiteEntries,
      taskReminder,
      lastWebsiteSignalUnavailableAt,
      recentActionTimestamps,
      failSafeActive,
    },
    actions: filteredActions,
    auditEvents,
  };
}
