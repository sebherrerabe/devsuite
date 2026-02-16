export function resolveRendererUrl(options: {
  envUrl: string | undefined;
  isPackaged: boolean;
  rendererExists: boolean;
}): string | undefined {
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
