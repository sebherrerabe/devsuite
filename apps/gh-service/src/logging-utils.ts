const DEVICE_CODE_REGEX = /\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/g;
const GH_TOKEN_REGEX = /\bgh[pousr]_[A-Za-z0-9_]{16,}\b/g;

export type GithubAuthFailureCategory =
  | 'slow_down'
  | 'access_denied'
  | 'expired_token'
  | 'timeout'
  | 'cancelled'
  | 'invalid_grant'
  | 'not_authenticated'
  | 'unknown';

export function maskUserId(userId: string): string {
  const trimmed = userId.trim();
  if (!trimmed) {
    return 'unknown';
  }

  if (trimmed.length <= 8) {
    return `${trimmed[0] ?? '*'}***${trimmed[trimmed.length - 1] ?? '*'}`;
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function maskDeviceCode(deviceCode: string | null): string | null {
  if (!deviceCode) {
    return null;
  }

  const normalized = deviceCode.trim().toUpperCase();
  if (!normalized.includes('-')) {
    return '****';
  }

  const [left, right] = normalized.split('-');
  if (!left || !right) {
    return '****-****';
  }

  return `${left.slice(0, 1)}***-${right.slice(-1).padStart(4, '*')}`;
}

function normalizeUrlForLogs(urlString: string): string {
  try {
    const url = new globalThis.URL(urlString);
    if (
      url.hostname === 'github.com' &&
      url.pathname.startsWith('/login/device')
    ) {
      return 'https://github.com/login/device';
    }
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch {
    return '[url]';
  }
}

export function sanitizeLogMessage(message: string): string {
  return message
    .replace(GH_TOKEN_REGEX, '[redacted_token]')
    .replace(DEVICE_CODE_REGEX, '****-****')
    .replace(/https?:\/\/[^\s]+/g, match => normalizeUrlForLogs(match))
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyGithubAuthFailure(
  message: string | null | undefined
): GithubAuthFailureCategory {
  if (!message) {
    return 'unknown';
  }

  const normalized = message.toLowerCase();

  if (
    normalized.includes('slow_down') ||
    normalized.includes('too many requests')
  ) {
    return 'slow_down';
  }

  if (normalized.includes('access_denied') || normalized.includes('denied')) {
    return 'access_denied';
  }

  if (normalized.includes('expired_token') || normalized.includes('expired')) {
    return 'expired_token';
  }

  if (normalized.includes('invalid_grant')) {
    return 'invalid_grant';
  }

  if (normalized.includes('timed out') || normalized.includes('timeout')) {
    return 'timeout';
  }

  if (normalized.includes('cancelled') || normalized.includes('canceled')) {
    return 'cancelled';
  }

  if (
    normalized.includes('not authenticated') ||
    normalized.includes('not logged in')
  ) {
    return 'not_authenticated';
  }

  return 'unknown';
}
