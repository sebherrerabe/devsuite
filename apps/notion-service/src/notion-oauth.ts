const NOTION_OAUTH_AUTHORIZE_ENDPOINT =
  'https://api.notion.com/v1/oauth/authorize';
const NOTION_OAUTH_TOKEN_ENDPOINT = 'https://api.notion.com/v1/oauth/token';
const NOTION_OAUTH_INTROSPECT_ENDPOINT =
  'https://api.notion.com/v1/oauth/introspect';
const NOTION_OAUTH_REVOKE_ENDPOINT = 'https://api.notion.com/v1/oauth/revoke';
export const NOTION_API_VERSION = '2025-09-03';

export interface NotionOAuthAuthorizeOptions {
  clientId: string;
  redirectUri: string;
  state: string;
}

export interface NotionOAuthTokenResult {
  accessToken: string;
  tokenType: string | null;
  workspaceId: string;
  workspaceName: string | null;
  workspaceIcon: string | null;
  botId: string | null;
  ownerType: string | null;
  refreshToken: string | null;
}

export interface NotionOAuthIntrospectionResult {
  active: boolean;
  workspaceId: string | null;
  ownerType: string | null;
}

export class NotionOAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

function buildBasicAuthHeader(clientId: string, clientSecret: string): string {
  const raw = `${clientId}:${clientSecret}`;
  return `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`;
}

function buildNotionBaseHeaders(
  clientId: string,
  clientSecret: string
): Record<string, string> {
  return {
    authorization: buildBasicAuthHeader(clientId, clientSecret),
    'content-type': 'application/json; charset=utf-8',
    'notion-version': NOTION_API_VERSION,
  };
}

function readString(
  value: unknown,
  field: string,
  required = false
): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed && required) {
      throw new NotionOAuthError(
        'INVALID_RESPONSE',
        `Notion OAuth payload field "${field}" is empty`,
        502
      );
    }
    return trimmed || null;
  }

  if (required) {
    throw new NotionOAuthError(
      'INVALID_RESPONSE',
      `Notion OAuth payload field "${field}" is missing`,
      502
    );
  }

  return null;
}

function parseOAuthErrorPayload(
  value: unknown
): { code: string; message: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as {
    error?: unknown;
    message?: unknown;
  };

  if (typeof payload.error !== 'string') {
    return null;
  }

  return {
    code: payload.error,
    message:
      typeof payload.message === 'string'
        ? payload.message
        : 'Notion OAuth request failed',
  };
}

function parseTokenPayload(
  payload: unknown,
  defaultErrorStatusCode: number
): NotionOAuthTokenResult {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new NotionOAuthError(
      'INVALID_RESPONSE',
      'Notion OAuth token response has invalid shape',
      defaultErrorStatusCode
    );
  }

  const body = payload as {
    access_token?: unknown;
    token_type?: unknown;
    workspace_id?: unknown;
    workspace_name?: unknown;
    workspace_icon?: unknown;
    bot_id?: unknown;
    owner?: unknown;
    refresh_token?: unknown;
  };

  const accessToken = readString(body.access_token, 'access_token', true);
  const workspaceId = readString(body.workspace_id, 'workspace_id', true);
  const ownerType =
    body.owner && typeof body.owner === 'object' && !Array.isArray(body.owner)
      ? readString((body.owner as { type?: unknown }).type, 'owner.type')
      : null;

  if (!accessToken || !workspaceId) {
    throw new NotionOAuthError(
      'INVALID_RESPONSE',
      'Notion OAuth response is missing required fields',
      defaultErrorStatusCode
    );
  }

  return {
    accessToken,
    tokenType: readString(body.token_type, 'token_type'),
    workspaceId,
    workspaceName: readString(body.workspace_name, 'workspace_name'),
    workspaceIcon: readString(body.workspace_icon, 'workspace_icon'),
    botId: readString(body.bot_id, 'bot_id'),
    ownerType,
    refreshToken: readString(body.refresh_token, 'refresh_token'),
  };
}

export function createNotionAuthorizeUrl(
  options: NotionOAuthAuthorizeOptions
): string {
  const url = new globalThis.URL(NOTION_OAUTH_AUTHORIZE_ENDPOINT);
  url.searchParams.set('owner', 'user');
  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', options.state);
  return url.toString();
}

export async function exchangeNotionAuthorizationCode(options: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<NotionOAuthTokenResult> {
  const response = await globalThis.fetch(NOTION_OAUTH_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: buildNotionBaseHeaders(options.clientId, options.clientSecret),
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: options.code,
      redirect_uri: options.redirectUri,
    }),
  });

  let payload: unknown = null;
  const text = await response.text();
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new NotionOAuthError(
        'INVALID_RESPONSE',
        'Notion OAuth returned invalid JSON',
        response.status || 502
      );
    }
  }

  if (!response.ok) {
    const parsedError = parseOAuthErrorPayload(payload);
    throw new NotionOAuthError(
      parsedError?.code ?? 'OAUTH_FAILED',
      parsedError?.message ?? 'Notion OAuth token exchange failed',
      response.status
    );
  }

  return parseTokenPayload(payload, 502);
}

export async function refreshNotionAccessToken(options: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<NotionOAuthTokenResult> {
  const response = await globalThis.fetch(NOTION_OAUTH_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: buildNotionBaseHeaders(options.clientId, options.clientSecret),
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: options.refreshToken,
    }),
  });

  let payload: unknown = null;
  const text = await response.text();
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new NotionOAuthError(
        'INVALID_RESPONSE',
        'Notion OAuth refresh returned invalid JSON',
        response.status || 502
      );
    }
  }

  if (!response.ok) {
    const parsedError = parseOAuthErrorPayload(payload);
    throw new NotionOAuthError(
      parsedError?.code ?? 'OAUTH_REFRESH_FAILED',
      parsedError?.message ?? 'Notion OAuth token refresh failed',
      response.status
    );
  }

  return parseTokenPayload(payload, 502);
}

export async function introspectNotionToken(options: {
  clientId: string;
  clientSecret: string;
  token: string;
}): Promise<NotionOAuthIntrospectionResult> {
  const response = await globalThis.fetch(NOTION_OAUTH_INTROSPECT_ENDPOINT, {
    method: 'POST',
    headers: buildNotionBaseHeaders(options.clientId, options.clientSecret),
    body: JSON.stringify({
      token: options.token,
    }),
  });

  let payload: unknown = null;
  const text = await response.text();
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new NotionOAuthError(
        'INVALID_RESPONSE',
        'Notion OAuth introspect returned invalid JSON',
        response.status || 502
      );
    }
  }

  if (!response.ok) {
    const parsedError = parseOAuthErrorPayload(payload);
    throw new NotionOAuthError(
      parsedError?.code ?? 'OAUTH_INTROSPECT_FAILED',
      parsedError?.message ?? 'Notion OAuth token introspection failed',
      response.status
    );
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new NotionOAuthError(
      'INVALID_RESPONSE',
      'Notion OAuth introspection response has invalid shape',
      502
    );
  }

  const body = payload as {
    active?: unknown;
    workspace_id?: unknown;
    owner?: unknown;
  };

  if (typeof body.active !== 'boolean') {
    throw new NotionOAuthError(
      'INVALID_RESPONSE',
      'Notion OAuth introspection response is missing "active"',
      502
    );
  }

  const ownerType =
    body.owner && typeof body.owner === 'object' && !Array.isArray(body.owner)
      ? readString((body.owner as { type?: unknown }).type, 'owner.type')
      : null;

  return {
    active: body.active,
    workspaceId: readString(body.workspace_id, 'workspace_id'),
    ownerType,
  };
}

export async function revokeNotionToken(options: {
  clientId: string;
  clientSecret: string;
  token: string;
}): Promise<void> {
  if (!options.token.trim()) {
    return;
  }

  const response = await globalThis.fetch(NOTION_OAUTH_REVOKE_ENDPOINT, {
    method: 'POST',
    headers: buildNotionBaseHeaders(options.clientId, options.clientSecret),
    body: JSON.stringify({ token: options.token }),
  });

  if (response.ok) {
    return;
  }

  let payload: unknown = null;
  const text = await response.text();
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new NotionOAuthError(
        'INVALID_RESPONSE',
        'Notion revoke response is not valid JSON',
        response.status
      );
    }
  }

  const parsed = parseOAuthErrorPayload(payload);
  throw new NotionOAuthError(
    parsed?.code ?? 'REVOKE_FAILED',
    parsed?.message ?? 'Notion token revoke failed',
    response.status
  );
}
