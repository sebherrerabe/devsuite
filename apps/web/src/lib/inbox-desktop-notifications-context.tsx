import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import type { FunctionReference } from 'convex/server';
import { useCurrentCompany } from '@/lib/company-context';
import { authClient } from '@/lib/auth';
import { resolveInboxNotificationRoute } from '@devsuite/shared';
import { isElectronDesktopContext } from './desktop-context-detection';
import { resolveDesktopNotificationsEnabledPreference } from './inbox-notification-preferences';

type InboxItem = Doc<'inboxItems'>;
type DesktopNotificationPermission =
  | 'default'
  | 'denied'
  | 'granted'
  | 'unsupported';

interface InboxDesktopNotificationsContextValue {
  isSupported: boolean;
  permission: DesktopNotificationPermission;
  isEnabled: boolean;
  requestPermission: () => Promise<DesktopNotificationPermission>;
  disable: () => Promise<void>;
}

const ENABLED_STORAGE_KEY = 'devsuite-desktop-notifications-enabled';
const KNOWN_IDS_STORAGE_PREFIX = 'devsuite-desktop-notifications-known-ids';
const PUSH_SERVICE_WORKER_PATH = '/inbox-push-sw.js';
const MAX_STORED_KNOWN_IDS = 1000;
const MAX_DESKTOP_NOTIFICATIONS = 3;

const InboxDesktopNotificationsContext = createContext<
  InboxDesktopNotificationsContextValue | undefined
>(undefined);

function getPermissionState(): DesktopNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

function readEnabledPreference(): boolean {
  if (typeof window === 'undefined') return false;
  return resolveDesktopNotificationsEnabledPreference({
    storedValue: window.localStorage.getItem(ENABLED_STORAGE_KEY),
    isElectronContext: isElectronDesktopContext(),
  });
}

function writeEnabledPreference(next: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ENABLED_STORAGE_KEY, String(next));
}

function supportsPushApi(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

function getVapidPublicKey(): string | null {
  const key = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  return key || null;
}

function decodeBase64Url(base64Url: string): ArrayBuffer {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4 || 4)) % 4);
  const decoded = window.atob(base64 + padding);
  const output = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    output[index] = decoded.charCodeAt(index);
  }
  return output.buffer as ArrayBuffer;
}

async function getOrRegisterPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!supportsPushApi()) {
    return null;
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration(
      PUSH_SERVICE_WORKER_PATH
    );
    if (existing) {
      return existing;
    }
    return await navigator.serviceWorker.register(PUSH_SERVICE_WORKER_PATH);
  } catch {
    return null;
  }
}

async function getOrCreateBrowserPushSubscription(
  vapidPublicKey: string
): Promise<PushSubscription | null> {
  const registration = await getOrRegisterPushServiceWorker();
  if (!registration) {
    return null;
  }

  try {
    await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      return existing;
    }

    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(vapidPublicKey),
    });
  } catch {
    return null;
  }
}

async function getExistingBrowserPushSubscription(): Promise<PushSubscription | null> {
  if (!supportsPushApi()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration(
      PUSH_SERVICE_WORKER_PATH
    );
    if (!registration) {
      return null;
    }
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

function serializePushSubscription(subscription: PushSubscription): {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
} | null {
  const serialized = subscription.toJSON();
  const endpoint = serialized.endpoint?.trim();
  const p256dh = serialized.keys?.p256dh?.trim();
  const auth = serialized.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  return {
    endpoint,
    expirationTime: serialized.expirationTime ?? null,
    keys: {
      p256dh,
      auth,
    },
  };
}

function getKnownIdsStorageKey(companyId: string): string {
  return `${KNOWN_IDS_STORAGE_PREFIX}:${companyId}`;
}

function readKnownInboxIds(companyId: string): string[] | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(getKnownIdsStorageKey(companyId));
  if (raw === null) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

function writeKnownInboxIds(companyId: string, ids: Set<string>): Set<string> {
  if (typeof window === 'undefined') return ids;
  const allIds = Array.from(ids);
  const trimmedIds = allIds.slice(-MAX_STORED_KNOWN_IDS);
  window.localStorage.setItem(
    getKnownIdsStorageKey(companyId),
    JSON.stringify(trimmedIds)
  );
  return new Set(trimmedIds);
}

function getSourceLabel(source: InboxItem['source']): string {
  switch (source) {
    case 'github':
      return 'GitHub';
    case 'notion':
      return 'Notion';
    case 'internal':
      return 'DevSuite';
  }
}

function getTypeLabel(type: InboxItem['type']): string {
  return type.replace('_', ' ');
}

function showInboxDesktopNotification(
  item: InboxItem,
  scope: { userId: string; companyId: string } | null
) {
  if (typeof window === 'undefined') return;
  const isElectronContext = isElectronDesktopContext();

  const title = item.content.title || 'New inbox notification';
  const body = `${getSourceLabel(item.source)} | ${getTypeLabel(item.type)}`;

  if (scope && window.desktopNotification?.emit) {
    void window.desktopNotification
      .emit({
        scope,
        kind: 'inbox_item',
        title,
        body,
        action: 'open_inbox',
        route: '/inbox',
        throttleKey: `${scope.userId}:${scope.companyId}:inbox_item:${item._id}`,
        throttleMs: 0,
      })
      .catch(() => {
        // Silently ignore Electron notification failures.
      });
    return;
  }

  if (isElectronContext) {
    return;
  }

  if (!('Notification' in window)) return;

  const targetRoute = resolveInboxNotificationRoute({
    itemId: item._id,
    source: item.source,
    type: item.type,
    content: {
      ...(item.content.url ? { url: item.content.url } : {}),
      ...(item.content.metadata === undefined
        ? {}
        : { metadata: item.content.metadata }),
    },
  });

  try {
    const notification = new Notification(title, {
      body,
      icon: '/logo.svg',
      tag: `devsuite-inbox-${item._id}`,
    });

    notification.onclick = () => {
      window.focus();
      if (window.location.pathname + window.location.search !== targetRoute) {
        window.location.assign(targetRoute);
      }
      notification.close();
    };
  } catch {
    // Some browsers throw if notifications are blocked after permission changes.
  }
}
function showOverflowDesktopNotification(
  count: number,
  scope: { userId: string; companyId: string } | null
) {
  if (typeof window === 'undefined') return;
  if (count <= 0) return;
  const isElectronContext = isElectronDesktopContext();

  if (scope && window.desktopNotification?.emit) {
    void window.desktopNotification
      .emit({
        scope,
        kind: 'inbox_item',
        title: 'DevSuite inbox',
        body: `${count} more notifications received`,
        action: 'open_inbox',
        route: '/inbox',
        throttleKey: `${scope.userId}:${scope.companyId}:inbox_item:overflow`,
        throttleMs: 5000,
      })
      .catch(() => {});
    return;
  }

  if (isElectronContext) {
    return;
  }

  if (!('Notification' in window)) return;

  try {
    const notification = new Notification('DevSuite inbox', {
      body: `${count} more notifications received`,
      icon: '/logo.svg',
      tag: 'devsuite-inbox-overflow',
    });
    notification.onclick = () => {
      window.focus();
      if (window.location.pathname !== '/inbox') {
        window.location.assign('/inbox');
      }
      notification.close();
    };
  } catch {
    // Keep notification failures non-fatal.
  }
}
export function InboxDesktopNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const { data: authSession } = authClient.useSession();

  const [permission, setPermission] = useState<DesktopNotificationPermission>(
    () => getPermissionState()
  );
  const [enabledPreference, setEnabledPreference] = useState(() =>
    readEnabledPreference()
  );

  const items = useQuery(
    api.inboxItems.listInboxItems,
    companyId
      ? {
          companyId,
          includeArchived: true,
          limit: 500,
        }
      : 'skip'
  );
  const inboxPushSubscriptionsApi = (
    api as unknown as {
      inboxPushSubscriptions: {
        upsertForCurrentUser: FunctionReference<
          'mutation',
          'public',
          {
            companyId: Id<'companies'>;
            subscription: {
              endpoint: string;
              expirationTime: number | null;
              keys: {
                p256dh: string;
                auth: string;
              };
              userAgent?: string | null;
            };
          },
          Id<'inboxPushSubscriptions'>
        >;
        removeForCurrentUser: FunctionReference<
          'mutation',
          'public',
          {
            companyId: Id<'companies'>;
            endpoint: string;
          },
          {
            removed: number;
          }
        >;
      };
    }
  ).inboxPushSubscriptions;
  const upsertPushSubscription = useMutation(
    inboxPushSubscriptionsApi.upsertForCurrentUser
  );
  const removePushSubscription = useMutation(
    inboxPushSubscriptionsApi.removeForCurrentUser
  );

  const knownIdsByCompanyRef = useRef<Map<string, Set<string>>>(new Map());
  const isSupported = permission !== 'unsupported';

  useEffect(() => {
    if (!isSupported) return;

    const refreshPermission = () => {
      setPermission(getPermissionState());
    };

    window.addEventListener('focus', refreshPermission);
    document.addEventListener('visibilitychange', refreshPermission);

    return () => {
      window.removeEventListener('focus', refreshPermission);
      document.removeEventListener('visibilitychange', refreshPermission);
    };
  }, [isSupported]);

  const syncBrowserPushSubscription = useCallback(
    async (targetCompanyId: Id<'companies'>) => {
      if (isElectronDesktopContext()) {
        return;
      }
      const vapidPublicKey = getVapidPublicKey();
      if (!vapidPublicKey) {
        return;
      }

      const browserSubscription =
        await getOrCreateBrowserPushSubscription(vapidPublicKey);
      if (!browserSubscription) {
        return;
      }

      const subscriptionPayload =
        serializePushSubscription(browserSubscription);
      if (!subscriptionPayload) {
        return;
      }

      await upsertPushSubscription({
        companyId: targetCompanyId,
        subscription: {
          ...subscriptionPayload,
          userAgent:
            typeof navigator !== 'undefined' ? navigator.userAgent : null,
        },
      });
    },
    [upsertPushSubscription]
  );

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return 'unsupported' as const;
    }

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);

    if (nextPermission === 'granted') {
      setEnabledPreference(true);
      writeEnabledPreference(true);
      if (companyId) {
        try {
          await syncBrowserPushSubscription(companyId);
        } catch {
          // Permission grant should still be considered successful.
        }
      }
    } else {
      setEnabledPreference(false);
      writeEnabledPreference(false);
    }

    return nextPermission;
  }, [companyId, syncBrowserPushSubscription]);

  const disable = useCallback(async () => {
    setEnabledPreference(false);
    writeEnabledPreference(false);

    const browserSubscription = await getExistingBrowserPushSubscription();
    if (!browserSubscription) {
      return;
    }

    const endpoint = browserSubscription.endpoint.trim();
    try {
      await browserSubscription.unsubscribe();
    } catch {
      // Keep disable flow non-fatal if browser unsubscription fails.
    }

    if (!companyId || !endpoint) {
      return;
    }

    try {
      await removePushSubscription({
        companyId,
        endpoint,
      });
    } catch {
      // Local disable should not fail if backend cleanup is temporarily unavailable.
    }
  }, [companyId, removePushSubscription]);

  const isEnabled = enabledPreference && permission === 'granted';

  useEffect(() => {
    if (!companyId || !isEnabled) {
      return;
    }

    let isCancelled = false;

    const run = async () => {
      try {
        await syncBrowserPushSubscription(companyId);
      } catch {
        // Keep realtime inbox behavior even if push sync fails.
      }
    };

    if (!isCancelled) {
      void run();
    }

    return () => {
      isCancelled = true;
    };
  }, [companyId, isEnabled, syncBrowserPushSubscription]);

  useEffect(() => {
    if (!companyId || !isElectronDesktopContext()) return;

    let isCancelled = false;

    const cleanupBrowserPushInElectron = async () => {
      const subscription = await getExistingBrowserPushSubscription();
      if (!subscription || isCancelled) return;

      const endpoint = subscription.endpoint?.trim();
      try {
        await subscription.unsubscribe();
      } catch {
        // Non-fatal if unsubscribe fails.
      }

      if (!endpoint || isCancelled) return;

      try {
        await removePushSubscription({ companyId, endpoint });
      } catch {
        // Non-fatal if backend removal fails.
      }
    };

    void cleanupBrowserPushInElectron();

    return () => {
      isCancelled = true;
    };
  }, [companyId, removePushSubscription]);

  useEffect(() => {
    if (!companyId || !items) return;

    const companyKey = String(companyId);
    let knownIds = knownIdsByCompanyRef.current.get(companyKey);

    if (!knownIds) {
      const storedKnownIds = readKnownInboxIds(companyKey);
      if (storedKnownIds === null) {
        const initialIds = new Set(items.map(item => item._id));
        const persistedIds = writeKnownInboxIds(companyKey, initialIds);
        knownIdsByCompanyRef.current.set(companyKey, persistedIds);
        return;
      }

      knownIds = new Set(storedKnownIds);
      knownIdsByCompanyRef.current.set(companyKey, knownIds);
    }

    const unseenItems = items.filter(item => !knownIds.has(item._id));
    if (unseenItems.length === 0) return;

    for (const item of unseenItems) {
      knownIds.add(item._id);
    }

    const persistedKnownIds = writeKnownInboxIds(companyKey, knownIds);
    knownIdsByCompanyRef.current.set(companyKey, persistedKnownIds);

    const isElectronContext = isElectronDesktopContext();

    // Always respect the user's explicit opt-out, regardless of runtime.
    if (!enabledPreference) return;
    // In the browser, also require the Notification permission to be granted.
    if (!isElectronContext && permission !== 'granted') return;

    const unseenUnread = unseenItems.filter(
      item => !item.isRead && !item.isArchived
    );
    if (unseenUnread.length === 0) return;

    const userId =
      (
        authSession as
          | {
              session?: { userId?: string } | null;
              user?: { id?: string } | null;
            }
          | null
          | undefined
      )?.session?.userId ??
      (
        authSession as
          | {
              session?: { userId?: string } | null;
              user?: { id?: string } | null;
            }
          | null
          | undefined
      )?.user?.id ??
      null;
    const scope =
      isElectronContext && userId && companyId ? { userId, companyId } : null;

    const directNotifications = unseenUnread.slice(
      0,
      MAX_DESKTOP_NOTIFICATIONS
    );
    for (const item of directNotifications) {
      showInboxDesktopNotification(item, scope);
    }

    const overflowCount = unseenUnread.length - directNotifications.length;
    if (overflowCount > 0) {
      showOverflowDesktopNotification(overflowCount, scope);
    }
  }, [companyId, items, enabledPreference, permission, authSession]);

  const value = useMemo<InboxDesktopNotificationsContextValue>(
    () => ({
      isSupported,
      permission,
      isEnabled,
      requestPermission,
      disable,
    }),
    [disable, isEnabled, isSupported, permission, requestPermission]
  );

  return (
    <InboxDesktopNotificationsContext.Provider value={value}>
      {children}
    </InboxDesktopNotificationsContext.Provider>
  );
}

export function useInboxDesktopNotifications() {
  const context = useContext(InboxDesktopNotificationsContext);
  if (!context) {
    throw new Error(
      'useInboxDesktopNotifications must be used within InboxDesktopNotificationsProvider'
    );
  }
  return context;
}
