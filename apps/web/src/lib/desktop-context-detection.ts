/**
 * Detects if the app is running in Electron desktop context.
 * Used to bypass browser push and use native notifications only.
 */

export function isElectronDesktopContext(): boolean {
  return (
    typeof window !== 'undefined' &&
    'desktopNotification' in window &&
    !!window.desktopNotification
  );
}
