export function resolveTrustedDesktopOrigins(params: {
  webUrl: string | undefined;
  nodeEnv: string | undefined;
}): Set<string> {
  const origins = new Set<string>(['devsuite://app']);

  const rawWebUrl = params.webUrl?.trim();
  if (rawWebUrl) {
    try {
      const parsed = new globalThis.URL(rawWebUrl).origin;
      // Reject opaque origins ("null") produced by data:, blob:, and
      // sandboxed contexts.  Trusting the literal string "null" would match
      // every page loaded from those schemes, which is a security hole.
      if (parsed && parsed !== 'null') {
        origins.add(parsed);
      }
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
