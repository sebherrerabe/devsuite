import { resolveTrustedDesktopOrigins } from './preload-origin-guard.js';

export function normalizeHttpOrigin(rawUrl: string): string | null {
  try {
    const parsed = new globalThis.URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function isBundledRendererUrl(rawUrl: string): boolean {
  try {
    const parsed = new globalThis.URL(rawUrl);
    return parsed.protocol === 'devsuite:' && parsed.hostname === 'app';
  } catch {
    return false;
  }
}

function parseAdditionalOrigins(rawOrigins: string | undefined): Set<string> {
  const origins = new Set<string>();
  const value = rawOrigins?.trim();
  if (!value) {
    return origins;
  }

  for (const candidate of value.split(',')) {
    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = normalizeHttpOrigin(trimmed);
    if (normalized) {
      origins.add(normalized);
    }
  }

  return origins;
}

export function resolveAllowedDesktopNavigationOrigins(params: {
  webUrl: string | undefined;
  nodeEnv: string | undefined;
  additionalOriginsCsv: string | undefined;
}): Set<string> {
  const primaryOrigins = resolveTrustedDesktopOrigins({
    webUrl: params.webUrl,
    nodeEnv: params.nodeEnv,
  });
  const additionalOrigins = parseAdditionalOrigins(params.additionalOriginsCsv);

  return new Set([...primaryOrigins, ...additionalOrigins]);
}

export function shouldAllowInAppNavigation(params: {
  url: string;
  allowedOrigins: ReadonlySet<string>;
}): boolean {
  const normalized = params.url.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized === 'about:blank') {
    return true;
  }

  if (normalized.startsWith('data:text/html')) {
    return true;
  }

  if (isBundledRendererUrl(params.url)) {
    return true;
  }

  const origin = normalizeHttpOrigin(params.url);
  if (!origin) {
    return false;
  }

  return params.allowedOrigins.has(origin);
}

export function shouldOpenInExternalBrowser(params: {
  url: string;
  allowedOrigins: ReadonlySet<string>;
}): boolean {
  const origin = normalizeHttpOrigin(params.url);
  if (!origin) {
    return false;
  }

  return !params.allowedOrigins.has(origin);
}
