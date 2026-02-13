import type { IncomingMessage } from 'node:http';
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

function assertServiceAuth(
  req: IncomingMessage,
  config: NotionServiceConfig
): void {
  if (!config.serviceToken) {
    return;
  }

  const token = parseBearerToken(req);
  if (!token || token !== config.serviceToken) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid service token');
  }
}

export function authenticateRequest(
  req: IncomingMessage,
  config: NotionServiceConfig
): AuthContext {
  assertServiceAuth(req, config);

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
