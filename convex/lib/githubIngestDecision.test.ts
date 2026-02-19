import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decideThreadIngestAction,
  type ExistingThread,
} from './githubIngestDecision.js';

test('decideThreadIngestAction: no existing => insert', () => {
  assert.equal(decideThreadIngestAction(null, 1000), 'insert');
  assert.equal(decideThreadIngestAction(null, null), 'insert');
});

test('decideThreadIngestAction: existing + no incoming updatedAt => skip', () => {
  const existing: ExistingThread = { id: 'item-1', ghUpdatedAt: 1000 };
  assert.equal(decideThreadIngestAction(existing, null), 'skip');
});

test('decideThreadIngestAction: same thread + same updatedAt => skip', () => {
  const existing: ExistingThread = { id: 'item-1', ghUpdatedAt: 1000 };
  assert.equal(decideThreadIngestAction(existing, 1000), 'skip');
});

test('decideThreadIngestAction: same thread + older updatedAt => skip', () => {
  const existing: ExistingThread = { id: 'item-1', ghUpdatedAt: 1000 };
  assert.equal(decideThreadIngestAction(existing, 999), 'skip');
});

test('decideThreadIngestAction: same thread + newer updatedAt => update', () => {
  const existing: ExistingThread = { id: 'item-1', ghUpdatedAt: 1000 };
  assert.equal(decideThreadIngestAction(existing, 1001), 'update');
});

test('decideThreadIngestAction: existing with null ghUpdatedAt + incoming => update', () => {
  const existing: ExistingThread = { id: 'item-1', ghUpdatedAt: null };
  assert.equal(decideThreadIngestAction(existing, 1000), 'update');
});
