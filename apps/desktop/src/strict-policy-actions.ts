import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { DesktopSettingsScope } from './focus-settings.js';
import { runtimeLog, type RuntimeLogWriter } from './runtime-logger.js';
import type { StrictPolicyAction } from './strict-policy-engine.js';

const execFileAsync = promisify(execFile);

interface TaskkillError {
  code?: string | number;
  message?: string;
}

export interface ExecuteStrictPolicyActionsDependencies {
  emitNotification: (payload: {
    scope: DesktopSettingsScope;
    kind: Exclude<StrictPolicyAction, { type: 'close_process' }>['kind'];
    title: string;
    body: string;
    action: 'open_app' | 'open_sessions' | 'start_session';
    route: '/sessions' | '/';
    throttleKey: string;
    throttleMs: number;
  }) => Promise<unknown>;
  showSessionWidget: () => Promise<void>;
  logger?: RuntimeLogWriter;
  platform?: string;
  taskkill?: (
    action: Extract<StrictPolicyAction, { type: 'close_process' }>
  ) => Promise<{ exitCode: number }>;
}

async function runTaskkill(
  action: Extract<StrictPolicyAction, { type: 'close_process' }>
): Promise<{ exitCode: number }> {
  await execFileAsync('taskkill', ['/PID', `${action.pid}`, '/F', '/T'], {
    windowsHide: true,
    timeout: 8_000,
    maxBuffer: 1024 * 1024,
  });

  return {
    exitCode: 0,
  };
}

function normalizeTaskkillError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (error && typeof error === 'object') {
    const maybeCode = (error as TaskkillError).code;
    const maybeMessage = (error as TaskkillError).message;
    if (typeof maybeCode !== 'undefined' && typeof maybeMessage === 'string') {
      return `${maybeMessage} (code=${maybeCode})`;
    }
  }

  return 'Unknown taskkill error';
}

export async function executeStrictPolicyActions(params: {
  scope: DesktopSettingsScope;
  actions: StrictPolicyAction[];
  dependencies: ExecuteStrictPolicyActionsDependencies;
}): Promise<void> {
  const logger = params.dependencies.logger ?? runtimeLog;
  const platform = params.dependencies.platform ?? process.platform;
  const taskkill = params.dependencies.taskkill ?? runTaskkill;

  const dedupedActions: StrictPolicyAction[] = [];
  const seenNotificationThrottleKeys = new Set<string>();
  const seenCloseProcessKeys = new Set<string>();

  for (const action of params.actions) {
    if (action.type === 'notify') {
      if (seenNotificationThrottleKeys.has(action.throttleKey)) {
        continue;
      }
      seenNotificationThrottleKeys.add(action.throttleKey);
      dedupedActions.push(action);
      continue;
    }

    const closeKey = `${action.executable}:${action.pid}:${action.reason}`;
    if (seenCloseProcessKeys.has(closeKey)) {
      continue;
    }
    seenCloseProcessKeys.add(closeKey);
    dedupedActions.push(action);
  }

  for (const action of dedupedActions) {
    if (action.type === 'notify') {
      logger.debug(
        'strict-policy',
        `Sending notification: kind=${action.kind}, throttleKey=${action.throttleKey}`
      );

      await params.dependencies.emitNotification({
        scope: params.scope,
        kind: action.kind,
        title: action.title,
        body: action.body,
        action: action.action,
        route: action.route,
        throttleKey: action.throttleKey,
        throttleMs: action.throttleMs,
      });

      if (action.kind === 'ide_session_required') {
        await params.dependencies.showSessionWidget();
      }

      continue;
    }

    if (action.type === 'close_process' && platform === 'win32') {
      logger.warn(
        'strict-policy',
        `Issuing taskkill: PID=${action.pid}, exe=${action.executable}, reason=${action.reason}`
      );

      try {
        const result = await taskkill(action);
        logger.info(
          'strict-policy',
          `taskkill result: PID=${action.pid}, exitCode=${result.exitCode}`
        );
      } catch (error) {
        logger.error(
          'strict-policy',
          `taskkill failed: PID=${action.pid}, error=${normalizeTaskkillError(error)}`
        );
      }
    }
  }
}
