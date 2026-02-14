import { normalizeHttpOrigin } from './web-content-security.js';

const ALLOWED_PERMISSIONS = new Set<string>(['clipboard-sanitized-write']);

export function normalizePermissionName(permission: string): string {
  return permission.trim().toLowerCase();
}

export function isDesktopPermissionAllowed(permission: string): boolean {
  return ALLOWED_PERMISSIONS.has(normalizePermissionName(permission));
}

export function shouldGrantDesktopPermission(params: {
  permission: string;
  requestingOrigin: string | undefined;
  allowedOrigins: ReadonlySet<string>;
}): boolean {
  if (!isDesktopPermissionAllowed(params.permission)) {
    return false;
  }

  const origin = normalizeHttpOrigin(params.requestingOrigin ?? '');
  if (!origin) {
    return false;
  }

  return params.allowedOrigins.has(origin);
}
