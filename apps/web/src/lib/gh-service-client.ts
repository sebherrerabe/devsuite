const DEFAULT_GH_SERVICE_URL = 'http://localhost:8790';

export type GhConnectionState =
  | 'disconnected'
  | 'pending'
  | 'connected'
  | 'error';

export interface GhConnectionStatus {
  state: GhConnectionState;
  githubUser: string | null;
  userCode: string | null;
  verificationUri: string | null;
  lastError: string | null;
  checkedAt: number;
}

export interface GhRuntimeSnapshot {
  ghInstalled: boolean;
  ghVersion: string | null;
  error: string | null;
}

interface GhErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
}

interface GhConnectionEnvelope {
  requestId: string;
  userId: string;
  connection: GhConnectionStatus;
}

export interface GhStatusEnvelope extends GhConnectionEnvelope {
  runtime: GhRuntimeSnapshot;
}

export interface GhNotificationSyncResult {
  githubUser: string | null;
  status: 'success' | 'skipped_no_routes' | 'error';
  companiesMatched: number;
  hasRouteMappings: boolean;
  notificationsFetched: number;
  notificationsFiltered: number;
  notificationsReceived: number;
  notificationsRouted: number;
  notificationsUnmatched: number;
  deliveriesCreated: number;
  deliveriesUpdated: number;
  attemptedAt: number;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface GhNotificationSyncEnvelope {
  requestId: string;
  userId: string;
  sync: GhNotificationSyncResult;
}

export class GhServiceRequestError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null
  ) {
    super(message);
  }
}

export function getGhServiceBaseUrl(): string {
  const configured = import.meta.env.VITE_GH_SERVICE_URL?.trim();
  return configured || DEFAULT_GH_SERVICE_URL;
}

function parseJson(text: string): unknown {
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

async function request<TResponse>(
  path: string,
  params: {
    userId: string;
    method: 'GET' | 'POST';
    body?: Record<string, unknown>;
  }
): Promise<TResponse> {
  const url = new URL(path, getGhServiceBaseUrl()).toString();
  const response = await fetch(url, {
    method: params.method,
    headers: {
      'x-devsuite-user-id': params.userId,
      ...(params.body
        ? { 'content-type': 'application/json; charset=utf-8' }
        : {}),
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
  });

  const responseText = await response.text();
  const parsed = parseJson(responseText);

  if (!response.ok) {
    const envelope = parsed as GhErrorEnvelope;
    const message = envelope.error?.message ?? 'GitHub service request failed';
    const code = envelope.error?.code ?? 'REQUEST_FAILED';
    const requestId = envelope.error?.requestId ?? null;
    throw new GhServiceRequestError(response.status, code, message, requestId);
  }

  return parsed as TResponse;
}

export async function startGithubLogin(
  userId: string
): Promise<GhConnectionEnvelope> {
  return request<GhConnectionEnvelope>('/github/connect/start', {
    userId,
    method: 'POST',
    body: {},
  });
}

export async function getGithubConnectionStatus(
  userId: string
): Promise<GhStatusEnvelope> {
  return request<GhStatusEnvelope>('/github/connect/status', {
    userId,
    method: 'GET',
  });
}

export async function disconnectGithub(
  userId: string
): Promise<GhConnectionEnvelope> {
  return request<GhConnectionEnvelope>('/github/disconnect', {
    userId,
    method: 'POST',
    body: {},
  });
}

export async function syncGithubNotifications(
  userId: string,
  options?: { limit?: number }
): Promise<GhNotificationSyncEnvelope> {
  return request<GhNotificationSyncEnvelope>('/github/notifications/sync', {
    userId,
    method: 'POST',
    body: options?.limit ? { limit: options.limit } : {},
  });
}
