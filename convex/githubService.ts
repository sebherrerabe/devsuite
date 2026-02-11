import { internalMutation, internalQuery, query } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';

interface UserIdentity {
  subject: string;
}

async function getUserId(ctx: {
  auth: { getUserIdentity: () => Promise<UserIdentity | null> };
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Unauthorized');
  }
  return identity.subject;
}

function normalizeOrgLogin(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  // Accept GitHub-style org/user logins only.
  if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function extractGithubOrgLogins(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return [];
  }

  const candidate = (metadata as { githubOrgLogins?: unknown }).githubOrgLogins;
  if (!Array.isArray(candidate)) {
    return [];
  }

  const unique = new Set<string>();
  for (const value of candidate) {
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = normalizeOrgLogin(value);
    if (!normalized) {
      continue;
    }

    unique.add(normalized);
  }

  return Array.from(unique);
}

function parseGithubOwnerFromRepositoryUrl(urlValue: string): string | null {
  let parsedUrl: globalThis.URL;
  try {
    parsedUrl = new globalThis.URL(urlValue);
  } catch {
    return null;
  }

  const hostname = parsedUrl.hostname.trim().toLowerCase();
  if (hostname !== 'github.com' && hostname !== 'www.github.com') {
    return null;
  }

  const normalizedPath = parsedUrl.pathname
    .replace(/\.git$/i, '')
    .replace(/\/+$/g, '');
  const segments = normalizedPath.split('/').filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  return normalizeOrgLogin(segments[0] ?? '');
}

function extractGithubOrgLoginsFromRepositories(
  repositories: Array<{ provider: string; url: string }>
): string[] {
  const unique = new Set<string>();

  for (const repository of repositories) {
    if (repository.provider !== 'github') {
      continue;
    }

    const owner = parseGithubOwnerFromRepositoryUrl(repository.url);
    if (!owner) {
      continue;
    }

    unique.add(owner);
  }

  return Array.from(unique);
}

function mergeCompanyGithubOrgLogins(
  metadataLogins: string[],
  repositoryLogins: string[]
): string[] {
  return Array.from(new Set([...metadataLogins, ...repositoryLogins]));
}

function mapInboxType(
  reason: string,
  subjectType: string | null
):
  | 'notification'
  | 'pr_review'
  | 'mention'
  | 'issue'
  | 'comment'
  | 'ci_status' {
  const normalizedReason = reason.toLowerCase();
  const normalizedSubjectType = subjectType?.toLowerCase() ?? null;

  if (normalizedReason === 'review_requested') {
    return 'pr_review';
  }

  if (normalizedReason === 'mention') {
    return 'mention';
  }

  if (
    normalizedReason.includes('comment') ||
    normalizedReason === 'author' ||
    normalizedReason === 'subscribed'
  ) {
    return 'comment';
  }

  if (normalizedSubjectType === 'issue') {
    return 'issue';
  }

  if (
    normalizedSubjectType === 'checksuite' ||
    normalizedSubjectType === 'check_run' ||
    normalizedSubjectType === 'commit'
  ) {
    return 'ci_status';
  }

  return 'notification';
}

function inferEntityKind(subjectType: string | null): string {
  const normalized = subjectType?.toLowerCase();
  if (!normalized) {
    return 'notification';
  }

  if (normalized === 'pullrequest') {
    return 'pull_request';
  }

  if (normalized === 'issue') {
    return 'issue';
  }

  if (normalized === 'discussion') {
    return 'discussion';
  }

  return normalized;
}

export const listCompanyRoutes = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const companies = await ctx.db
      .query('companies')
      .withIndex('by_userId', q => q.eq('userId', args.userId))
      .collect();

    const activeCompanies = companies.filter(
      company => !company.isDeleted && company.deletedAt === null
    );

    const routes: Array<{
      companyId: Id<'companies'>;
      companyName: string;
      githubOrgLogins: string[];
    }> = [];

    for (const company of activeCompanies) {
      const repositories = await ctx.db
        .query('repositories')
        .withIndex('by_companyId_deletedAt', q =>
          q.eq('companyId', company._id).eq('deletedAt', null)
        )
        .collect();

      const githubOrgLogins = mergeCompanyGithubOrgLogins(
        extractGithubOrgLogins(company.metadata),
        extractGithubOrgLoginsFromRepositories(repositories)
      );

      if (githubOrgLogins.length === 0) {
        continue;
      }

      routes.push({
        companyId: company._id,
        companyName: company.name,
        githubOrgLogins,
      });
    }

    return routes;
  },
});

const githubNotificationInput = v.object({
  threadId: v.string(),
  reason: v.string(),
  title: v.string(),
  url: v.optional(v.union(v.string(), v.null())),
  repoFullName: v.optional(v.union(v.string(), v.null())),
  orgLogin: v.optional(v.union(v.string(), v.null())),
  subjectType: v.optional(v.union(v.string(), v.null())),
  updatedAt: v.optional(v.union(v.number(), v.null())),
  unread: v.boolean(),
  apiUrl: v.optional(v.union(v.string(), v.null())),
});

const notificationSyncTelemetryInput = v.object({
  githubUser: v.optional(v.union(v.string(), v.null())),
  status: v.union(
    v.literal('success'),
    v.literal('skipped_no_routes'),
    v.literal('error')
  ),
  hasRouteMappings: v.boolean(),
  companiesMatched: v.number(),
  notificationsFetched: v.number(),
  notificationsFiltered: v.number(),
  notificationsReceived: v.number(),
  notificationsRouted: v.number(),
  notificationsUnmatched: v.number(),
  deliveriesCreated: v.number(),
  deliveriesUpdated: v.number(),
  attemptedAt: v.number(),
  errorCode: v.optional(v.union(v.string(), v.null())),
  errorMessage: v.optional(v.union(v.string(), v.null())),
});

export const recordNotificationSyncTelemetry = internalMutation({
  args: {
    userId: v.string(),
    telemetry: notificationSyncTelemetryInput,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('githubNotificationSyncStatus')
      .withIndex('by_userId', q => q.eq('userId', args.userId))
      .first();

    const now = Date.now();
    const nextLastSuccessAt =
      args.telemetry.status === 'success'
        ? args.telemetry.attemptedAt
        : (existing?.lastSuccessAt ?? null);

    const patch = {
      userId: args.userId,
      githubUser: args.telemetry.githubUser ?? null,
      status: args.telemetry.status,
      hasRouteMappings: args.telemetry.hasRouteMappings,
      companiesMatched: args.telemetry.companiesMatched,
      notificationsFetched: args.telemetry.notificationsFetched,
      notificationsFiltered: args.telemetry.notificationsFiltered,
      notificationsReceived: args.telemetry.notificationsReceived,
      notificationsRouted: args.telemetry.notificationsRouted,
      notificationsUnmatched: args.telemetry.notificationsUnmatched,
      deliveriesCreated: args.telemetry.deliveriesCreated,
      deliveriesUpdated: args.telemetry.deliveriesUpdated,
      lastAttemptAt: args.telemetry.attemptedAt,
      lastSuccessAt: nextLastSuccessAt,
      errorCode: args.telemetry.errorCode ?? null,
      errorMessage: args.telemetry.errorMessage ?? null,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert('githubNotificationSyncStatus', patch);
  },
});

export const getMyNotificationSyncTelemetry = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('githubNotificationSyncStatus')
      .withIndex('by_userId', q => q.eq('userId', args.userId))
      .first();
  },
});

export const getNotificationSyncTelemetryForCurrentUser = query({
  args: {},
  handler: async ctx => {
    const userId = await getUserId(ctx);
    return await ctx.db
      .query('githubNotificationSyncStatus')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .first();
  },
});

export const ingestNotifications = internalMutation({
  args: {
    userId: v.string(),
    notifications: v.array(githubNotificationInput),
  },
  handler: async (ctx, args) => {
    const companies = await ctx.db
      .query('companies')
      .withIndex('by_userId', q => q.eq('userId', args.userId))
      .collect();

    const activeCompanies = companies.filter(
      company => !company.isDeleted && company.deletedAt === null
    );

    const companyOrgMap = new Map<Id<'companies'>, string[]>();
    const orgToCompanyIds = new Map<string, Id<'companies'>[]>();

    for (const company of activeCompanies) {
      const repositories = await ctx.db
        .query('repositories')
        .withIndex('by_companyId_deletedAt', q =>
          q.eq('companyId', company._id).eq('deletedAt', null)
        )
        .collect();

      const orgLogins = mergeCompanyGithubOrgLogins(
        extractGithubOrgLogins(company.metadata),
        extractGithubOrgLoginsFromRepositories(repositories)
      );
      companyOrgMap.set(company._id, orgLogins);

      for (const orgLogin of orgLogins) {
        const existing = orgToCompanyIds.get(orgLogin) ?? [];
        existing.push(company._id);
        orgToCompanyIds.set(orgLogin, existing);
      }
    }

    const existingByCompany = new Map<
      Id<'companies'>,
      Map<string, Id<'inboxItems'>>
    >();
    for (const company of activeCompanies) {
      if ((companyOrgMap.get(company._id) ?? []).length === 0) {
        continue;
      }

      const items = await ctx.db
        .query('inboxItems')
        .withIndex('by_companyId', q => q.eq('companyId', company._id))
        .collect();

      const indexed = new Map<string, Id<'inboxItems'>>();
      for (const item of items) {
        if (item.source !== 'github') {
          continue;
        }

        const externalId = item.content.externalId;
        if (!externalId) {
          continue;
        }

        indexed.set(externalId, item._id);
      }

      existingByCompany.set(company._id, indexed);
    }

    const seenDeliveries = new Set<string>();
    const now = Date.now();

    let routed = 0;
    let unmatched = 0;
    let created = 0;
    let updated = 0;

    for (const notification of args.notifications) {
      const orgLogin = notification.orgLogin
        ? normalizeOrgLogin(notification.orgLogin)
        : null;
      const targetCompanies = orgLogin
        ? (orgToCompanyIds.get(orgLogin) ?? [])
        : [];

      if (targetCompanies.length === 0) {
        unmatched += 1;
        continue;
      }

      routed += 1;
      const inboxType = mapInboxType(
        notification.reason,
        notification.subjectType ?? null
      );

      for (const companyId of targetCompanies) {
        const dedupeKey = `${companyId}:${notification.threadId}`;
        if (seenDeliveries.has(dedupeKey)) {
          continue;
        }
        seenDeliveries.add(dedupeKey);

        const content = {
          title: notification.title,
          body: notification.reason,
          externalId: notification.threadId,
          metadata: {
            entity: {
              kind: inferEntityKind(notification.subjectType ?? null),
              externalId: notification.threadId,
              ...(notification.url !== null ? { url: notification.url } : {}),
              ...(notification.repoFullName !== null
                ? { repoFullName: notification.repoFullName }
                : {}),
            },
            event: {
              kind: notification.reason,
              ...(notification.updatedAt !== null
                ? { occurredAt: notification.updatedAt }
                : {}),
            },
            github: {
              threadId: notification.threadId,
              reason: notification.reason,
              ...(notification.repoFullName !== null
                ? { repoFullName: notification.repoFullName }
                : {}),
              ...(notification.subjectType !== null
                ? { subjectType: notification.subjectType }
                : {}),
              ...(notification.updatedAt !== null
                ? { updatedAt: notification.updatedAt }
                : {}),
              ...(orgLogin !== null ? { orgLogin } : {}),
              ...(notification.apiUrl !== null
                ? { apiUrl: notification.apiUrl }
                : {}),
            },
          },
          ...(notification.url !== null ? { url: notification.url } : {}),
        };

        const companyItems =
          existingByCompany.get(companyId) ??
          new Map<string, Id<'inboxItems'>>();
        existingByCompany.set(companyId, companyItems);

        const existingId = companyItems.get(notification.threadId);
        if (existingId) {
          // Notification ingest is insert-only by external thread id.
          // Once registered for a company, it is never re-written by polling.
          continue;
        }

        const insertedId = await ctx.db.insert('inboxItems', {
          companyId,
          type: inboxType,
          source: 'github',
          content,
          isRead: !notification.unread,
          isArchived: false,
          isPrivate: false,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });

        companyItems.set(notification.threadId, insertedId);
        created += 1;
      }
    }

    return {
      companiesConsidered: activeCompanies.length,
      notificationsReceived: args.notifications.length,
      notificationsRouted: routed,
      notificationsUnmatched: unmatched,
      deliveriesCreated: created,
      deliveriesUpdated: updated,
    };
  },
});
