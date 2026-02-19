/**
 * Pure eligibility logic for inbox push delivery.
 * Used for regression tests on read/archive/forceNotify semantics.
 */

export interface InboxItemForEligibility {
  isRead: boolean;
  isArchived: boolean;
}

/** Item shape from push query - may include extra fields */
export type InboxItemLike = InboxItemForEligibility | null;

/**
 * Determines if an item is eligible for push delivery.
 * - Archived items: never eligible
 * - Read items: eligible only when forceNotify is true (update-triggered notify)
 * - Unread items: eligible when forceNotify is false or true
 */
export function isItemEligibleForPush(
  item: InboxItemLike,
  forceNotify: boolean
): boolean {
  if (!item) {
    return false;
  }

  if (item.isArchived) {
    return false;
  }

  if (!forceNotify && item.isRead) {
    return false;
  }

  return true;
}
