import {
  parseDesktopSettingsScope,
  type DesktopSettingsScope,
} from './focus-settings.js';

export type DesktopNotificationKind =
  | 'session_started'
  | 'session_paused'
  | 'session_resumed'
  | 'session_ended'
  | 'ide_session_required'
  | 'distractor_app_detected'
  | 'website_blocked_detected'
  | 'tasks_remaining_reminder';

export type DesktopNotificationAction =
  | 'open_app'
  | 'open_sessions'
  | 'start_session';

export interface DesktopNotificationRequest {
  scope: DesktopSettingsScope;
  kind: DesktopNotificationKind;
  title: string;
  body: string;
  action: DesktopNotificationAction;
  route: string | null;
  throttleKey: string;
  throttleMs: number;
}

export interface DesktopNotificationActionEvent {
  scope: DesktopSettingsScope;
  action: DesktopNotificationAction;
  route: string | null;
  requestedAt: number;
}

const DEFAULT_THROTTLE_MS = 30_000;
const MIN_THROTTLE_MS = 0;
const MAX_THROTTLE_MS = 10 * 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseNotificationKind(value: unknown): DesktopNotificationKind {
  if (
    value === 'session_started' ||
    value === 'session_paused' ||
    value === 'session_resumed' ||
    value === 'session_ended' ||
    value === 'ide_session_required' ||
    value === 'distractor_app_detected' ||
    value === 'website_blocked_detected' ||
    value === 'tasks_remaining_reminder'
  ) {
    return value;
  }

  throw new Error('notification kind is invalid.');
}

function parseNotificationAction(value: unknown): DesktopNotificationAction {
  if (
    value === 'open_app' ||
    value === 'open_sessions' ||
    value === 'start_session'
  ) {
    return value;
  }

  throw new Error('notification action is invalid.');
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

function parseOptionalRoute(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const route = parseNonEmptyString(value, 'route');
  if (!route.startsWith('/')) {
    throw new Error('route must start with "/".');
  }

  return route;
}

function parseThrottleMs(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_THROTTLE_MS;
  }

  if (!Number.isInteger(value)) {
    throw new Error('throttleMs must be an integer.');
  }

  const numericValue = value as number;
  if (numericValue < MIN_THROTTLE_MS || numericValue > MAX_THROTTLE_MS) {
    throw new Error(
      `throttleMs must be between ${MIN_THROTTLE_MS} and ${MAX_THROTTLE_MS}.`
    );
  }

  return numericValue;
}

function parseThrottleKey(value: unknown, fallbackKey: string): string {
  if (value === undefined) {
    return fallbackKey;
  }

  return parseNonEmptyString(value, 'throttleKey');
}

function parseTimestamp(value: unknown, fieldName: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  const numericValue = value as number;
  if (numericValue <= 0) {
    throw new Error(`${fieldName} must be greater than 0.`);
  }

  return numericValue;
}

export function parseDesktopNotificationRequest(
  input: unknown
): DesktopNotificationRequest {
  if (!isRecord(input)) {
    throw new Error('Desktop notification payload must be an object.');
  }

  const scope = parseDesktopSettingsScope(input.scope);
  const kind = parseNotificationKind(input.kind);
  const title = parseNonEmptyString(input.title, 'title');
  const body = parseNonEmptyString(input.body, 'body');
  const action = parseNotificationAction(input.action);
  const route = parseOptionalRoute(input.route);
  const defaultThrottleKey = `${scope.userId}:${scope.companyId}:${kind}:${action}`;
  const throttleKey = parseThrottleKey(input.throttleKey, defaultThrottleKey);
  const throttleMs = parseThrottleMs(input.throttleMs);

  return {
    scope,
    kind,
    title,
    body,
    action,
    route,
    throttleKey,
    throttleMs,
  };
}

export function parseDesktopNotificationActionEvent(
  input: unknown
): DesktopNotificationActionEvent {
  if (!isRecord(input)) {
    throw new Error('Desktop notification action payload must be an object.');
  }

  return {
    scope: parseDesktopSettingsScope(input.scope),
    action: parseNotificationAction(input.action),
    route: parseOptionalRoute(input.route),
    requestedAt: parseTimestamp(input.requestedAt, 'requestedAt'),
  };
}

export function shouldThrottleDesktopNotification(
  lastSentAt: number | null,
  throttleMs: number,
  nowMs: number
): boolean {
  if (lastSentAt === null) {
    return false;
  }

  const elapsedMs = nowMs - lastSentAt;
  return elapsedMs < throttleMs;
}
