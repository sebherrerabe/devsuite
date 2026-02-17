import type { InboxItemType, InboxItemSource } from './inbox';

export interface ResolveInboxNotificationRouteInput {
  itemId?: string | null;
  source: InboxItemSource;
  type: InboxItemType;
  content: {
    url?: string | null;
    metadata?: unknown;
  };
}

function sanitizeInternalRoute(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  return trimmed;
}

function resolveMetadataRoute(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const metadataRecord = metadata as Record<string, unknown>;

  const topLevelRoute = metadataRecord.route;
  if (typeof topLevelRoute === 'string') {
    const sanitized = sanitizeInternalRoute(topLevelRoute);
    if (sanitized) {
      return sanitized;
    }
  }

  const navigation = metadataRecord.navigation;
  if (navigation && typeof navigation === 'object') {
    const nestedRoute = (navigation as Record<string, unknown>).route;
    if (typeof nestedRoute === 'string') {
      const sanitized = sanitizeInternalRoute(nestedRoute);
      if (sanitized) {
        return sanitized;
      }
    }
  }

  return null;
}

function resolveEntityRoute(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const entity = (metadata as Record<string, unknown>).entity;
  if (!entity || typeof entity !== 'object') {
    return null;
  }

  const entityKind =
    typeof (entity as Record<string, unknown>).kind === 'string'
      ? ((entity as Record<string, unknown>).kind as string)
          .trim()
          .toLowerCase()
      : '';

  switch (entityKind) {
    case 'session':
      return '/sessions';
    case 'pr_review':
      return '/reviews';
    case 'project':
      return '/projects';
    case 'task':
      return '/tasks';
    default:
      return null;
  }
}

function buildInboxItemRoute(itemId?: string | null): string {
  if (!itemId) {
    return '/inbox';
  }

  return `/inbox?itemId=${encodeURIComponent(itemId)}`;
}

export function resolveInboxNotificationRoute(
  input: ResolveInboxNotificationRouteInput
): string {
  const metadataRoute = resolveMetadataRoute(input.content.metadata);
  if (metadataRoute) {
    return metadataRoute;
  }

  const urlRoute = input.content.url
    ? sanitizeInternalRoute(input.content.url)
    : null;
  if (urlRoute) {
    return urlRoute;
  }

  const entityRoute = resolveEntityRoute(input.content.metadata);
  if (entityRoute) {
    return entityRoute;
  }

  if (input.type === 'pr_review') {
    return '/reviews';
  }

  if (input.source === 'internal') {
    return '/inbox';
  }

  return buildInboxItemRoute(input.itemId);
}
