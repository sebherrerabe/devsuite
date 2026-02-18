import {
  parseDesktopSettingsScope,
  type DesktopSettingsScope,
} from './focus-settings.js';

export type DesktopSessionAction = 'start' | 'pause' | 'resume' | 'end';
export type DesktopSessionEndDecision =
  | 'keep_ongoing'
  | 'mark_all_done'
  | 'cancel';
export type DesktopSessionStatus = 'IDLE' | 'RUNNING' | 'PAUSED';
export type DesktopSessionConnectionState = 'connected' | 'syncing' | 'error';

export interface DesktopSessionState {
  status: DesktopSessionStatus;
  sessionId: string | null;
  effectiveDurationMs: number;
  remainingTaskCount: number | null;
  connectionState: DesktopSessionConnectionState;
  lastError: string | null;
  updatedAt: number;
  publishedAt?: number;
}

export interface DesktopSessionActionAvailability {
  start: boolean;
  pause: boolean;
  resume: boolean;
  end: boolean;
}

export interface DesktopSessionCommand {
  scope: DesktopSettingsScope;
  action: DesktopSessionAction;
  endDecision?: DesktopSessionEndDecision;
  requestedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSessionStatus(value: unknown): DesktopSessionStatus {
  if (value === 'IDLE' || value === 'RUNNING' || value === 'PAUSED') {
    return value;
  }

  throw new Error('session status must be one of: IDLE, RUNNING, PAUSED.');
}

function parseConnectionState(value: unknown): DesktopSessionConnectionState {
  if (value === 'connected' || value === 'syncing' || value === 'error') {
    return value;
  }

  throw new Error('connectionState must be one of: connected, syncing, error.');
}

function parseSessionId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error('sessionId must be a string or null.');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
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

function parseOptionalTimestamp(
  value: unknown,
  fieldName: string
): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return parseTimestamp(value, fieldName);
}

function parseNonNegativeInteger(value: unknown, fieldName: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  const numericValue = value as number;
  if (numericValue < 0) {
    throw new Error(`${fieldName} must be greater than or equal to 0.`);
  }

  return numericValue;
}

function parseOptionalError(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error('lastError must be a string or null.');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

export function parseDesktopSessionAction(
  value: unknown
): DesktopSessionAction {
  if (
    value === 'start' ||
    value === 'pause' ||
    value === 'resume' ||
    value === 'end'
  ) {
    return value;
  }

  throw new Error('session action must be one of: start, pause, resume, end.');
}

export function parseDesktopSessionEndDecision(
  value: unknown
): DesktopSessionEndDecision | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    value === 'keep_ongoing' ||
    value === 'mark_all_done' ||
    value === 'cancel'
  ) {
    return value;
  }

  throw new Error(
    'endDecision must be one of: keep_ongoing, mark_all_done, cancel.'
  );
}

export function createDefaultDesktopSessionState(): DesktopSessionState {
  const now = Date.now();
  return {
    status: 'IDLE',
    sessionId: null,
    effectiveDurationMs: 0,
    remainingTaskCount: null,
    connectionState: 'syncing',
    lastError: null,
    updatedAt: now,
    publishedAt: now,
  };
}

export function parseDesktopSessionState(input: unknown): DesktopSessionState {
  if (!isRecord(input)) {
    throw new Error('Desktop session state payload must be an object.');
  }

  const updatedAt = parseTimestamp(input.updatedAt, 'updatedAt');
  const publishedAt =
    parseOptionalTimestamp(input.publishedAt, 'publishedAt') ?? updatedAt;

  return {
    status: parseSessionStatus(input.status),
    sessionId: parseSessionId(input.sessionId),
    effectiveDurationMs: parseNonNegativeInteger(
      input.effectiveDurationMs,
      'effectiveDurationMs'
    ),
    remainingTaskCount:
      input.remainingTaskCount === undefined ||
      input.remainingTaskCount === null
        ? null
        : parseNonNegativeInteger(
            input.remainingTaskCount,
            'remainingTaskCount'
          ),
    connectionState: parseConnectionState(input.connectionState),
    lastError: parseOptionalError(input.lastError),
    updatedAt,
    publishedAt,
  };
}

export function parseDesktopSessionCommand(
  input: unknown
): DesktopSessionCommand {
  if (!isRecord(input)) {
    throw new Error('Desktop session command payload must be an object.');
  }

  const endDecision = parseDesktopSessionEndDecision(input.endDecision);

  return {
    scope: parseDesktopSettingsScope(input.scope),
    action: parseDesktopSessionAction(input.action),
    ...(endDecision ? { endDecision } : {}),
    requestedAt: parseTimestamp(input.requestedAt, 'requestedAt'),
  };
}

export function getDesktopSessionActionAvailability(
  state: DesktopSessionState
): DesktopSessionActionAvailability {
  switch (state.status) {
    case 'IDLE':
      return {
        start: true,
        pause: false,
        resume: false,
        end: false,
      };
    case 'RUNNING':
      return {
        start: false,
        pause: true,
        resume: false,
        end: true,
      };
    case 'PAUSED':
      return {
        start: false,
        pause: false,
        resume: true,
        end: true,
      };
  }
}
