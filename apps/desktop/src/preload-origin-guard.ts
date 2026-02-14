export function resolveTrustedDesktopOrigins(params: {
  webUrl: string | undefined;
  nodeEnv: string | undefined;
}): Set<string> {
  const origins = new Set<string>();

  const rawWebUrl = params.webUrl?.trim();
  if (rawWebUrl) {
    try {
      origins.add(new globalThis.URL(rawWebUrl).origin);
    } catch {
      // Ignore invalid config values and fall back to development defaults.
    }
  } else if (params.nodeEnv !== 'production') {
    origins.add('http://localhost:5173');
  }

  return origins;
}

export function shouldExposeDesktopApis(params: {
  currentOrigin: string | null | undefined;
  currentHash: string | null | undefined;
  trustedOrigins: ReadonlySet<string>;
}): boolean {
  if (params.currentHash === '#devsuite-widget') {
    return true;
  }

  const origin = params.currentOrigin?.trim();
  if (!origin) {
    return false;
  }

  return params.trustedOrigins.has(origin);
}
