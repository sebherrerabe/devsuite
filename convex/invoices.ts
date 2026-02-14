import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { v } from 'convex/values';
import {
  assertCompanyScoped,
  assertNotDeleted,
  requireCompanyId,
} from './lib/helpers';
import { getDefaultRateCard } from './lib/billing';
import { deriveActiveSegments } from './lib/sessionIntervals';
import { assertModuleEnabled } from './lib/moduleAccess';

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
  await assertModuleEnabled(ctx, companyId, 'invoicing', userId);
}

type RateConfig = {
  rateCents: number;
  currency: string;
  roundingIncrementMinutes: number;
  roundingMode: 'floor' | 'ceil' | 'nearest';
};

type ProjectTaskGroup = {
  projectId: Id<'projects'>;
  projectName: string;
  tasks: { taskId: Id<'tasks'>; title: string }[];
};

type InvoiceLineAccum = {
  date: string;
  rate: RateConfig;
  rawDurationMs: number;
  sessionIds: Set<Id<'sessions'>>;
  tasksByProject: Map<
    Id<'projects'>,
    { projectName: string; tasks: Map<Id<'tasks'>, string> }
  >;
};

type InvoiceConflict = {
  sessionId: Id<'sessions'>;
  startAt: number;
  endAt: number;
  reason: string;
};

type InvoiceLinePayload = {
  rateCents: number;
  currency: string;
  roundingIncrementMinutes: number;
  roundingMode: RateConfig['roundingMode'];
  rawMinutes: number;
  billedMinutes: number;
  amountCents: number;
  projects: ProjectTaskGroup[];
  sessionIds: Id<'sessions'>[];
};

type InvoiceDayPayload = {
  date: string;
  totalMinutes: number;
  totalCents: number;
  lines: InvoiceLinePayload[];
};

function buildRateKey(rate: RateConfig) {
  return `${rate.currency}:${rate.rateCents}:${rate.roundingIncrementMinutes}:${rate.roundingMode}`;
}

function roundMinutes(
  rawMinutes: number,
  incrementMinutes: number,
  mode: RateConfig['roundingMode']
) {
  if (incrementMinutes <= 0) return rawMinutes;
  const ratio = rawMinutes / incrementMinutes;
  if (mode === 'ceil') return Math.ceil(ratio) * incrementMinutes;
  if (mode === 'nearest') return Math.round(ratio) * incrementMinutes;
  return Math.floor(ratio) * incrementMinutes;
}

function buildDateFormatters(timeZone: string) {
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const partsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const requirePart = (value: number | undefined, label: string) => {
    if (value === undefined || Number.isNaN(value)) {
      throw new Error(`Invalid ${label} in date parts`);
    }
    return value;
  };

  const getDateKey = (timestamp: number) =>
    dateFormatter.format(new Date(timestamp));

  const getDateParts = (timestamp: number) => {
    const parts = partsFormatter.formatToParts(new Date(timestamp));
    const values: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        values[part.type] = Number(part.value);
      }
    }
    const year = requirePart(values.year, 'year');
    const month = requirePart(values.month, 'month');
    const day = requirePart(values.day, 'day');
    const hour = requirePart(values.hour, 'hour');
    const minute = requirePart(values.minute, 'minute');
    const second = requirePart(values.second, 'second');
    return { year, month, day, hour, minute, second };
  };

  const getOffsetMs = (date: Date) => {
    const parts = getDateParts(date.getTime());
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    return asUtc - date.getTime();
  };

  const getDayStartUtc = (year: number, month: number, day: number) => {
    const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
    const offset = getOffsetMs(new Date(utcGuess));
    return utcGuess - offset;
  };

  const splitByDay = (startAt: number, endAt: number) => {
    const segments: { dateKey: string; startAt: number; endAt: number }[] = [];
    let cursor = startAt;
    while (cursor < endAt) {
      const parts = getDateParts(cursor);
      const nextDate = new Date(
        Date.UTC(parts.year, parts.month - 1, parts.day + 1)
      );
      const nextDayStartUtc = getDayStartUtc(
        nextDate.getUTCFullYear(),
        nextDate.getUTCMonth() + 1,
        nextDate.getUTCDate()
      );
      const segmentEnd = Math.min(endAt, nextDayStartUtc);
      segments.push({
        dateKey: getDateKey(cursor),
        startAt: cursor,
        endAt: segmentEnd,
      });
      cursor = segmentEnd;
    }
    return segments;
  };

  return { getDateKey, splitByDay };
}

async function isSessionAlreadyInvoiced(
  ctx: DbCtx,
  companyId: Id<'companies'>,
  sessionId: Id<'sessions'>
): Promise<boolean> {
  const links = await ctx.db
    .query('invoiceSessions')
    .withIndex('by_companyId_sessionId', q =>
      q.eq('companyId', companyId).eq('sessionId', sessionId)
    )
    .filter(q => q.eq(q.field('deletedAt'), null))
    .collect();

  for (const link of links) {
    const invoice = await ctx.db.get(link.invoiceId);
    if (!invoice || invoice.deletedAt !== null) continue;
    if (invoice.status !== 'cancelled') {
      return true;
    }
  }

  return false;
}

async function computeInvoicePreview(
  ctx: DbCtx,
  companyId: Id<'companies'>,
  periodStart: number,
  periodEnd: number,
  timezone: string,
  options?: { sessionIds?: Id<'sessions'>[]; includeAllInRange?: boolean }
) {
  const { splitByDay } = buildDateFormatters(timezone);

  const sessions: Doc<'sessions'>[] = await ctx.db
    .query('sessions')
    .withIndex('by_companyId_deletedAt', q =>
      q.eq('companyId', companyId).eq('deletedAt', null)
    )
    .filter(q => q.eq(q.field('status'), 'FINISHED'))
    .collect();

  const hasSessionFilter = options?.sessionIds !== undefined;
  const sessionIdFilter = hasSessionFilter
    ? new Set(options.sessionIds ?? [])
    : null;
  const includeAll = options?.includeAllInRange ?? !hasSessionFilter;

  const eligibleSessions = sessions.filter((session: Doc<'sessions'>) => {
    if (session.isExcludedFromSummaries) return false;
    if (!session.endAt) return false;
    if (session.endAt <= periodStart) return false;
    if (session.startAt >= periodEnd) return false;
    if (sessionIdFilter && !includeAll && !sessionIdFilter.has(session._id)) {
      return false;
    }
    return true;
  });

  const defaultRateCard = await getDefaultRateCard(ctx, companyId);
  if (!defaultRateCard) {
    throw new Error('Default rate card not configured');
  }

  const sessionSegments = new Map<
    Id<'sessions'>,
    ReturnType<typeof deriveActiveSegments>['segments']
  >();
  const taskIds = new Set<Id<'tasks'>>();

  const excludedSessions: { sessionId: Id<'sessions'>; reason: string }[] = [];
  const conflicts: InvoiceConflict[] = [];

  for (const session of eligibleSessions) {
    if (await isSessionAlreadyInvoiced(ctx, companyId, session._id)) {
      excludedSessions.push({
        sessionId: session._id,
        reason: 'already_invoiced',
      });
      continue;
    }

    const events = await ctx.db
      .query('sessionEvents')
      .withIndex('by_sessionId_timestamp', q => q.eq('sessionId', session._id))
      .collect();

    const { segments } = deriveActiveSegments({
      sessionStatus: session.status,
      sessionStartAt: session.startAt,
      sessionEndAt: session.endAt,
      events,
    });

    if (segments.length === 0) {
      excludedSessions.push({
        sessionId: session._id,
        reason: 'no_task_intervals',
      });
      continue;
    }

    sessionSegments.set(session._id, segments);
    for (const segment of segments) {
      for (const taskId of segment.taskIds) {
        taskIds.add(taskId);
      }
    }
  }

  const tasksById = new Map<
    Id<'tasks'>,
    { _id: Id<'tasks'>; title: string; projectId: Id<'projects'> | null }
  >();
  for (const taskId of taskIds) {
    const task = await ctx.db.get(taskId);
    if (task && task.companyId === companyId) {
      tasksById.set(taskId, {
        _id: task._id,
        title: task.title,
        projectId: task.projectId ?? null,
      });
    }
  }

  const projectIds = new Set<Id<'projects'>>();
  for (const task of tasksById.values()) {
    if (task.projectId) {
      projectIds.add(task.projectId);
    }
  }

  const projectsById = new Map<
    Id<'projects'>,
    { _id: Id<'projects'>; name: string; rateCardId: Id<'rateCards'> | null }
  >();
  for (const projectId of projectIds) {
    const project = await ctx.db.get(projectId);
    if (project && project.companyId === companyId) {
      projectsById.set(projectId, {
        _id: project._id,
        name: project.name,
        rateCardId: project.rateCardId ?? null,
      });
    }
  }

  const rateCardIds = new Set<Id<'rateCards'>>();
  rateCardIds.add(defaultRateCard._id);
  for (const project of projectsById.values()) {
    if (project.rateCardId) {
      rateCardIds.add(project.rateCardId);
    }
  }

  const rateCardsById = new Map<
    Id<'rateCards'>,
    {
      _id: Id<'rateCards'>;
      hourlyRateCents: number;
      currency: string;
      roundingIncrementMinutes: number;
      roundingMode: 'floor' | 'ceil' | 'nearest';
    }
  >();
  for (const rateCardId of rateCardIds) {
    const card = await ctx.db.get(rateCardId);
    if (card && card.companyId === companyId) {
      rateCardsById.set(rateCardId, {
        _id: card._id,
        hourlyRateCents: card.hourlyRateCents,
        currency: card.currency,
        roundingIncrementMinutes: card.roundingIncrementMinutes,
        roundingMode: card.roundingMode,
      });
    }
  }

  const lineMap = new Map<string, InvoiceLineAccum>();
  const includedSessionIds = new Set<Id<'sessions'>>();

  for (const [sessionId, segments] of sessionSegments.entries()) {
    for (const segment of segments) {
      const clampedStart = Math.max(segment.startAt, periodStart);
      const clampedEnd = Math.min(segment.endAt, periodEnd);
      if (clampedStart >= clampedEnd) continue;

      const rateKeys = new Map<string, RateConfig>();
      const taskInfo: {
        taskId: Id<'tasks'>;
        projectId: Id<'projects'>;
        projectName: string;
      }[] = [];

      for (const taskId of segment.taskIds) {
        const task = tasksById.get(taskId);
        if (!task || !task.projectId) continue;
        const project = projectsById.get(task.projectId);
        if (!project) continue;
        const rateCardId = project.rateCardId ?? defaultRateCard._id;
        const rateCard = rateCardsById.get(rateCardId);
        if (!rateCard) continue;

        const rate: RateConfig = {
          rateCents: rateCard.hourlyRateCents,
          currency: rateCard.currency,
          roundingIncrementMinutes: rateCard.roundingIncrementMinutes,
          roundingMode: rateCard.roundingMode,
        };
        rateKeys.set(buildRateKey(rate), rate);
        taskInfo.push({
          taskId,
          projectId: project._id,
          projectName: project.name,
        });
      }

      if (rateKeys.size === 0) {
        continue;
      }

      if (rateKeys.size > 1) {
        conflicts.push({
          sessionId,
          startAt: clampedStart,
          endAt: clampedEnd,
          reason: 'overlap_with_different_rates',
        });
        continue;
      }

      const rate = Array.from(rateKeys.values())[0]!;

      const daySegments = splitByDay(clampedStart, clampedEnd);
      for (const daySeg of daySegments) {
        const lineKey = `${daySeg.dateKey}|${buildRateKey(rate)}`;
        const existing = lineMap.get(lineKey);
        const entry: InvoiceLineAccum = existing ?? {
          date: daySeg.dateKey,
          rate,
          rawDurationMs: 0,
          sessionIds: new Set(),
          tasksByProject: new Map(),
        };

        entry.rawDurationMs += Math.max(0, daySeg.endAt - daySeg.startAt);
        entry.sessionIds.add(sessionId);

        for (const info of taskInfo) {
          const projectEntry = entry.tasksByProject.get(info.projectId) ?? {
            projectName: info.projectName,
            tasks: new Map(),
          };
          const taskTitle = tasksById.get(info.taskId)?.title ?? '';
          if (taskTitle) {
            projectEntry.tasks.set(info.taskId, taskTitle);
          }
          entry.tasksByProject.set(info.projectId, projectEntry);
        }

        lineMap.set(lineKey, entry);
        includedSessionIds.add(sessionId);
      }
    }
  }

  const daysMap = new Map<string, InvoiceDayPayload>();
  let totalMinutes = 0;
  let totalCents = 0;
  const currency = defaultRateCard.currency;

  for (const line of lineMap.values()) {
    const rawMinutes = line.rawDurationMs / 60000;
    const billedMinutes = roundMinutes(
      rawMinutes,
      line.rate.roundingIncrementMinutes,
      line.rate.roundingMode
    );
    const amountCents = Math.round((billedMinutes / 60) * line.rate.rateCents);

    const projects: ProjectTaskGroup[] = Array.from(
      line.tasksByProject.entries()
    )
      .map(([projectId, value]) => ({
        projectId,
        projectName: value.projectName,
        tasks: Array.from(value.tasks.entries()).map(([taskId, title]) => ({
          taskId,
          title,
        })),
      }))
      .sort((a, b) => a.projectName.localeCompare(b.projectName))
      .map(group => ({
        ...group,
        tasks: group.tasks.sort((a, b) => a.title.localeCompare(b.title)),
      }));

    const linePayload: InvoiceLinePayload = {
      rateCents: line.rate.rateCents,
      currency: line.rate.currency,
      roundingIncrementMinutes: line.rate.roundingIncrementMinutes,
      roundingMode: line.rate.roundingMode,
      rawMinutes,
      billedMinutes,
      amountCents,
      projects,
      sessionIds: Array.from(line.sessionIds),
    };

    const dayEntry = daysMap.get(line.date) ?? {
      date: line.date,
      totalMinutes: 0,
      totalCents: 0,
      lines: [],
    };

    dayEntry.lines.push(linePayload);
    dayEntry.totalMinutes += billedMinutes;
    dayEntry.totalCents += amountCents;
    daysMap.set(line.date, dayEntry);

    totalMinutes += billedMinutes;
    totalCents += amountCents;
  }

  const days: InvoiceDayPayload[] = Array.from(daysMap.values())
    .map(day => ({
      ...day,
      lines: day.lines.sort((a, b) =>
        a.rateCents === b.rateCents
          ? a.roundingIncrementMinutes - b.roundingIncrementMinutes
          : a.rateCents - b.rateCents
      ),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    periodStart,
    periodEnd,
    timezone,
    currency,
    sessionIds: Array.from(includedSessionIds),
    totalMinutes,
    totalCents,
    days,
    excludedSessions,
    conflicts,
    canFinalize: conflicts.length === 0,
  };
}

export const preview = query({
  args: {
    companyId: v.id('companies'),
    periodStart: v.number(),
    periodEnd: v.number(),
    sessionIds: v.optional(v.array(v.id('sessions'))),
    includeAllInRange: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_companyId_userId', q =>
        q.eq('companyId', companyId).eq('userId', userId)
      )
      .filter(q => q.eq(q.field('deletedAt'), null))
      .first();

    const timezone = settings?.timezone ?? 'UTC';

    const previewOptions: {
      sessionIds?: Id<'sessions'>[];
      includeAllInRange?: boolean;
    } = {};
    if (args.sessionIds !== undefined) {
      previewOptions.sessionIds = args.sessionIds;
    }
    if (args.includeAllInRange !== undefined) {
      previewOptions.includeAllInRange = args.includeAllInRange;
    }

    return await computeInvoicePreview(
      ctx,
      companyId,
      args.periodStart,
      args.periodEnd,
      timezone,
      Object.keys(previewOptions).length > 0 ? previewOptions : undefined
    );
  },
});

export const create = mutation({
  args: {
    companyId: v.id('companies'),
    periodStart: v.number(),
    periodEnd: v.number(),
    sessionIds: v.optional(v.array(v.id('sessions'))),
    includeAllInRange: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_companyId_userId', q =>
        q.eq('companyId', companyId).eq('userId', userId)
      )
      .filter(q => q.eq(q.field('deletedAt'), null))
      .first();

    const timezone = settings?.timezone ?? 'UTC';

    const previewOptions: {
      sessionIds?: Id<'sessions'>[];
      includeAllInRange?: boolean;
    } = {};
    if (args.sessionIds !== undefined) {
      previewOptions.sessionIds = args.sessionIds;
    }
    if (args.includeAllInRange !== undefined) {
      previewOptions.includeAllInRange = args.includeAllInRange;
    }

    const preview = await computeInvoicePreview(
      ctx,
      companyId,
      args.periodStart,
      args.periodEnd,
      timezone,
      Object.keys(previewOptions).length > 0 ? previewOptions : undefined
    );

    if (!preview.canFinalize) {
      throw new Error('Invoice has rate conflicts; resolve before finalizing.');
    }

    if (preview.sessionIds.length === 0) {
      throw new Error('No billable sessions found for the selected range.');
    }

    const now = Date.now();
    const invoiceId = await ctx.db.insert('invoices', {
      companyId,
      periodStart: preview.periodStart,
      periodEnd: preview.periodEnd,
      timezone: preview.timezone,
      sessionIds: preview.sessionIds,
      currency: preview.currency,
      totalMinutes: preview.totalMinutes,
      totalCents: preview.totalCents,
      status: 'finalized',
      days: preview.days,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    for (const sessionId of preview.sessionIds) {
      await ctx.db.insert('invoiceSessions', {
        companyId,
        invoiceId,
        sessionId,
        createdAt: now,
        deletedAt: null,
      });
    }

    return invoiceId;
  },
});

export const list = query({
  args: { companyId: v.id('companies') },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    return await ctx.db
      .query('invoices')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', companyId).eq('deletedAt', null)
      )
      .collect();
  },
});

export const get = query({
  args: { companyId: v.id('companies'), invoiceId: v.id('invoices') },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const invoice = await ctx.db.get(args.invoiceId);
    assertCompanyScoped(invoice, companyId, 'invoices');
    assertNotDeleted(invoice, 'invoices');
    return invoice;
  },
});

export const listSessions = query({
  args: { companyId: v.id('companies'), invoiceId: v.id('invoices') },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const links = await ctx.db
      .query('invoiceSessions')
      .withIndex('by_invoiceId', q => q.eq('invoiceId', args.invoiceId))
      .filter(q => q.eq(q.field('deletedAt'), null))
      .collect();

    const sessions = [];
    for (const link of links) {
      const session = await ctx.db.get(link.sessionId);
      if (
        session &&
        session.companyId === companyId &&
        session.deletedAt === null
      ) {
        sessions.push(session);
      }
    }
    return sessions;
  },
});

export const cancel = mutation({
  args: { companyId: v.id('companies'), invoiceId: v.id('invoices') },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const invoice = await ctx.db.get(args.invoiceId);
    assertCompanyScoped(invoice, companyId, 'invoices');
    assertNotDeleted(invoice, 'invoices');

    if (invoice.status === 'cancelled') {
      return invoice._id;
    }

    const now = Date.now();
    await ctx.db.patch(invoice._id, {
      status: 'cancelled',
      cancelledAt: now,
      updatedAt: now,
    });

    return invoice._id;
  },
});

export const getCsv = query({
  args: { companyId: v.id('companies'), invoiceId: v.id('invoices') },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const companyId = requireCompanyId(args.companyId);
    await assertCompanyAccess(ctx, companyId, userId);

    const invoice = await ctx.db.get(args.invoiceId);
    assertCompanyScoped(invoice, companyId, 'invoices');
    assertNotDeleted(invoice, 'invoices');

    const rows = [['Date', 'Hours', 'Rate', 'Amount', 'Tasks'].join(',')];

    for (const day of invoice.days) {
      for (const line of day.lines) {
        const hours = (line.billedMinutes / 60).toFixed(2);
        const rate = (line.rateCents / 100).toFixed(2);
        const amount = (line.amountCents / 100).toFixed(2);
        const tasks = line.projects
          .map(group => {
            const taskTitles = group.tasks.map(t => t.title).join('; ');
            return `${group.projectName}: ${taskTitles}`;
          })
          .join(' | ');
        rows.push(
          [
            day.date,
            hours,
            `${line.currency} ${rate}`,
            `${line.currency} ${amount}`,
            `"${tasks.replace(/"/g, '""')}"`,
          ].join(',')
        );
      }
    }

    return rows.join('\n');
  },
});
