import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isItemEligibleForPush,
  type InboxItemForEligibility,
} from './inboxPushEligibility.js';

test('isItemEligibleForPush: null item => false', () => {
  assert.equal(isItemEligibleForPush(null, false), false);
  assert.equal(isItemEligibleForPush(null, true), false);
});

test('isItemEligibleForPush: archived => false', () => {
  const item: InboxItemForEligibility = { isRead: false, isArchived: true };
  assert.equal(isItemEligibleForPush(item, false), false);
  assert.equal(isItemEligibleForPush(item, true), false);
});

test('isItemEligibleForPush: read + no forceNotify => false', () => {
  const item: InboxItemForEligibility = { isRead: true, isArchived: false };
  assert.equal(isItemEligibleForPush(item, false), false);
});

test('isItemEligibleForPush: read + forceNotify => true (keep-read-notify)', () => {
  const item: InboxItemForEligibility = { isRead: true, isArchived: false };
  assert.equal(isItemEligibleForPush(item, true), true);
});

test('isItemEligibleForPush: unread => true', () => {
  const item: InboxItemForEligibility = { isRead: false, isArchived: false };
  assert.equal(isItemEligibleForPush(item, false), true);
  assert.equal(isItemEligibleForPush(item, true), true);
});
