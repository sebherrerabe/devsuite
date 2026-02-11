import path from 'path';
import os from 'os';
import fs from 'fs';

/**
 * The default root directory for PR bundles.
 * Resolves to ~/.private/pr-reviews/
 */
export const DEFAULT_ALLOWED_ROOT = path.join(
  os.homedir(),
  '.private',
  'pr-reviews'
);

/**
 * Resolves a path and ensures it's within the specified allowed root.
 */
export function sanitizePath(
  inputPath: string,
  allowedRoot: string = DEFAULT_ALLOWED_ROOT
): string {
  const expandPath = (p: string) =>
    p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;

  const expandedInput = expandPath(inputPath);
  const expandedRoot = expandPath(allowedRoot);

  const resolvedPath = path.resolve(expandedInput);
  const resolvedRoot = path.resolve(expandedRoot);

  let checkPath = resolvedPath;
  if (fs.existsSync(resolvedPath)) {
    try {
      checkPath = fs.realpathSync(resolvedPath);
    } catch {
      // ignore realpath errors
    }
  }

  if (!isPathSafe(checkPath, resolvedRoot)) {
    throw new Error(
      `Security Error: Path "${inputPath}" is outside the allowed root "${allowedRoot}"`
    );
  }

  return resolvedPath;
}

/**
 * Checks if a resolved absolute path is safely within an allowed root directory.
 */
export function isPathSafe(resolvedPath: string, allowedRoot: string): boolean {
  if (resolvedPath.includes('\0')) {
    return false;
  }

  const relative = path.relative(allowedRoot, resolvedPath);
  if (relative === '') {
    return true;
  }

  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Builds a standardized bundle directory path for a PR.
 */
export function buildBundlePath(
  owner: string,
  repo: string,
  prNumber: number,
  allowedRoot: string = DEFAULT_ALLOWED_ROOT
): string {
  const safeOwner = owner.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const safeRepo = repo.replace(/[^a-zA-Z0-9_.-]/g, '_');

  const folderName = `${safeOwner}__${safeRepo}__pr-${prNumber}`;
  const bundlePath = path.join(allowedRoot, folderName);

  return sanitizePath(bundlePath, allowedRoot);
}
