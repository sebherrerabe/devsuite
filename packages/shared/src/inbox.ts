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
  /** Additional metadata from source system */
  metadata?: Record<string, unknown>;
};

/**
 * Zod schema for InboxItemContent
 */
export const inboxItemContentSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  url: z.string().url().optional(),
  externalId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
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
