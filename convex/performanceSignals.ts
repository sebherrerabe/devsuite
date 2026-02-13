/**
 * Performance signal functions for DevSuite.
 *
 * This module provides:
 * - Raw performance signal ingestion (company-scoped)
 * - Raw performance signal listing
 * - A dashboard metrics query derived from sessions/tasks/reviews
 */

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { assertCompanyScoped, requireCompanyId } from './lib/helpers';
import { deriveActiveSegments } from './lib/sessionIntervals';
import { countContextSwitchesFromTaskActivations } from './lib/performanceMetrics';
import { insertPerformanceSignal } from './lib/performanceSignalIngestion';
import {
  DAY_MS,
  resolveDashboardRange,
  splitIntervalByUtcDay,
  toUtcDayKey,
  toUtcDayStart,
} from './lib/performanceDashboard';

type DailyMetrics = {
  date: string;
  focusMs: number;
  sessions: number;
  completedTasks: number;
  prReviews: number;
  contextSwitches: number;
};

type ProjectMetricsAccumulator = {
  projectId: Id<'projects'>;
  name: string;
  focusMs: number;
  sessionIds: Set<Id<'sessions'>>;
};

function createDailyMetricsMap(startAt: number, endAt: number) {
  const dailyMap = new Map<string, DailyMetrics>();
  let cursor = toUtcDayStart(startAt);

  while (cursor < endAt) {
    const date = toUtcDayKey(cursor);
    dailyMap.set(date, {
      date,
      focusMs: 0,
      sessions: 0,
      completedTasks: 0,
      prReviews: 0,
      contextSwitches: 0,
    });
    cursor += DAY_MS;
  }

  return dailyMap;
}

function addToDailyMap(
  dailyMap: Map<string, DailyMetrics>,
  timestamp: number,
  field:
    | 'sessions'
    | 'completedTasks'
    | 'prReviews'
    | 'contextSwitches'
    | 'focusMs',
  amount: number
) {
  const dayKey = toUtcDayKey(timestamp);
  const existing = dailyMap.get(dayKey);
  if (!existing) return;
  existing[field] += amount;
}

function addDaySetSessionCount(
  dailyMap: Map<string, DailyMetrics>,
  startAt: number,
  endAt: number
) {
  const touchedDays = new Set(
    splitIntervalByUtcDay(startAt, endAt).map(segment => segment.date)
  );

  for (const day of touchedDays) {
    const metrics = dailyMap.get(day);
    if (metrics) {
      metrics.sessions += 1;
    }
  }
}

function pushProjectFocus(
  projectFocusMap: Map<Id<'projects'>, ProjectMetricsAccumulator>,
  args: {
    projectId: Id<'projects'>;
    projectName: string;
    focusMs: number;
    sessionId: Id<'sessions'>;
  }
) {
  const existing = projectFocusMap.get(args.projectId);
  if (existing) {
    existing.focusMs += args.focusMs;
    existing.sessionIds.add(args.sessionId);
    return;
  }

  projectFocusMap.set(args.projectId, {
    projectId: args.projectId,
    name: args.projectName,
    focusMs: args.focusMs,
    sessionIds: new Set([args.sessionId]),
  });
}

export const createSignal = mutation({
  args: {
    companyId: v.id('companies'),
    type: v.union(
      v.literal('time_per_task'),
      v.literal('context_switches'),
      v.literal('session_duration'),
      v.literal('tasks_completed'),
      v.literal('focus_time'),
      v.literal('break_time'),
      v.literal('code_changes'),
      v.literal('pr_reviews_completed')
    ),
    value: v.number(),
    entityType: v.union(
      v.literal('task'),
      v.literal('session'),
      v.literal('project')
    ),
    entityId: v.string(),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);

    if (args.entityType === 'project') {
      const project = await ctx.db.get(args.entityId as Id<'projects'>);
      assertCompanyScoped(project, companyId, 'projects');
    } else if (args.entityType === 'task') {
      const task = await ctx.db.get(args.entityId as Id<'tasks'>);
      assertCompanyScoped(task, companyId, 'tasks');
    } else if (args.entityType === 'session') {
      const session = await ctx.db.get(args.entityId as Id<'sessions'>);
      assertCompanyScoped(session, companyId, 'sessions');
    }

    return await insertPerformanceSignal(ctx, {
      companyId,
      type: args.type,
      value: args.value,
      entityType: args.entityType,
      entityId: args.entityId,
      ...(args.timestamp !== undefined ? { timestamp: args.timestamp } : {}),
    });
  },
});

export const listSignals = query({
  args: {
    companyId: v.id('companies'),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    type: v.optional(
      v.union(
        v.literal('time_per_task'),
        v.literal('context_switches'),
        v.literal('session_duration'),
        v.literal('tasks_completed'),
        v.literal('focus_time'),
        v.literal('break_time'),
        v.literal('code_changes'),
        v.literal('pr_reviews_completed')
      )
    ),
    entityType: v.optional(
      v.union(v.literal('task'), v.literal('session'), v.literal('project'))
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const now = Date.now();
    const { startAt, endAt } = resolveDashboardRange(
      args.startDate,
      args.endDate,
      now
    );
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 200), 1), 500);

    const signals = await ctx.db
      .query('performanceSignals')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', companyId).eq('deletedAt', null)
      )
      .collect();

    return signals
      .filter(signal => {
        if (signal.timestamp < startAt || signal.timestamp >= endAt) {
          return false;
        }
        if (args.type && signal.type !== args.type) {
          return false;
        }
        if (args.entityType && signal.entityType !== args.entityType) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },
});

export const getDashboardMetrics = query({
  args: {
    companyId: v.id('companies'),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    projectId: v.optional(v.id('projects')),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const now = Date.now();
    const { startAt, endAt } = resolveDashboardRange(
      args.startDate,
      args.endDate,
      now
    );

    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      assertCompanyScoped(project, companyId, 'projects');
    }

    const dailyMap = createDailyMetricsMap(startAt, endAt);

    const projects = await ctx.db
      .query('projects')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', companyId).eq('deletedAt', null)
      )
      .collect();
    const projectById = new Map(
      projects.map(project => [project._id, project])
    );

    const repositories = await ctx.db
      .query('repositories')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', companyId).eq('deletedAt', null)
      )
      .collect();
    const repositoryById = new Map(
      repositories.map(repository => [repository._id, repository])
    );

    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', companyId).eq('deletedAt', null)
      )
      .collect();
    const taskById = new Map(tasks.map(task => [task._id, task]));

    const completedTasks = tasks.filter(task => {
      if (task.status !== 'done') return false;
      if (task.updatedAt < startAt || task.updatedAt >= endAt) return false;
      if (args.projectId && task.projectId !== args.projectId) return false;
      return true;
    });

    for (const task of completedTasks) {
      addToDailyMap(dailyMap, task.updatedAt, 'completedTasks', 1);
    }

    const reviews = await ctx.db
      .query('prReviews')
      .withIndex('by_companyId_deletedAt_createdAt', q =>
        q.eq('companyId', companyId).eq('deletedAt', null)
      )
      .collect();

    const prReviews = reviews.filter(review => {
      if (review.createdAt < startAt || review.createdAt >= endAt) return false;
      if (!args.projectId) return true;
      if (!review.taskId) return false;
      const reviewTask = taskById.get(review.taskId);
      return reviewTask?.projectId === args.projectId;
    });

    for (const review of prReviews) {
      addToDailyMap(dailyMap, review.createdAt, 'prReviews', 1);
    }

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', companyId).eq('deletedAt', null)
      )
      .collect();

    const projectFocusMap = new Map<
      Id<'projects'>,
      ProjectMetricsAccumulator
    >();
    const taskFocusMs = new Map<Id<'tasks'>, number>();

    let totalFocusMs = 0;
    let totalSessionDurationMs = 0;
    let sessionCount = 0;
    let contextSwitchCount = 0;

    for (const session of sessions) {
      if (session.isExcludedFromSummaries) continue;
      if (args.projectId && !session.projectIds.includes(args.projectId)) {
        continue;
      }

      const sessionEndAt = session.endAt ?? now;
      const clampedStart = Math.max(startAt, session.startAt);
      const clampedEnd = Math.min(endAt, sessionEndAt);
      if (clampedStart >= clampedEnd) continue;

      sessionCount += 1;
      totalSessionDurationMs += clampedEnd - clampedStart;
      addDaySetSessionCount(dailyMap, clampedStart, clampedEnd);

      const events = await ctx.db
        .query('sessionEvents')
        .withIndex('by_sessionId_timestamp', q =>
          q.eq('sessionId', session._id)
        )
        .order('asc')
        .collect();

      const contextSwitches = countContextSwitchesFromTaskActivations(events, {
        startAt,
        endAt,
        allowTask: taskId => {
          if (!args.projectId) {
            return true;
          }
          const task = taskById.get(taskId);
          return task?.projectId === args.projectId;
        },
      });
      contextSwitchCount += contextSwitches.count;
      for (const timestamp of contextSwitches.switchTimestamps) {
        addToDailyMap(dailyMap, timestamp, 'contextSwitches', 1);
      }

      const { segments } = deriveActiveSegments({
        sessionStatus: session.status,
        sessionStartAt: session.startAt,
        sessionEndAt: session.endAt,
        events,
        nowMs: now,
      });

      for (const segment of segments) {
        const segmentStart = Math.max(segment.startAt, startAt);
        const segmentEnd = Math.min(segment.endAt, endAt);
        if (segmentStart >= segmentEnd) continue;

        const scopedTaskIds = Array.from(
          new Set(
            segment.taskIds.filter(taskId => {
              const task = taskById.get(taskId);
              if (!task) return false;
              if (args.projectId && task.projectId !== args.projectId) {
                return false;
              }
              return true;
            })
          )
        );

        if (scopedTaskIds.length === 0) {
          continue;
        }

        const durationMs = segmentEnd - segmentStart;
        totalFocusMs += durationMs;

        const perTaskFocusMs = durationMs / scopedTaskIds.length;
        for (const taskId of scopedTaskIds) {
          const previous = taskFocusMs.get(taskId) ?? 0;
          taskFocusMs.set(taskId, previous + perTaskFocusMs);
        }

        const projectIds = Array.from(
          new Set(
            scopedTaskIds
              .map(taskId => taskById.get(taskId)?.projectId ?? null)
              .filter((projectId): projectId is Id<'projects'> => !!projectId)
          )
        );

        if (projectIds.length > 0) {
          const perProjectFocusMs = durationMs / projectIds.length;
          for (const projectId of projectIds) {
            const project = projectById.get(projectId);
            if (!project) continue;
            pushProjectFocus(projectFocusMap, {
              projectId,
              projectName: project.name,
              focusMs: perProjectFocusMs,
              sessionId: session._id,
            });
          }
        }

        for (const daySegment of splitIntervalByUtcDay(
          segmentStart,
          segmentEnd
        )) {
          const dayMetrics = dailyMap.get(daySegment.date);
          if (!dayMetrics) continue;
          dayMetrics.focusMs += daySegment.durationMs;
        }
      }
    }

    const topProjects = Array.from(projectFocusMap.values())
      .sort((a, b) => b.focusMs - a.focusMs)
      .slice(0, 8)
      .map(project => ({
        projectId: project.projectId,
        name: project.name,
        focusMinutes: Math.round(project.focusMs / 60000),
        sessionCount: project.sessionIds.size,
      }));

    const daily = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(day => ({
        date: day.date,
        focusMinutes: Math.round(day.focusMs / 60000),
        sessions: day.sessions,
        completedTasks: day.completedTasks,
        prReviews: day.prReviews,
        contextSwitches: day.contextSwitches,
      }));

    let totalComplexityPoints = 0;
    let totalFocusedMinutesOnScoredTasks = 0;
    const complexityRows = Array.from(taskFocusMs.entries())
      .map(([taskId, focusMs]) => {
        const task = taskById.get(taskId);
        if (!task || task.complexityScore === null) {
          return null;
        }

        const projectName =
          task.projectId && projectById.get(task.projectId)
            ? (projectById.get(task.projectId)?.name ?? 'Unknown project')
            : 'No project';

        const focusMinutes = Math.round(focusMs / 60000);
        totalComplexityPoints += task.complexityScore;
        totalFocusedMinutesOnScoredTasks += focusMinutes;

        return {
          taskId,
          title: task.title,
          status: task.status,
          projectName,
          complexityScore: task.complexityScore,
          focusMinutes,
          minutesPerPoint:
            task.complexityScore > 0
              ? Number((focusMinutes / task.complexityScore).toFixed(2))
              : null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.focusMinutes - a.focusMinutes)
      .slice(0, 20);

    const reviewCountsByRepository = new Map<Id<'repositories'>, number>();
    let linkedToTaskCount = 0;
    const reviewDays = new Set<string>();

    for (const review of prReviews) {
      reviewDays.add(toUtcDayKey(review.createdAt));
      if (review.taskId) {
        linkedToTaskCount += 1;
      }
      const previous = reviewCountsByRepository.get(review.repositoryId) ?? 0;
      reviewCountsByRepository.set(review.repositoryId, previous + 1);
    }

    const reviewByRepository = Array.from(reviewCountsByRepository.entries())
      .map(([repositoryId, count]) => ({
        repositoryId,
        repositoryName:
          repositoryById.get(repositoryId)?.name ?? 'Unknown repository',
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      range: {
        startAt,
        endAt,
      },
      summary: {
        sessionCount,
        completedTaskCount: completedTasks.length,
        prReviewCount: prReviews.length,
        contextSwitchCount,
        totalFocusMinutes: Math.round(totalFocusMs / 60000),
        averageSessionMinutes:
          sessionCount > 0
            ? Math.round(totalSessionDurationMs / sessionCount / 60000)
            : 0,
      },
      daily,
      topProjects,
      complexityEffort: {
        totalComplexityPoints,
        totalFocusedMinutesOnScoredTasks,
        averageMinutesPerComplexityPoint:
          totalComplexityPoints > 0
            ? Number(
                (
                  totalFocusedMinutesOnScoredTasks / totalComplexityPoints
                ).toFixed(2)
              )
            : 0,
        rows: complexityRows,
      },
      reviewLoad: {
        totalReviews: prReviews.length,
        linkedToTaskCount,
        unlinkedCount: prReviews.length - linkedToTaskCount,
        activeDays: reviewDays.size,
        averageReviewsPerActiveDay:
          reviewDays.size > 0
            ? Number((prReviews.length / reviewDays.size).toFixed(2))
            : 0,
        byRepository: reviewByRepository,
      },
    };
  },
});
