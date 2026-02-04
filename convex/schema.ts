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
   *
   * Projects support:
   * - UX fields: slug (auto-generated), color, isFavorite, isPinned
   * - Defaults: one project per company can be marked as default
   * - Docs: notesMarkdown (optional markdown scratchpad)
   * - Name uniqueness enforced per company (case-insensitive)
   */
  projects: defineTable({
    companyId: v.id('companies'),
    name: v.string(),
    description: v.optional(v.string()),
    repositoryIds: v.array(v.id('repositories')),
    // UX fields
    slug: v.optional(v.string()), // Auto-generated from name on create
    color: v.optional(v.string()), // Color label for UI
    emoji: v.optional(v.string()), // Emoji or :shortcode: identifier
    isFavorite: v.optional(v.boolean()), // Favorite flag
    isPinned: v.optional(v.boolean()), // Pinned flag for list view
    isDefault: v.optional(v.boolean()), // Default project for company (cannot be deleted)
    // Docs
    notesMarkdown: v.union(v.string(), v.null()), // Optional markdown notes scratchpad
    metadata: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_companyId', ['companyId'])
    .index('by_companyId_deletedAt', ['companyId', 'deletedAt']),
  // Note: Cannot index array fields directly. To query projects by repositoryId,
  // use a filter query: .filter(q => q.field('repositoryIds').includes(repositoryId))
  // Note: Name uniqueness is enforced in functions via query + filter (case-insensitive comparison)

  /**
   * Task entities - company-scoped, supports hierarchy
   * Tasks are always project-scoped (projectId required)
   * Parent/child relationships must maintain same project and list scope
   */
  tasks: defineTable({
    companyId: v.id('companies'),
    projectId: v.optional(v.union(v.id('projects'), v.null())),
    listId: v.optional(v.union(v.id('project_task_lists'), v.null())),
    parentTaskId: v.union(v.id('tasks'), v.null()),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal('todo'),
      v.literal('in_progress'),
      v.literal('blocked'),
      v.literal('done'),
      v.literal('cancelled')
    ),
    /** Fractional indexing / LexoRank-style string for ordering siblings */
    sortKey: v.string(),
    /** Due date as Unix timestamp in milliseconds (null if no due date) */
    dueDate: v.union(v.number(), v.null()),
    /** Complexity score: integer 1-10 (null if not set) */
    complexityScore: v.union(v.number(), v.null()),
    /** Markdown notes/scratchpad */
    notesMarkdown: v.union(v.string(), v.null()),
    /** References to company-managed tags */
    tagIds: v.array(v.id('tags')),
    metadata: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_companyId', ['companyId'])
    .index('by_companyId_deletedAt', ['companyId', 'deletedAt'])
    .index('by_projectId', ['projectId'])
    .index('by_projectId_deletedAt', ['projectId', 'deletedAt'])
    .index('by_parentTaskId', ['parentTaskId'])
    .index('by_status', ['status'])
    .index('by_companyId_projectId_deletedAt', [
      'companyId',
      'projectId',
      'deletedAt',
    ])
    .index('by_companyId_parentTaskId_deletedAt', [
      'companyId',
      'parentTaskId',
      'deletedAt',
    ])
    .index('by_companyId_projectId_parentTaskId_deletedAt', [
      'companyId',
      'projectId',
      'parentTaskId',
      'deletedAt',
    ])
    .index('by_companyId_projectId_listId_deletedAt', [
      'companyId',
      'projectId',
      'listId',
      'deletedAt',
    ])
    .index('by_companyId_projectId_listId_parentTaskId_deletedAt', [
      'companyId',
      'projectId',
      'listId',
      'parentTaskId',
      'deletedAt',
    ]),

  /**
   * Project task lists - user-defined list sections within a project
   * Project-only, company-scoped
   */
  project_task_lists: defineTable({
    companyId: v.id('companies'),
    projectId: v.id('projects'),
    name: v.string(),
    sortKey: v.string(),
    isDefault: v.boolean(),
    metadata: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_companyId', ['companyId'])
    .index('by_companyId_deletedAt', ['companyId', 'deletedAt'])
    .index('by_projectId', ['projectId'])
    .index('by_projectId_deletedAt', ['projectId', 'deletedAt']),

  /**
   * Tag entities - company-scoped managed tag set
   * Tags are managed per company to enable consistent naming and future renames
   */
  tags: defineTable({
    companyId: v.id('companies'),
    name: v.string(),
    color: v.union(v.string(), v.null()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_companyId', ['companyId'])
    .index('by_companyId_deletedAt', ['companyId', 'deletedAt'])
    .index('by_companyId_name_deletedAt', ['companyId', 'name', 'deletedAt']),

  /**
   * External link entities - normalized table for task external references
   * Stores user-provided titles (MVP); later can be fetched via integrations
   */
  external_links: defineTable({
    companyId: v.id('companies'),
    taskId: v.id('tasks'),
    type: v.union(
      v.literal('github_pr'),
      v.literal('github_issue'),
      v.literal('notion'),
      v.literal('ticktick'),
      v.literal('url')
    ),
    url: v.string(),
    /** User-provided title (required in MVP) */
    title: v.string(),
    identifier: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_companyId', ['companyId'])
    .index('by_companyId_deletedAt', ['companyId', 'deletedAt'])
    .index('by_taskId', ['taskId'])
    .index('by_taskId_deletedAt', ['taskId', 'deletedAt'])
    .index('by_companyId_taskId_deletedAt', [
      'companyId',
      'taskId',
      'deletedAt',
    ]),

  /**
   * Session entities - company-scoped work sessions (event-sourced)
   */
  sessions: defineTable({
    companyId: v.id('companies'),
    createdBy: v.string(),
    status: v.union(
      v.literal('RUNNING'),
      v.literal('PAUSED'),
      v.literal('FINISHED'),
      v.literal('CANCELLED')
    ),
    startAt: v.number(),
    endAt: v.union(v.number(), v.null()),
    cancelMode: v.union(
      v.literal('DISCARD'),
      v.literal('KEEP_EXCLUDED'),
      v.null()
    ),
    cancelledAt: v.union(v.number(), v.null()),
    discardedAt: v.union(v.number(), v.null()),
    summary: v.union(v.string(), v.null()),
    projectIds: v.array(v.id('projects')),
    isExcludedFromSummaries: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index('by_companyId', ['companyId'])
    .index('by_companyId_deletedAt', ['companyId', 'deletedAt'])
    .index('by_companyId_status_deletedAt', [
      'companyId',
      'status',
      'deletedAt',
    ])
    .index('by_companyId_createdBy_status_deletedAt', [
      'companyId',
      'createdBy',
      'status',
      'deletedAt',
    ])
    .index('by_companyId_startAt', ['companyId', 'startAt'])
    .index('by_companyId_endAt', ['companyId', 'endAt']),

  /**
   * Session events - append-only event log
   */
  sessionEvents: defineTable({
    companyId: v.id('companies'),
    sessionId: v.id('sessions'),
    actorId: v.string(),
    type: v.union(
      v.literal('SESSION_STARTED'),
      v.literal('SESSION_PAUSED'),
      v.literal('SESSION_RESUMED'),
      v.literal('SESSION_FINISHED'),
      v.literal('SESSION_CANCELLED'),
      v.literal('TASK_ACTIVATED'),
      v.literal('TASK_DEACTIVATED'),
      v.literal('TASK_MARKED_DONE'),
      v.literal('TASK_RESET'),
      v.literal('STEP_LOGGED'),
      v.literal('PROJECT_ASSIGNED_TO_SESSION'),
      v.literal('PROJECT_UNASSIGNED_FROM_SESSION')
    ),
    taskId: v.optional(v.union(v.id('tasks'), v.null())),
    projectId: v.optional(v.union(v.id('projects'), v.null())),
    timestamp: v.number(),
    clientTimestamp: v.optional(v.union(v.number(), v.null())),
    payload: v.any(),
    createdAt: v.number(),
  })
    .index('by_companyId', ['companyId'])
    .index('by_sessionId', ['sessionId'])
    .index('by_sessionId_timestamp', ['sessionId', 'timestamp'])
    .index('by_companyId_taskId_timestamp', [
      'companyId',
      'taskId',
      'timestamp',
    ])
    .index('by_companyId_projectId_timestamp', [
      'companyId',
      'projectId',
      'timestamp',
    ])
    .index('by_companyId_timestamp', ['companyId', 'timestamp']),

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
