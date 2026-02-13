const DEFAULT_NOTION_SERVICE_URL = 'http://localhost:8791';

export type NotionConnectionState =
  | 'disconnected'
  | 'pending'
  | 'connected'
  | 'error';

export interface NotionConnectionStatus {
  state: NotionConnectionState;
  companyId: string;
  workspaceId: string | null;
  workspaceName: string | null;
  workspaceIcon: string | null;
  verificationUri: string | null;
  lastError: string | null;
  checkedAt: number;
}

interface NotionErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
}

export interface NotionConnectionEnvelope {
  requestId: string;
  userId: string;
  companyId: string;
  connection: NotionConnectionStatus;
}

export interface NotionResolvedLink {
  identifier: string;
  entityType: 'page' | 'database';
  title: string;
  url: string;
}

export interface NotionLinkResolveEnvelope {
  requestId: string;
  userId: string;
  companyId: string;
  link: NotionResolvedLink;
}

export class NotionServiceRequestError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null
  ) {
    super(message);
  }
}

export function getNotionServiceBaseUrl(): string {
  const configured = import.meta.env.VITE_NOTION_SERVICE_URL?.trim();
  return configured || DEFAULT_NOTION_SERVICE_URL;
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
  const url = new URL(path, getNotionServiceBaseUrl()).toString();
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
    const envelope = parsed as NotionErrorEnvelope;
    const message = envelope.error?.message ?? 'Notion service request failed';
    const code = envelope.error?.code ?? 'REQUEST_FAILED';
    const requestId = envelope.error?.requestId ?? null;
    throw new NotionServiceRequestError(
      response.status,
      code,
      message,
      requestId
    );
  }

  return parsed as TResponse;
}

export async function startNotionLogin(
  userId: string,
  companyId: string
): Promise<NotionConnectionEnvelope> {
  return request<NotionConnectionEnvelope>('/notion/connect/start', {
    userId,
    method: 'POST',
    body: { companyId },
  });
}

export async function getNotionConnectionStatus(
  userId: string,
  companyId: string
): Promise<NotionConnectionEnvelope> {
  const path = `/notion/connect/status?companyId=${encodeURIComponent(companyId)}`;
  return request<NotionConnectionEnvelope>(path, {
    userId,
    method: 'GET',
  });
}

export async function disconnectNotion(
  userId: string,
  companyId: string
): Promise<NotionConnectionEnvelope> {
  return request<NotionConnectionEnvelope>('/notion/disconnect', {
    userId,
    method: 'POST',
    body: { companyId },
  });
}

export async function resolveNotionLink(
  userId: string,
  companyId: string,
  url: string
): Promise<NotionLinkResolveEnvelope> {
  return request<NotionLinkResolveEnvelope>('/notion/links/resolve', {
    userId,
    method: 'POST',
    body: {
      companyId,
      url,
    },
  });
}
