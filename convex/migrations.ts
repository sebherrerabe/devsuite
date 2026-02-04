/**
 * Data backfill migrations for DevSuite.
 *
 * These are intended to be run manually per company.
 */

import { mutation } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { requireCompanyId } from './lib/helpers';
import { ensureDefaultListId } from './projectTaskLists';
import { ensureDefaultProjectId } from './projects';

async function backfillDefaultsForCompanyInternal(
  ctx: MutationCtx,
  companyId: Id<'companies'>
) {
  const defaultProjectId = await ensureDefaultProjectId(ctx, companyId);

  const projects = await ctx.db
    .query('projects')
    .withIndex('by_companyId', q => q.eq('companyId', companyId))
    .collect();

  let projectsUpdated = 0;
  const now = Date.now();

  for (const project of projects) {
    const shouldBeDefault = project._id === defaultProjectId;
    if (project.isDefault !== shouldBeDefault) {
      await ctx.db.patch(project._id, {
        isDefault: shouldBeDefault,
        updatedAt: now,
      });
      projectsUpdated++;
    }
  }

  const defaultListByProject = new Map<
    Id<'projects'>,
    Id<'project_task_lists'>
  >();
  let listsEnsured = 0;

  for (const project of projects) {
    const existingDefault = await ctx.db
      .query('project_task_lists')
      .withIndex('by_projectId_deletedAt', q =>
        q.eq('projectId', project._id).eq('deletedAt', null)
      )
      .filter(q => q.eq(q.field('isDefault'), true))
      .first();

    if (existingDefault) {
      defaultListByProject.set(project._id, existingDefault._id);
    } else {
      const listId = await ensureDefaultListId(ctx, companyId, project._id);
      defaultListByProject.set(project._id, listId);
      listsEnsured++;
    }
  }

  const tasks = await ctx.db
    .query('tasks')
    .withIndex('by_companyId_deletedAt', q =>
      q.eq('companyId', companyId).eq('deletedAt', null)
    )
    .collect();

  let tasksUpdated = 0;
  let tasksAssignedToDefaultProject = 0;
  let tasksReassignedToDefaultList = 0;

  for (const task of tasks) {
    let targetProjectId: Id<'projects'> | null =
      (task.projectId as Id<'projects'> | null) ?? null;
    let targetListId: Id<'project_task_lists'> | null =
      (task.listId as Id<'project_task_lists'> | null) ?? null;

    if (task.parentTaskId) {
      const parent = await ctx.db.get(task.parentTaskId);
      if (parent && parent.companyId === companyId) {
        targetProjectId = parent.projectId ?? targetProjectId;
        targetListId = parent.listId ?? targetListId;
      }
    }

    if (!targetProjectId && targetListId) {
      const list = await ctx.db.get(targetListId);
      if (list && list.companyId === companyId && list.deletedAt === null) {
        targetProjectId = list.projectId;
      }
    }

    if (targetProjectId) {
      const project = await ctx.db.get(targetProjectId);
      if (!project || project.companyId !== companyId) {
        targetProjectId = null;
      }
    }

    if (!targetProjectId) {
      targetProjectId = defaultProjectId;
      tasksAssignedToDefaultProject++;
    }

    let defaultListId = defaultListByProject.get(targetProjectId);
    if (!defaultListId) {
      defaultListId = await ensureDefaultListId(
        ctx,
        companyId,
        targetProjectId
      );
      defaultListByProject.set(targetProjectId, defaultListId);
      listsEnsured++;
    }
    if (!defaultListId) {
      throw new Error('Default list could not be resolved');
    }

    let listIsValid = false;
    if (targetListId) {
      const list = await ctx.db.get(targetListId);
      if (
        list &&
        list.companyId === companyId &&
        list.deletedAt === null &&
        list.projectId === targetProjectId
      ) {
        listIsValid = true;
      }
    }

    const resolvedListId =
      listIsValid && targetListId ? targetListId : defaultListId;
    if (!resolvedListId) {
      throw new Error('Resolved list could not be determined');
    }
    if (!listIsValid) {
      tasksReassignedToDefaultList++;
    }

    if (task.projectId !== targetProjectId || task.listId !== resolvedListId) {
      await ctx.db.patch(task._id, {
        projectId: targetProjectId,
        listId: resolvedListId,
        updatedAt: Date.now(),
      });
      tasksUpdated++;
    }
  }

  return {
    defaultProjectId,
    projectsUpdated,
    listsEnsured,
    tasksUpdated,
    tasksAssignedToDefaultProject,
    tasksReassignedToDefaultList,
  };
}

export const backfillDefaultsForCompany = mutation({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    return await backfillDefaultsForCompanyInternal(ctx, companyId);
  },
});

export const backfillDefaultsAllCompanies = mutation({
  args: {},
  handler: async ctx => {
    if (process.env.MIGRATION_ALLOW_ALL !== 'true') {
      throw new Error(
        'MIGRATION_ALLOW_ALL is not enabled for this deployment.'
      );
    }

    const companies = await ctx.db.query('companies').collect();
    const activeCompanies = companies.filter(company => !company.isDeleted);

    const results: Record<
      Id<'companies'>,
      Awaited<ReturnType<typeof backfillDefaultsForCompanyInternal>>
    > = {};

    for (const company of activeCompanies) {
      results[company._id] = await backfillDefaultsForCompanyInternal(
        ctx,
        company._id
      );
    }

    return {
      companyCount: activeCompanies.length,
      results,
    };
  },
});
