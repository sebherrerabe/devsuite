/**
 * Detects if the user is on Windows from the browser user agent.
 * Used to show/hide Windows-only features (e.g. Desktop settings tab).
 */
export function isWindowsUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent?.toLowerCase() ?? '';
  const platform =
    (navigator as { platform?: string }).platform?.toLowerCase() ?? '';
  return ua.includes('win') || platform.includes('win');
}
