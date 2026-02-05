/**
 * Inbox types and schemas for DevSuite
 *
 * Inbox items represent notifications from various sources (GitHub, Notion, internal)
 * and are company-scoped with privacy mode support.
 */

import { z } from 'zod';
import {
  type CompanyId,
  type SoftDeletable,
  type Timestamped,
  companyIdSchema,
  idSchema,
  softDeletableSchema,
  timestampedSchema,
} from './base';

// ============================================================================
// Branded ID Type
// ============================================================================

/**
 * Branded string type for InboxItem IDs
 */
export type InboxItemId = string & { __brand: 'InboxItemId' };

/**
 * Zod schema for InboxItemId
 */
export const inboxItemIdSchema = idSchema.transform(val => val as InboxItemId);

// ============================================================================
// Inbox Item Type Enum
// ============================================================================

/**
 * Types of inbox items
 */
export const inboxItemTypeValues = [
  'notification',
  'pr_review',
  'mention',
  'issue',
  'comment',
  'ci_status',
] as const;

export type InboxItemType = (typeof inboxItemTypeValues)[number];

/**
 * Zod schema for InboxItemType
 */
export const inboxItemTypeSchema = z.enum(inboxItemTypeValues);

// ============================================================================
// Inbox Item Source Enum
// ============================================================================

/**
 * Sources of inbox items
 */
export const inboxItemSourceValues = ['github', 'notion', 'internal'] as const;

export type InboxItemSource = (typeof inboxItemSourceValues)[number];

/**
 * Zod schema for InboxItemSource
 */
export const inboxItemSourceSchema = z.enum(inboxItemSourceValues);

// ============================================================================
// Inbox Item Content
// ============================================================================

/**
 * Content structure for inbox items.
 * Kept flexible to accommodate different source formats.
 */
export type InboxItemContent = {
  /** Title or subject of the notification */
  title: string;
  /** Optional body/description */
  body?: string;
  /** URL to the source item (PR, issue, etc.) */
  url?: string;
  /** External identifier from the source system */
  externalId?: string;
  /**
   * Structured metadata used for automation triggers, filtering, and forward
   * compatibility. Should store external references only (identifiers/links),
   * not mirrored content.
   */
  metadata?: InboxItemMetadata;
};

// ============================================================================
// Inbox Item Metadata (Extensible)
// ============================================================================

/**
 * Related entity for an inbox item (PR, issue, page, task, etc.)
 *
 * The schema is intentionally permissive (passthrough) to support future
 * providers and new entity kinds without a breaking change.
 */
export const inboxItemEntitySchema = z
  .object({
    /** Entity kind identifier (e.g., "pull_request", "page") */
    kind: z.string().min(1),
    /** Provider-specific identifier for the entity */
    externalId: z.string().optional(),
    /** Canonical URL for the entity */
    url: z.string().url().optional(),
    /** Optional repo identifier for GitHub-sourced entities (e.g., "org/repo") */
    repoFullName: z.string().min(1).optional(),
    /** Optional PR number when kind is pull_request */
    prNumber: z.number().int().positive().optional(),
  })
  .passthrough();

export type InboxItemEntity = z.infer<typeof inboxItemEntitySchema>;

/**
 * Event classification for the inbox item.
 *
 * This is the primary "trigger surface" for automations (e.g., review requested,
 * mentioned, commented, assigned).
 */
export const inboxItemEventSchema = z
  .object({
    /** Event kind identifier (e.g., "review_requested", "commented") */
    kind: z.string().min(1),
    /** Actor/login responsible for the event (if known) */
    actor: z.string().optional(),
    /** When the event occurred (unix ms) if known */
    occurredAt: z.number().optional(),
  })
  .passthrough();

export type InboxItemEvent = z.infer<typeof inboxItemEventSchema>;

/**
 * GitHub-specific metadata (thread-level dedupe, reason, etc.)
 */
export const inboxItemGithubMetadataSchema = z
  .object({
    /** Notification thread identifier from GitHub */
    threadId: z.string().min(1).optional(),
    /** GitHub notification "reason" (e.g., "review_requested", "mention") */
    reason: z.string().min(1).optional(),
    /** Repo full name when available (e.g., "org/repo") */
    repoFullName: z.string().min(1).optional(),
    /** Subject type when available (e.g., "PullRequest") */
    subjectType: z.string().min(1).optional(),
    /** Last update timestamp from provider (unix ms or ISO string) */
    updatedAt: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

export type InboxItemGithubMetadata = z.infer<
  typeof inboxItemGithubMetadataSchema
>;

/**
 * Notion-specific metadata (page/comment identifiers, etc.)
 */
export const inboxItemNotionMetadataSchema = z
  .object({
    workspaceId: z.string().min(1).optional(),
    pageId: z.string().min(1).optional(),
    databaseId: z.string().min(1).optional(),
    commentId: z.string().min(1).optional(),
    updatedAt: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

export type InboxItemNotionMetadata = z.infer<
  typeof inboxItemNotionMetadataSchema
>;

/**
 * Inbox item metadata schema (extensible)
 *
 * Uses z.passthrough() to allow additional provider-specific fields for forward
 * compatibility.
 */
export const inboxItemMetadataSchema = z
  .object({
    entity: inboxItemEntitySchema.optional(),
    event: inboxItemEventSchema.optional(),
    github: inboxItemGithubMetadataSchema.optional(),
    notion: inboxItemNotionMetadataSchema.optional(),
  })
  .passthrough();

export type InboxItemMetadata = z.infer<typeof inboxItemMetadataSchema>;

/**
 * Zod schema for InboxItemContent
 */
export const inboxItemContentSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  url: z.string().url().optional(),
  externalId: z.string().optional(),
  metadata: inboxItemMetadataSchema.optional(),
});

// ============================================================================
// Inbox Item Type
// ============================================================================

/**
 * InboxItem represents a notification in the unified inbox.
 *
 * - Company-scoped for tenant isolation
 * - Uses soft delete pattern (deletedAt from SoftDeletable)
 * - Supports read/archive state management
 * - Privacy mode respects isPrivate flag when filtering
 */
export type InboxItem = {
  id: InboxItemId;
  companyId: CompanyId;
  type: InboxItemType;
  source: InboxItemSource;
  content: InboxItemContent;
  /** Whether the item has been read by the user */
  isRead: boolean;
  /** Whether the item has been archived */
  isArchived: boolean;
  /** Whether this item contains sensitive data (for privacy mode filtering) */
  isPrivate: boolean;
} & Timestamped &
  SoftDeletable;

/**
 * Zod schema for InboxItem
 */
export const inboxItemSchema = z
  .object({
    id: inboxItemIdSchema,
    companyId: companyIdSchema,
    type: inboxItemTypeSchema,
    source: inboxItemSourceSchema,
    content: inboxItemContentSchema,
    isRead: z.boolean(),
    isArchived: z.boolean(),
    isPrivate: z.boolean(),
  })
  .merge(timestampedSchema)
  .merge(softDeletableSchema);

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input for creating a new inbox item
 */
export type CreateInboxItemInput = {
  companyId: CompanyId;
  type: InboxItemType;
  source: InboxItemSource;
  content: InboxItemContent;
  /** Defaults to false if not provided */
  isPrivate?: boolean;
};

/**
 * Zod schema for CreateInboxItemInput
 */
export const createInboxItemInputSchema = z.object({
  companyId: companyIdSchema,
  type: inboxItemTypeSchema,
  source: inboxItemSourceSchema,
  content: inboxItemContentSchema,
  isPrivate: z.boolean().optional(),
});

/**
 * Input for updating an inbox item
 */
export type UpdateInboxItemInput = {
  /** Mark as read/unread */
  isRead?: boolean;
  /** Archive/unarchive */
  isArchived?: boolean;
  /** Update privacy flag */
  isPrivate?: boolean;
};

/**
 * Zod schema for UpdateInboxItemInput
 */
export const updateInboxItemInputSchema = z.object({
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
});
