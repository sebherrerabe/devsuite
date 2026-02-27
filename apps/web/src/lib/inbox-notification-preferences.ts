export function resolveDesktopNotificationsEnabledPreference(input: {
  storedValue: string | null;
  isElectronContext: boolean;
}): boolean {
  if (input.storedValue === 'true') {
    return true;
  }
  if (input.storedValue === 'false') {
    return false;
  }

  // Desktop shells do not expose the browser prompt UI in Inbox,
  // so default to enabled unless the user explicitly opted out.
  return input.isElectronContext;
}
