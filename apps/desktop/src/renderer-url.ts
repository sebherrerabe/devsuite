export interface ResolveRendererUrlOptions {
  envUrl: string | undefined;
  isPackaged: boolean;
  rendererExists: boolean;
}

/**
 * Resolves the renderer entry URL used by the desktop app.
 *
 * Priority:
 * 1) explicit DEVSUITE_WEB_URL (external dev/proxy URL),
 * 2) localhost Vite URL in unpackaged dev runtime,
 * 3) bundled protocol URL in packaged runtime.
 */
export function resolveRendererUrl(
  options: ResolveRendererUrlOptions
): string | undefined {
  const explicitUrl = options.envUrl?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  if (!options.isPackaged) {
    return 'http://localhost:5173';
  }

  if (options.rendererExists) {
    return 'devsuite://app/';
  }

  return undefined;
}

export function resolveRendererUrlSource(
  options: ResolveRendererUrlOptions
): 'env' | 'localhost-dev' | 'bundled' | 'none' {
  const explicitUrl = options.envUrl?.trim();
  if (explicitUrl) {
    return 'env';
  }
  if (!options.isPackaged) {
    return 'localhost-dev';
  }
  if (options.rendererExists) {
    return 'bundled';
  }
  return 'none';
}
