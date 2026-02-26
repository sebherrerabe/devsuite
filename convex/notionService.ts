import {
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
} from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import type { FunctionReference } from 'convex/server';
import type { Id } from './_generated/dataModel';

interface UserIdentity {
  subject: string;
}

const pushDeliveryApi = (
  internal as unknown as {
    inboxPushDelivery: {
      sendToCompanySubscribers: FunctionReference<
        'action',
        'internal',
        {
          companyId: Id<'companies'>;
          inboxItemId: Id<'inboxItems'>;
        },
        unknown
      >;
    };
  }
).inboxPushDelivery;

async function getUserId(ctx: {
  auth: { getUserIdentity: () => Promise<UserIdentity | null> };
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Unauthorized');
  }
  return identity.subject;
}

async function assertCompanyOwner(
  ctx: {
    db: {
      get: (id: Id<'companies'>) => Promise<{
        _id: Id<'companies'>;
        userId: string;
        isDeleted: boolean;
        deletedAt: number | null;
      } | null>;
    };
  },
  companyId: Id<'companies'>,
  userId: string
) {
  const company = await ctx.db.get(companyId);
  if (!company || company.isDeleted || company.deletedAt !== null) {
    throw new Error('Company not found');
  }
  if (company.userId !== userId) {
    throw new Error('Unauthorized');
  }
}

export const getConnectionForCompany = query({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    await assertCompanyOwner(ctx, args.companyId, userId);

    return await ctx.db
      .query('notionCompanyConnections')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', args.companyId).eq('deletedAt', null)
      )
      .first();
  },
});

export const getConnectionByWorkspaceId = internalQuery({
  args: {
    workspaceId: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedWorkspaceId = args.workspaceId.trim();
    if (!normalizedWorkspaceId) {
      return null;
    }

    return await ctx.db
      .query('notionCompanyConnections')
      .withIndex('by_workspaceId_deletedAt', q =>
        q.eq('workspaceId', normalizedWorkspaceId).eq('deletedAt', null)
      )
      .first();
  },
});

export const upsertConnection = internalMutation({
  args: {
    userId: v.string(),
    companyId: v.id('companies'),
    workspaceId: v.string(),
    workspaceName: v.optional(v.union(v.string(), v.null())),
    workspaceIcon: v.optional(v.union(v.string(), v.null())),
    botId: v.optional(v.union(v.string(), v.null())),
    ownerType: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await assertCompanyOwner(ctx, args.companyId, args.userId);

    const workspaceId = args.workspaceId.trim();
    if (!workspaceId) {
      throw new Error('workspaceId is required');
    }

    const existingForWorkspace = await ctx.db
      .query('notionCompanyConnections')
      .withIndex('by_workspaceId_deletedAt', q =>
        q.eq('workspaceId', workspaceId).eq('deletedAt', null)
      )
      .first();

    if (
      existingForWorkspace &&
      existingForWorkspace.companyId !== args.companyId
    ) {
      // A workspace link can become orphaned if its company is later soft-deleted.
      // Soft-delete the stale link so the workspace can be re-linked.
      const linkedCompany = await ctx.db.get(existingForWorkspace.companyId);
      if (
        !linkedCompany ||
        linkedCompany.isDeleted ||
        linkedCompany.deletedAt !== null
      ) {
        await ctx.db.patch(existingForWorkspace._id, {
          updatedAt: Date.now(),
          deletedAt: Date.now(),
        });
      } else {
        throw new Error(
          'This Notion workspace is already linked to a different company'
        );
      }
    }

    const existingForCompany = await ctx.db
      .query('notionCompanyConnections')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', args.companyId).eq('deletedAt', null)
      )
      .first();

    const now = Date.now();
    const patch = {
      userId: args.userId,
      companyId: args.companyId,
      workspaceId,
      workspaceName: args.workspaceName ?? null,
      workspaceIcon: args.workspaceIcon ?? null,
      botId: args.botId ?? null,
      ownerType: args.ownerType ?? null,
      updatedAt: now,
      deletedAt: null as number | null,
    };

    let connectionId: Id<'notionCompanyConnections'>;
    if (existingForCompany) {
      await ctx.db.patch(existingForCompany._id, patch);
      connectionId = existingForCompany._id;
    } else {
      connectionId = await ctx.db.insert('notionCompanyConnections', {
        ...patch,
        createdAt: now,
      });
    }

    await ctx.db.insert('integrationAuditEvents', {
      companyId: args.companyId,
      userId: args.userId,
      integration: 'notion',
      action: 'notion_workspace_connected',
      metadata: {
        workspaceId,
        workspaceName: args.workspaceName ?? null,
      },
      createdAt: now,
    });

    return connectionId;
  },
});

export const clearConnection = internalMutation({
  args: {
    userId: v.string(),
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    await assertCompanyOwner(ctx, args.companyId, args.userId);

    const existingForCompany = await ctx.db
      .query('notionCompanyConnections')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', args.companyId).eq('deletedAt', null)
      )
      .first();

    if (!existingForCompany) {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch(existingForCompany._id, {
      updatedAt: now,
      deletedAt: now,
    });

    await ctx.db.insert('integrationAuditEvents', {
      companyId: args.companyId,
      userId: args.userId,
      integration: 'notion',
      action: 'notion_workspace_disconnected',
      metadata: {
        workspaceId: existingForCompany.workspaceId,
        workspaceName: existingForCompany.workspaceName,
      },
      createdAt: now,
    });

    return existingForCompany._id;
  },
});

const notionWebhookEventInput = v.object({
  eventId: v.string(),
  workspaceId: v.string(),
  eventType: v.string(),
  eventTimestamp: v.union(v.number(), v.null()),
  entityType: v.union(v.string(), v.null()),
  entityId: v.union(v.string(), v.null()),
  entityUrl: v.union(v.string(), v.null()),
  actorId: v.union(v.string(), v.null()),
  title: v.union(v.string(), v.null()),
  pageId: v.union(v.string(), v.null()),
  databaseId: v.union(v.string(), v.null()),
  commentId: v.union(v.string(), v.null()),
  updatedPropertyIds: v.union(v.array(v.string()), v.null()),
  updatedPropertyNames: v.union(v.array(v.string()), v.null()),
});

function mapNotionEventToInboxType(
  eventType: string
): 'notification' | 'mention' | 'comment' {
  const normalized = eventType.toLowerCase();
  if (normalized.startsWith('comment.')) {
    return 'comment';
  }
  if (normalized.includes('mention')) {
    return 'mention';
  }
  return 'notification';
}

function inferEntityKind(entityType: string | null, eventType: string): string {
  if (entityType) {
    return entityType;
  }
  const normalized = eventType.toLowerCase();
  if (normalized.startsWith('comment.')) {
    return 'comment';
  }
  if (normalized.includes('database')) {
    return 'database';
  }
  return 'page';
}

async function isNotionEnabledForCompanyUser(
  ctx: MutationCtx,
  userId: string,
  companyId: Id<'companies'>
): Promise<boolean> {
  const setting = await ctx.db
    .query('integrationSettings')
    .withIndex('by_companyId_userId_integration_deletedAt', q =>
      q
        .eq('companyId', companyId)
        .eq('userId', userId)
        .eq('integration', 'notion')
        .eq('deletedAt', null)
    )
    .first();

  return setting?.enabled === true;
}

function buildNotionEntityUrl(identifier: string | null): string | null {
  if (!identifier) {
    return null;
  }
  const normalized = identifier.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(normalized)) {
    return null;
  }
  return `https://www.notion.so/${normalized}`;
}

function buildInboxTitle(event: {
  title: string | null;
  eventType: string;
  entityType: string | null;
  updatedPropertyNames: string[] | null;
}): string {
  const normalized = event.eventType.toLowerCase();

  if (normalized === 'page.created') {
    return event.title
      ? `New assigned task: ${event.title}`
      : 'New task assigned to you';
  }

  if (normalized === 'page.properties_updated') {
    const changes =
      event.updatedPropertyNames && event.updatedPropertyNames.length > 0
        ? event.updatedPropertyNames.slice(0, 3).join(', ')
        : 'properties';
    return event.title
      ? `Assigned task updated (${changes}): ${event.title}`
      : `Assigned task updated (${changes})`;
  }

  if (normalized === 'page.content_updated') {
    return event.title
      ? `Assigned task content updated: ${event.title}`
      : 'Assigned task content updated';
  }

  if (normalized === 'comment.created') {
    return event.title
      ? `New comment on assigned task: ${event.title}`
      : 'New comment on an assigned task';
  }

  if (normalized === 'comment.updated') {
    return event.title
      ? `Comment updated on assigned task: ${event.title}`
      : 'Comment updated on an assigned task';
  }

  if (normalized === 'comment.deleted') {
    return event.title
      ? `Comment deleted on assigned task: ${event.title}`
      : 'Comment deleted on an assigned task';
  }

  const eventLabel = event.eventType
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .trim();
  if (event.title && event.entityType) {
    return `Notion ${event.entityType} update (${eventLabel}): ${event.title}`;
  }
  if (event.entityType) {
    return `Notion ${event.entityType} update (${eventLabel})`;
  }
  return `Notion update (${eventLabel || 'event'})`;
}

export const ingestWebhookEvents = internalMutation({
  args: {
    events: v.array(notionWebhookEventInput),
  },
  handler: async (ctx, args) => {
    const workspaceConnectionCache = new Map<
      string,
      { companyId: Id<'companies'>; userId: string } | null
    >();
    const integrationEnabledCache = new Map<string, boolean>();
    const existingByCompany = new Map<Id<'companies'>, Set<string>>();

    let routed = 0;
    let unmatched = 0;
    let created = 0;
    let updated = 0;

    for (const event of args.events) {
      const workspaceId = event.workspaceId.trim();
      const eventId = event.eventId.trim();
      if (!workspaceId || !eventId) {
        unmatched += 1;
        continue;
      }

      let connection = workspaceConnectionCache.get(workspaceId);
      if (connection === undefined) {
        const linked = await ctx.db
          .query('notionCompanyConnections')
          .withIndex('by_workspaceId_deletedAt', q =>
            q.eq('workspaceId', workspaceId).eq('deletedAt', null)
          )
          .first();
        connection = linked
          ? { companyId: linked.companyId, userId: linked.userId }
          : null;
        workspaceConnectionCache.set(workspaceId, connection);
      }

      if (!connection) {
        unmatched += 1;
        continue;
      }

      const companyId = connection.companyId;
      const cacheKey = `${connection.userId}:${companyId}`;
      const integrationEnabled =
        integrationEnabledCache.get(cacheKey) ??
        (await isNotionEnabledForCompanyUser(
          ctx,
          connection.userId,
          companyId
        ));
      integrationEnabledCache.set(cacheKey, integrationEnabled);
      if (!integrationEnabled) {
        unmatched += 1;
        continue;
      }
      routed += 1;

      let companyExistingIds = existingByCompany.get(companyId);
      if (!companyExistingIds) {
        const existingItems = await ctx.db
          .query('inboxItems')
          .withIndex('by_companyId', q => q.eq('companyId', companyId))
          .collect();
        companyExistingIds = new Set(
          existingItems
            .filter(item => item.source === 'notion')
            .map(item => item.content.externalId)
            .filter((value): value is string => typeof value === 'string')
        );
        existingByCompany.set(companyId, companyExistingIds);
      }

      if (companyExistingIds.has(eventId)) {
        continue;
      }

      const entityIdentifier =
        event.pageId ?? event.databaseId ?? event.entityId;
      const entityKind = inferEntityKind(event.entityType, event.eventType);
      const entityUrl =
        event.entityUrl ?? buildNotionEntityUrl(entityIdentifier);
      const inboxType = mapNotionEventToInboxType(event.eventType);
      const title = buildInboxTitle({
        title: event.title,
        eventType: event.eventType,
        entityType: event.entityType,
        updatedPropertyNames: event.updatedPropertyNames,
      });

      const insertedId = await ctx.db.insert('inboxItems', {
        companyId,
        type: inboxType,
        source: 'notion',
        content: {
          title,
          externalId: eventId,
          ...(entityUrl ? { url: entityUrl } : {}),
          metadata: {
            entity: {
              kind: entityKind,
              ...(entityIdentifier ? { externalId: entityIdentifier } : {}),
              ...(entityUrl ? { url: entityUrl } : {}),
            },
            event: {
              kind: event.eventType,
              ...(event.updatedPropertyNames &&
              event.updatedPropertyNames.length > 0
                ? { updatedProperties: event.updatedPropertyNames }
                : {}),
              ...(event.actorId ? { actor: event.actorId } : {}),
              ...(event.eventTimestamp !== null
                ? { occurredAt: event.eventTimestamp }
                : {}),
            },
            notion: {
              workspaceId,
              ...(event.pageId ? { pageId: event.pageId } : {}),
              ...(event.databaseId ? { databaseId: event.databaseId } : {}),
              ...(event.commentId ? { commentId: event.commentId } : {}),
              ...(event.eventTimestamp !== null
                ? { updatedAt: event.eventTimestamp }
                : {}),
            },
          },
        },
        isRead: false,
        isArchived: false,
        isPrivate: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
      });

      await ctx.scheduler.runAfter(
        0,
        pushDeliveryApi.sendToCompanySubscribers,
        {
          companyId,
          inboxItemId: insertedId,
        }
      );

      companyExistingIds.add(eventId);
      created += 1;
    }

    return {
      eventsReceived: args.events.length,
      eventsRouted: routed,
      eventsUnmatched: unmatched,
      deliveriesCreated: created,
      deliveriesUpdated: updated,
    };
  },
});
