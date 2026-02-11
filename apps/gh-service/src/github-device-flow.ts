const DEVICE_CODE_ENDPOINT = 'https://github.com/login/device/code';
const DEVICE_TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token';
const DEVICE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

interface DeviceFlowApiResponse {
  [key: string]: unknown;
}

interface PostFormResult {
  statusCode: number;
  body: DeviceFlowApiResponse;
}

export interface StartedDeviceFlow {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  pollIntervalSeconds: number;
  nextPollAt: number;
}

export type PollDeviceFlowResult =
  | {
      status: 'authorized';
      accessToken: string;
    }
  | {
      status: 'pending';
      pollIntervalSeconds: number;
      nextPollAt: number;
    }
  | {
      status: 'slow_down';
      pollIntervalSeconds: number;
      nextPollAt: number;
    }
  | {
      status: 'error';
      code: string;
      message: string;
    };

interface StartDeviceFlowParams {
  clientId: string;
  scopes: string[];
}

interface PollDeviceFlowParams {
  clientId: string;
  deviceCode: string;
  currentPollIntervalSeconds: number;
}

function sanitizeScopeList(scopes: string[]): string {
  return scopes
    .map(scope => scope.trim())
    .filter(Boolean)
    .join(' ');
}

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return null;
}

function parseErrorMessage(body: DeviceFlowApiResponse): string | null {
  const description =
    typeof body.error_description === 'string'
      ? body.error_description.trim()
      : null;
  if (description) {
    return description;
  }

  const code = typeof body.error === 'string' ? body.error.trim() : null;
  if (code) {
    return code;
  }

  return null;
}

async function postForm(
  url: string,
  payload: Record<string, string>
): Promise<PostFormResult> {
  const form = new globalThis.URLSearchParams(payload);

  let response: globalThis.Response;
  try {
    response = await globalThis.fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'devsuite-gh-service',
      },
      body: form.toString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Network request failed';
    throw new Error(`GitHub OAuth request failed: ${message}`);
  }

  let body: unknown = null;
  const text = await response.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      throw new Error(
        `GitHub OAuth returned invalid JSON (${response.status})`
      );
    }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(
      `GitHub OAuth returned invalid payload (${response.status})`
    );
  }

  return {
    statusCode: response.status,
    body: body as DeviceFlowApiResponse,
  };
}

export async function startDeviceFlow(
  params: StartDeviceFlowParams
): Promise<StartedDeviceFlow> {
  const scope = sanitizeScopeList(params.scopes);
  const payload = {
    client_id: params.clientId,
    scope,
  };
  const result = await postForm(DEVICE_CODE_ENDPOINT, payload);

  if (result.statusCode < 200 || result.statusCode >= 300) {
    const message =
      parseErrorMessage(result.body) ?? 'GitHub device code request failed';
    throw new Error(message);
  }

  if (typeof result.body.error === 'string') {
    const message =
      parseErrorMessage(result.body) ?? 'GitHub device code request failed';
    throw new Error(message);
  }

  const deviceCode =
    typeof result.body.device_code === 'string'
      ? result.body.device_code.trim()
      : '';
  const userCode =
    typeof result.body.user_code === 'string'
      ? result.body.user_code.trim()
      : '';
  const verificationUri =
    typeof result.body.verification_uri === 'string'
      ? result.body.verification_uri.trim()
      : '';
  const expiresInSeconds = parsePositiveInteger(result.body.expires_in);
  const intervalSeconds = parsePositiveInteger(result.body.interval) ?? 5;

  if (!deviceCode || !userCode || !verificationUri || !expiresInSeconds) {
    throw new Error('GitHub device code response is incomplete');
  }

  const now = Date.now();
  const pollIntervalSeconds = Math.max(5, intervalSeconds);

  return {
    deviceCode,
    userCode,
    verificationUri,
    expiresAt: now + expiresInSeconds * 1000,
    pollIntervalSeconds,
    nextPollAt: now + pollIntervalSeconds * 1000,
  };
}

export async function pollDeviceFlow(
  params: PollDeviceFlowParams
): Promise<PollDeviceFlowResult> {
  const payload = {
    client_id: params.clientId,
    device_code: params.deviceCode,
    grant_type: DEVICE_GRANT_TYPE,
  };
  const result = await postForm(DEVICE_TOKEN_ENDPOINT, payload);

  const now = Date.now();
  const responseInterval = parsePositiveInteger(result.body.interval);
  const currentInterval = Math.max(5, params.currentPollIntervalSeconds);

  if (result.statusCode < 200 || result.statusCode >= 300) {
    const message =
      parseErrorMessage(result.body) ?? 'GitHub token exchange failed';
    return {
      status: 'error',
      code: 'http_error',
      message,
    };
  }

  const accessToken =
    typeof result.body.access_token === 'string'
      ? result.body.access_token.trim()
      : null;
  if (accessToken) {
    return {
      status: 'authorized',
      accessToken,
    };
  }

  const errorCode =
    typeof result.body.error === 'string'
      ? result.body.error.trim()
      : 'unknown';
  const errorMessage =
    parseErrorMessage(result.body) ?? 'GitHub token exchange failed';

  if (errorCode === 'authorization_pending') {
    const pollIntervalSeconds = Math.max(
      5,
      responseInterval ?? currentInterval
    );
    return {
      status: 'pending',
      pollIntervalSeconds,
      nextPollAt: now + pollIntervalSeconds * 1000,
    };
  }

  if (errorCode === 'slow_down') {
    const pollIntervalSeconds = Math.max(
      10,
      responseInterval ?? currentInterval + 5
    );
    return {
      status: 'slow_down',
      pollIntervalSeconds,
      nextPollAt: now + pollIntervalSeconds * 1000,
    };
  }

  return {
    status: 'error',
    code: errorCode || 'unknown',
    message: errorMessage,
  };
}
