'use node';

import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { v } from 'convex/values';
import webpush from 'web-push';
import type { FunctionReference } from 'convex/server';
import { resolveInboxNotificationRoute } from '@devsuite/shared';

const WEB_PUSH_VAPID_PUBLIC_KEY_ENV = 'DEVSUITE_WEB_PUSH_VAPID_PUBLIC_KEY';
const WEB_PUSH_VAPID_PRIVATE_KEY_ENV = 'DEVSUITE_WEB_PUSH_VAPID_PRIVATE_KEY';
const WEB_PUSH_VAPID_SUBJECT_ENV = 'DEVSUITE_WEB_PUSH_VAPID_SUBJECT';

let vapidConfigured = false;

function readVapidConfig() {
  const publicKey = process.env[WEB_PUSH_VAPID_PUBLIC_KEY_ENV]?.trim();
  const privateKey = process.env[WEB_PUSH_VAPID_PRIVATE_KEY_ENV]?.trim();
  const subject = process.env[WEB_PUSH_VAPID_SUBJECT_ENV]?.trim();
  if (!publicKey || !privateKey || !subject) {
    return null;
  }
  return {
    publicKey,
    privateKey,
    subject,
  };
}

function configureVapid(): boolean {
  if (vapidConfigured) {
    return true;
  }
  const config = readVapidConfig();
  if (!config) {
    return false;
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  vapidConfigured = true;
  return true;
}

function getSourceLabel(source: 'github' | 'notion' | 'internal'): string {
  switch (source) {
    case 'github':
      return 'GitHub';
    case 'notion':
      return 'Notion';
    case 'internal':
      return 'DevSuite';
  }
}

function getTypeLabel(type: string): string {
  return type.replace(/_/g, ' ');
}

type InboxItemForPush = {
  _id: Id<'inboxItems'>;
  source: 'github' | 'notion' | 'internal';
  type:
    | 'notification'
    | 'pr_review'
    | 'mention'
    | 'issue'
    | 'comment'
    | 'ci_status';
  content: {
    title: string;
    url?: string;
    metadata?: unknown;
  };
  isRead: boolean;
  isArchived: boolean;
};

function buildPushPayload(item: InboxItemForPush) {
  const url = resolveInboxNotificationRoute({
    itemId: String(item._id),
    source: item.source,
    type: item.type,
    content: {
      ...(item.content.url ? { url: item.content.url } : {}),
      ...(item.content.metadata === undefined
        ? {}
        : { metadata: item.content.metadata }),
    },
  });

  return JSON.stringify({
    title: item.content.title || 'New inbox notification',
    body: `${getSourceLabel(item.source)} | ${getTypeLabel(item.type)}`,
    icon: '/logo.svg',
    tag: `devsuite-inbox-${item._id}`,
    url,
  });
}
export const sendToCompanySubscribers = internalAction({
  args: {
    companyId: v.id('companies'),
    inboxItemId: v.id('inboxItems'),
  },
  handler: async (ctx, args) => {
    if (!configureVapid()) {
      return {
        delivered: 0,
        failed: 0,
        removed: 0,
        skipped: 'missing_vapid_config' as const,
      };
    }

    const internalApi = internal as unknown as {
      inboxPushDeliveryQueries: {
        getInboxItemForPush: FunctionReference<
          'query',
          'internal',
          {
            companyId: Id<'companies'>;
            inboxItemId: Id<'inboxItems'>;
          },
          InboxItemForPush | null
        >;
      };
      inboxPushSubscriptions: {
        listActiveForCompany: FunctionReference<
          'query',
          'internal',
          {
            companyId: Id<'companies'>;
          },
          Doc<'inboxPushSubscriptions'>[]
        >;
        softDeleteById: FunctionReference<
          'mutation',
          'internal',
          {
            id: Id<'inboxPushSubscriptions'>;
          },
          unknown
        >;
      };
    };

    const item = await ctx.runQuery(
      internalApi.inboxPushDeliveryQueries.getInboxItemForPush,
      {
        companyId: args.companyId,
        inboxItemId: args.inboxItemId,
      }
    );

    if (!item || item.isRead || item.isArchived) {
      return {
        delivered: 0,
        failed: 0,
        removed: 0,
        skipped: 'item_not_eligible' as const,
      };
    }

    const subscriptions = await ctx.runQuery(
      internalApi.inboxPushSubscriptions.listActiveForCompany,
      {
        companyId: args.companyId,
      }
    );

    if (!subscriptions || subscriptions.length === 0) {
      return {
        delivered: 0,
        failed: 0,
        removed: 0,
        skipped: 'no_subscriptions' as const,
      };
    }

    const payload = buildPushPayload(item);
    let delivered = 0;
    let failed = 0;
    let removed = 0;

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload
        );
        delivered += 1;
      } catch (error) {
        failed += 1;
        const statusCode =
          typeof error === 'object' &&
          error !== null &&
          'statusCode' in error &&
          typeof (error as { statusCode?: unknown }).statusCode === 'number'
            ? (error as { statusCode: number }).statusCode
            : null;

        if (statusCode === 404 || statusCode === 410) {
          await ctx.runMutation(
            internalApi.inboxPushSubscriptions.softDeleteById,
            {
              id: subscription._id,
            }
          );
          removed += 1;
        }
      }
    }

    return {
      delivered,
      failed,
      removed,
      skipped: null,
    };
  },
});
