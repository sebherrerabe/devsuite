/**
 * Convex schema definition for DevSuite
 *
 * This schema enforces DevSuite's core invariants:
 * - Company scoping: All work entities belong to a company
 * - Soft delete: No hard deletes; use deletedAt timestamps
 * - External refs only: Store identifiers/URLs, never mirror content
 */

import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // ============================================================================
  // Root Entity: Companies
  // ============================================================================

  /**
   * Company entities - root tenant boundary
   * Companies themselves are not company-scoped (they are the root)
   */
  companies: defineTable({
    name: v.string(),
    userId: v.string(),
    isDeleted: v.boolean(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_deletedAt', ['deletedAt'])
    .index('by_createdAt', ['createdAt'])
    .index('by_userId', ['userId']),

  // ============================================================================
  // Company-Scoped Entities
  // ============================================================================

  /**
   * Repository entities - company-scoped, external references only
   */
  repositories: defineTable({
    companyId: v.id('companies'),
    name: v.string(),
    url: v.string(),
    provider: v.union(
      v.literal('github'),
      v.literal('gitlab'),
      v.literal('bitbucket'),
      v.literal('azure_devops'),
      v.literal('other')
    ),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_companyId', ['companyId'])
    .index('by_companyId_deletedAt', ['companyId', 'deletedAt'])
    .index('by_url', ['url']),

  /**
   * Project entities - company-scoped, can link to repositories
   */
  projects: defineTable({
    companyId: v.id('companies'),
    name: v.string(),
    description: v.optional(v.string()),
    repositoryIds: v.array(v.id('repositories')),
    metadata: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_companyId', ['companyId'])
    .index('by_companyId_deletedAt', ['companyId', 'deletedAt']),
  // Note: Cannot index array fields directly. To query projects by repositoryId,
  // use a filter query: .filter(q => q.field('repositoryIds').includes(repositoryId))

  /**
   * Task entities - company-scoped via project, supports hierarchy
   */
  tasks: defineTable({
    projectId: v.id('projects'),
    parentTaskId: v.optional(v.id('tasks')),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal('todo'),
      v.literal('in_progress'),
      v.literal('blocked'),
      v.literal('done'),
      v.literal('cancelled')
    ),
    complexity: v.optional(
      v.union(
        v.literal('trivial'),
        v.literal('small'),
        v.literal('medium'),
        v.literal('large'),
        v.literal('epic')
      )
    ),
    tags: v.array(v.string()),
    externalLinks: v.array(
      v.object({
        type: v.union(
          v.literal('github_pr'),
          v.literal('github_issue'),
          v.literal('notion'),
          v.literal('ticktick'),
          v.literal('url')
        ),
        identifier: v.string(),
        url: v.string(),
      })
    ),
    metadata: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_projectId', ['projectId'])
    .index('by_projectId_deletedAt', ['projectId', 'deletedAt'])
    .index('by_parentTaskId', ['parentTaskId'])
    .index('by_status', ['status']),

  /**
   * Session entities - company-scoped work sessions
   */
  sessions: defineTable({
    companyId: v.id('companies'),
    startTime: v.number(),
    endTime: v.union(v.number(), v.null()),
    summary: v.union(v.string(), v.null()),
    taskIds: v.array(v.id('tasks')),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_companyId', ['companyId'])
    .index('by_companyId_deletedAt', ['companyId', 'deletedAt'])
    .index('by_startTime', ['startTime'])
    .index('by_endTime', ['endTime']),

  /**
   * SessionTask junction - links sessions to tasks with metadata
   */
  sessionTasks: defineTable({
    sessionId: v.id('sessions'),
    taskId: v.id('tasks'),
    notes: v.union(v.string(), v.null()),
    timeDistribution: v.union(v.number(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_sessionId', ['sessionId'])
    .index('by_taskId', ['taskId'])
    .index('by_sessionId_deletedAt', ['sessionId', 'deletedAt'])
    .index('by_taskId_deletedAt', ['taskId', 'deletedAt']),

  /**
   * InboxItem entities - company-scoped notifications
   */
  inboxItems: defineTable({
    companyId: v.id('companies'),
    type: v.union(
      v.literal('notification'),
      v.literal('pr_review'),
      v.literal('mention'),
      v.literal('issue'),
      v.literal('comment'),
      v.literal('ci_status')
    ),
    source: v.union(
      v.literal('github'),
      v.literal('notion'),
      v.literal('internal')
    ),
    content: v.object({
      title: v.string(),
      body: v.optional(v.string()),
      url: v.optional(v.string()),
      externalId: v.optional(v.string()),
      metadata: v.optional(v.any()),
    }),
    isRead: v.boolean(),
    isArchived: v.boolean(),
    isPrivate: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_companyId', ['companyId'])
    .index('by_companyId_deletedAt', ['companyId', 'deletedAt'])
    .index('by_companyId_isRead', ['companyId', 'isRead'])
    .index('by_companyId_isArchived', ['companyId', 'isArchived'])
    .index('by_companyId_isPrivate', ['companyId', 'isPrivate']),

  /**
   * PRReview entities - company-scoped PR review artifacts
   */
  prReviews: defineTable({
    companyId: v.id('companies'),
    repositoryId: v.id('repositories'),
    prIdentifier: v.string(),
    prUrl: v.string(),
    prTitle: v.optional(v.string()),
    content: v.string(),
    metadata: v.optional(
      v.object({
        riskAreas: v.optional(
          v.array(
            v.union(
              v.literal('security'),
              v.literal('performance'),
              v.literal('data_integrity'),
              v.literal('breaking_change'),
              v.literal('test_coverage'),
              v.literal('code_complexity'),
              v.literal('dependency'),
              v.literal('configuration'),
              v.literal('other')
            )
          )
        ),
        redFlags: v.optional(
          v.array(
            v.object({
              area: v.union(
                v.literal('security'),
                v.literal('performance'),
                v.literal('data_integrity'),
                v.literal('breaking_change'),
                v.literal('test_coverage'),
                v.literal('code_complexity'),
                v.literal('dependency'),
                v.literal('configuration'),
                v.literal('other')
              ),
              severity: v.union(
                v.literal('low'),
                v.literal('medium'),
                v.literal('high'),
                v.literal('critical')
              ),
              description: v.string(),
              filePath: v.optional(v.string()),
              lineReference: v.optional(v.string()),
            })
          )
        ),
        riskScore: v.optional(v.number()),
        highlights: v.optional(v.array(v.string())),
        suggestions: v.optional(v.array(v.string())),
        filesAnalyzed: v.optional(v.array(v.string())),
        linesAdded: v.optional(v.number()),
        linesRemoved: v.optional(v.number()),
        generatedBy: v.optional(v.string()),
        model: v.optional(v.string()),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_companyId', ['companyId'])
    .index('by_companyId_deletedAt', ['companyId', 'deletedAt'])
    .index('by_repositoryId', ['repositoryId'])
    .index('by_repositoryId_deletedAt', ['repositoryId', 'deletedAt'])
    .index('by_prIdentifier', ['prIdentifier']),

  /**
   * PerformanceSignal entities - company-scoped performance metrics
   */
  performanceSignals: defineTable({
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
    entityId: v.string(), // Generic ID (can be task, session, or project ID)
    timestamp: v.number(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_companyId', ['companyId'])
    .index('by_companyId_deletedAt', ['companyId', 'deletedAt'])
    .index('by_entityType_entityId', ['entityType', 'entityId'])
    .index('by_timestamp', ['timestamp'])
    .index('by_type', ['type']),

  /**
   * Invoice entities - company-scoped billing records
   */
  invoices: defineTable({
    companyId: v.id('companies'),
    periodStart: v.number(),
    periodEnd: v.number(),
    sessionIds: v.array(v.id('sessions')),
    rateCardId: v.id('rateCards'),
    totalMinutes: v.number(),
    totalCents: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal('draft'),
      v.literal('sent'),
      v.literal('paid'),
      v.literal('voided')
    ),
    notes: v.union(v.string(), v.null()),
    invoiceNumber: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_companyId', ['companyId'])
    .index('by_companyId_deletedAt', ['companyId', 'deletedAt'])
    .index('by_status', ['status'])
    .index('by_periodStart', ['periodStart'])
    .index('by_rateCardId', ['rateCardId']),

  /**
   * RateCard entities - company-scoped billing rate configurations
   */
  rateCards: defineTable({
    companyId: v.id('companies'),
    name: v.string(),
    hourlyRateCents: v.number(),
    currency: v.string(),
    description: v.union(v.string(), v.null()),
    isDefault: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_companyId', ['companyId'])
    .index('by_companyId_deletedAt', ['companyId', 'deletedAt'])
    .index('by_companyId_isDefault', ['companyId', 'isDefault']),
});
