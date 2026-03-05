import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';
import { requireCompanyId } from './lib/helpers';
import {
  moduleFlagsValidator,
  normalizeUserModuleFlagOverrides,
} from './lib/moduleAccess';

const MIN_GRACE_SECONDS = 5;
const MAX_GRACE_SECONDS = 60 * 60;
const MIN_REMINDER_INTERVAL_SECONDS = 30;
const MAX_REMINDER_INTERVAL_SECONDS = 60 * 60;
const MIN_INACTIVITY_THRESHOLD_SECONDS = 60;
const MAX_INACTIVITY_THRESHOLD_SECONDS = 3600;
const MIN_AUTO_SESSION_WARMUP_SECONDS = 30;
const MAX_AUTO_SESSION_WARMUP_SECONDS = 600;
const DEFAULT_INACTIVITY_THRESHOLD_SECONDS = 300;
const DEFAULT_AUTO_INACTIVITY_PAUSE = true;
const DEFAULT_AUTO_SESSION = false;
const DEFAULT_AUTO_SESSION_WARMUP_SECONDS = 120;
const DEFAULT_DEV_CORE_LIST = ['code.exe', 'cursor.exe', 'idea64.exe'];
const DEFAULT_DEV_SUPPORT_LIST = [
  'wt.exe',
  'windowsterminal.exe',
  'powershell.exe',
  'cmd.exe',
];
const DEFAULT_DEV_SITE_LIST = [
  'chat.openai.com',
  'claude.ai',
  'github.com',
  'localhost',
];

const desktopFocusSettingsValidator = v.object({
  devCoreList: v.optional(v.array(v.string())),
  ideWatchList: v.optional(v.array(v.string())),
  devSupportList: v.optional(v.array(v.string())),
  devSiteList: v.optional(v.array(v.string())),
  appBlockList: v.array(v.string()),
  websiteBlockList: v.array(v.string()),
  strictMode: v.union(v.literal('prompt_only'), v.literal('prompt_then_close')),
  appActionMode: v.union(v.literal('warn'), v.literal('warn_then_close')),
  websiteActionMode: v.union(v.literal('warn_only'), v.literal('escalate')),
  graceSeconds: v.number(),
  reminderIntervalSeconds: v.number(),
  inactivityThresholdSeconds: v.optional(v.number()),
  autoInactivityPause: v.optional(v.boolean()),
  autoSession: v.optional(v.boolean()),
  autoSessionWarmupSeconds: v.optional(v.number()),
});

type DbCtx = QueryCtx | MutationCtx;

async function getUserId(ctx: DbCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Unauthorized');
  }
  return identity.subject;
}

async function assertCompanyAccess(
  ctx: DbCtx,
  companyId: Id<'companies'>,
  userId: string
) {
  const company = await ctx.db.get(companyId);
  if (!company || company.userId !== userId) {
    throw new Error('Company not found or access denied');
  }
}

async function appendDesktopFocusAuditEvent(
  ctx: MutationCtx,
  companyId: Id<'companies'>,
  userId: string,
  desktopFocus: ReturnType<typeof normalizeDesktopFocusSettingsForStorage>
) {
  await ctx.db.insert('desktopFocusAuditEvents', {
    companyId,
    userId,
    action: 'desktop_focus_settings_updated',
    metadata: {
      desktopFocus,
    },
    createdAt: Date.now(),
  });
}

function normalizeUserModuleFlagsForStorage(value: unknown) {
  const normalized = normalizeUserModuleFlagOverrides(value);
  if (normalized.projects === false) {
    normalized.sessions = false;
    normalized.performance = false;
    normalized.invoicing = false;
  }
  if (normalized.sessions === false) {
    normalized.invoicing = false;
  }
  return normalized;
}

function normalizeExecutableNames(values: string[]): string[] {
  return Array.from(
    new Set(values.map(value => value.trim().toLowerCase()).filter(Boolean))
  );
}

function normalizeDomains(values: string[]): string[] {
  const normalizedValues = values
    .map(value => value.trim().toLowerCase())
    .map(value => value.replace(/^https?:\/\//, ''))
    .map(value => value.replace(/^www\./, ''))
    .map(value => value.split(/[/?#]/, 1)[0] ?? '')
    .filter(Boolean);

  return Array.from(new Set(normalizedValues));
}

function clampInteger(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  const rounded = Math.trunc(value);
  return Math.min(maximum, Math.max(minimum, rounded));
}

function normalizeDesktopFocusSettingsForStorage(value: {
  devCoreList?: string[];
  ideWatchList?: string[];
  devSupportList?: string[];
  devSiteList?: string[];
  appBlockList: string[];
  websiteBlockList: string[];
  strictMode: 'prompt_only' | 'prompt_then_close';
  appActionMode: 'warn' | 'warn_then_close';
  websiteActionMode: 'warn_only' | 'escalate';
  graceSeconds: number;
  reminderIntervalSeconds: number;
  inactivityThresholdSeconds?: number;
  autoInactivityPause?: boolean;
  autoSession?: boolean;
  autoSessionWarmupSeconds?: number;
}) {
  const devCoreSource =
    value.devCoreList ?? value.ideWatchList ?? DEFAULT_DEV_CORE_LIST;
  const normalizedDevCoreList = normalizeExecutableNames(devCoreSource);

  return {
    devCoreList: normalizedDevCoreList,
    ideWatchList: normalizedDevCoreList,
    devSupportList: normalizeExecutableNames(
      value.devSupportList ?? DEFAULT_DEV_SUPPORT_LIST
    ),
    devSiteList: normalizeDomains(value.devSiteList ?? DEFAULT_DEV_SITE_LIST),
    appBlockList: normalizeExecutableNames(value.appBlockList),
    websiteBlockList: normalizeDomains(value.websiteBlockList),
    strictMode: value.strictMode,
    appActionMode: value.appActionMode,
    websiteActionMode: value.websiteActionMode,
    graceSeconds: clampInteger(
      value.graceSeconds,
      MIN_GRACE_SECONDS,
      MAX_GRACE_SECONDS
    ),
    reminderIntervalSeconds: clampInteger(
      value.reminderIntervalSeconds,
      MIN_REMINDER_INTERVAL_SECONDS,
      MAX_REMINDER_INTERVAL_SECONDS
    ),
    inactivityThresholdSeconds: clampInteger(
      value.inactivityThresholdSeconds ?? DEFAULT_INACTIVITY_THRESHOLD_SECONDS,
      MIN_INACTIVITY_THRESHOLD_SECONDS,
      MAX_INACTIVITY_THRESHOLD_SECONDS
    ),
    autoInactivityPause:
      value.autoInactivityPause ?? DEFAULT_AUTO_INACTIVITY_PAUSE,
    autoSession: value.autoSession ?? DEFAULT_AUTO_SESSION,
    autoSessionWarmupSeconds: clampInteger(
      value.autoSessionWarmupSeconds ?? DEFAULT_AUTO_SESSION_WARMUP_SECONDS,
      MIN_AUTO_SESSION_WARMUP_SECONDS,
      MAX_AUTO_SESSION_WARMUP_SECONDS
    ),
  };
}

export const get = query({
  args: { companyId: v.id('companies') },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    return await ctx.db
      .query('userSettings')
      .withIndex('by_companyId_userId', q =>
        q.eq('companyId', companyId).eq('userId', userId)
      )
      .filter(q => q.eq(q.field('deletedAt'), null))
      .first()
      .then(settings => {
        if (!settings) {
          return null;
        }

        const normalizedDesktopFocus = settings.desktopFocus
          ? normalizeDesktopFocusSettingsForStorage(settings.desktopFocus)
          : undefined;

        return {
          ...settings,
          moduleFlags: normalizeUserModuleFlagsForStorage(settings.moduleFlags),
          ...(normalizedDesktopFocus
            ? { desktopFocus: normalizedDesktopFocus }
            : {}),
        };
      });
  },
});

export const update = mutation({
  args: {
    companyId: v.id('companies'),
    timezone: v.optional(v.string()),
    moduleFlags: v.optional(moduleFlagsValidator),
    desktopFocus: v.optional(desktopFocusSettingsValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    if (
      args.timezone === undefined &&
      args.moduleFlags === undefined &&
      args.desktopFocus === undefined
    ) {
      throw new Error('No settings provided');
    }

    const existing = await ctx.db
      .query('userSettings')
      .withIndex('by_companyId_userId', q =>
        q.eq('companyId', companyId).eq('userId', userId)
      )
      .filter(q => q.eq(q.field('deletedAt'), null))
      .first();

    const now = Date.now();
    const normalizedDesktopFocus =
      args.desktopFocus === undefined
        ? undefined
        : normalizeDesktopFocusSettingsForStorage(args.desktopFocus);

    if (existing) {
      const updates: {
        timezone?: string;
        moduleFlags?: ReturnType<typeof normalizeUserModuleFlagsForStorage>;
        desktopFocus?: ReturnType<
          typeof normalizeDesktopFocusSettingsForStorage
        >;
        updatedAt: number;
      } = {
        updatedAt: now,
      };
      if (args.timezone !== undefined) {
        updates.timezone = args.timezone;
      }
      if (args.moduleFlags !== undefined) {
        updates.moduleFlags = normalizeUserModuleFlagsForStorage(
          args.moduleFlags
        );
      }
      if (normalizedDesktopFocus !== undefined) {
        updates.desktopFocus = normalizedDesktopFocus;
      }
      await ctx.db.patch(existing._id, updates);

      if (normalizedDesktopFocus !== undefined) {
        const normalizedExistingDesktopFocus = existing.desktopFocus
          ? normalizeDesktopFocusSettingsForStorage(existing.desktopFocus)
          : null;
        const changed =
          JSON.stringify(normalizedExistingDesktopFocus) !==
          JSON.stringify(normalizedDesktopFocus);

        if (changed) {
          await appendDesktopFocusAuditEvent(
            ctx,
            companyId,
            userId,
            normalizedDesktopFocus
          );
        }
      }

      return existing._id;
    }

    const insertedId = await ctx.db.insert('userSettings', {
      companyId,
      userId,
      timezone: args.timezone ?? 'UTC',
      moduleFlags:
        args.moduleFlags === undefined
          ? {}
          : normalizeUserModuleFlagsForStorage(args.moduleFlags),
      ...(normalizedDesktopFocus === undefined
        ? {}
        : {
            desktopFocus: normalizedDesktopFocus,
          }),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    if (normalizedDesktopFocus !== undefined) {
      await appendDesktopFocusAuditEvent(
        ctx,
        companyId,
        userId,
        normalizedDesktopFocus
      );
    }

    return insertedId;
  },
});
