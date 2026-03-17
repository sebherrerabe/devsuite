export interface WebRuntimeEnv {
  VITE_CONVEX_URL?: string;
  VITE_CONVEX_SITE_URL?: string;
}

export interface WebRuntimeConfig {
  convexUrl: string;
  convexSiteUrl: string;
}

export type WebRuntimeConfigResult =
  | {
      ok: true;
      value: WebRuntimeConfig;
    }
  | {
      ok: false;
      missingKeys: Array<keyof WebRuntimeEnv>;
    };

function normalizeRequiredValue(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function resolveWebRuntimeConfig(
  env: WebRuntimeEnv
): WebRuntimeConfigResult {
  const convexUrl = normalizeRequiredValue(env.VITE_CONVEX_URL);
  const convexSiteUrl = normalizeRequiredValue(env.VITE_CONVEX_SITE_URL);
  const missingKeys: Array<keyof WebRuntimeEnv> = [];

  if (!convexUrl) {
    missingKeys.push('VITE_CONVEX_URL');
  }
  if (!convexSiteUrl) {
    missingKeys.push('VITE_CONVEX_SITE_URL');
  }

  if (missingKeys.length > 0) {
    return {
      ok: false,
      missingKeys,
    };
  }

  if (!convexUrl || !convexSiteUrl) {
    return {
      ok: false,
      missingKeys: ['VITE_CONVEX_URL', 'VITE_CONVEX_SITE_URL'],
    };
  }

  return {
    ok: true,
    value: {
      convexUrl,
      convexSiteUrl,
    },
  };
}

export function readWebRuntimeConfig(): WebRuntimeConfigResult {
  return resolveWebRuntimeConfig(import.meta.env);
}
