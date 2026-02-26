import type { IncomingMessage } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NotionServiceConfig } from './config.js';
import type { AuthContext } from './types.js';

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function readHeaderValue(
  headerValue: string | string[] | undefined
): string | null {
  if (Array.isArray(headerValue)) {
    return headerValue[0] ?? null;
  }
  return headerValue ?? null;
}

function parseBearerToken(req: IncomingMessage): string | null {
  const authorization = readHeaderValue(req.headers.authorization);
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}

function parseSignedUserToken(token: string, secret: string): string {
  const [payloadB64Url, signatureB64Url] = token.split('.');
  if (!payloadB64Url || !signatureB64Url) {
    throw new HttpError(401, 'INVALID_USER_TOKEN', 'Invalid user token format');
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(payloadB64Url, 'utf8')
    .digest();
  const actualSignature = Buffer.from(signatureB64Url, 'base64url');
  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new HttpError(401, 'INVALID_USER_TOKEN', 'Invalid user token');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64Url, 'base64url').toString('utf8')
    ) as unknown;
  } catch {
    throw new HttpError(
      401,
      'INVALID_USER_TOKEN',
      'Invalid user token payload'
    );
  }

  const sub =
    payload &&
    typeof payload === 'object' &&
    typeof (payload as { sub?: unknown }).sub === 'string'
      ? (payload as { sub: string }).sub.trim()
      : '';
  const exp =
    payload &&
    typeof payload === 'object' &&
    typeof (payload as { exp?: unknown }).exp === 'number'
      ? (payload as { exp: number }).exp
      : null;

  if (!sub || exp === null || !Number.isFinite(exp)) {
    throw new HttpError(401, 'INVALID_USER_TOKEN', 'Invalid user token claims');
  }
  if (exp * 1000 <= Date.now()) {
    throw new HttpError(401, 'USER_TOKEN_EXPIRED', 'User token expired');
  }

  return sub;
}

function assertServiceAuth(
  req: IncomingMessage,
  config: NotionServiceConfig
): void {
  if (!config.serviceToken) {
    return;
  }

  const token = parseBearerToken(req);
  if (!token) {
    throw new HttpError(
      401,
      'UNAUTHORIZED',
      'Invalid service token: Authorization Bearer header missing or malformed'
    );
  }
  if (token !== config.serviceToken) {
    throw new HttpError(
      401,
      'UNAUTHORIZED',
      'Invalid service token: token mismatch (check VITE_NOTION_SERVICE_TOKEN vs DEVSUITE_NOTION_SERVICE_TOKEN)'
    );
  }
}

export function authenticateRequest(
  req: IncomingMessage,
  config: NotionServiceConfig
): AuthContext {
  assertServiceAuth(req, config);

  if (config.userTokenSecret) {
    const userToken = readHeaderValue(req.headers['x-devsuite-user-token']);
    if (!userToken?.trim()) {
      throw new HttpError(
        400,
        'MISSING_USER_TOKEN',
        'Missing x-devsuite-user-token header'
      );
    }

    const userId = parseSignedUserToken(
      userToken.trim(),
      config.userTokenSecret
    );
    return { userId };
  }

  const userIdHeader = readHeaderValue(req.headers['x-devsuite-user-id']);
  const userId = userIdHeader?.trim();

  if (!userId) {
    throw new HttpError(
      400,
      'MISSING_USER_ID',
      'Missing x-devsuite-user-id header'
    );
  }

  return { userId };
}
