import assert from 'node:assert/strict';
import test from 'node:test';

import {
  selectPreferredGithubThreadEntry,
  type GithubThreadIndexEntry,
} from './githubThreadSelection.js';

test('selectPreferredGithubThreadEntry: picks first entry when current is null', () => {
  const candidate: GithubThreadIndexEntry = {
    id: 'item-1',
    ghUpdatedAt: 1000,
    updatedAt: 1000,
  };
  assert.deepEqual(
    selectPreferredGithubThreadEntry(null, candidate),
    candidate
  );
});

test('selectPreferredGithubThreadEntry: prefers higher ghUpdatedAt', () => {
  const current: GithubThreadIndexEntry = {
    id: 'item-1',
    ghUpdatedAt: 1000,
    updatedAt: 1000,
  };
  const candidate: GithubThreadIndexEntry = {
    id: 'item-2',
    ghUpdatedAt: 2000,
    updatedAt: 900,
  };
  assert.equal(
    selectPreferredGithubThreadEntry(current, candidate).id,
    'item-2'
  );
});

test('selectPreferredGithubThreadEntry: keeps current when candidate ghUpdatedAt is lower', () => {
  const current: GithubThreadIndexEntry = {
    id: 'item-1',
    ghUpdatedAt: 2000,
    updatedAt: 1000,
  };
  const candidate: GithubThreadIndexEntry = {
    id: 'item-2',
    ghUpdatedAt: 1000,
    updatedAt: 9999,
  };
  assert.equal(
    selectPreferredGithubThreadEntry(current, candidate).id,
    'item-1'
  );
});

test('selectPreferredGithubThreadEntry: treats null ghUpdatedAt as lowest priority', () => {
  const current: GithubThreadIndexEntry = {
    id: 'item-1',
    ghUpdatedAt: null,
    updatedAt: 1000,
  };
  const candidate: GithubThreadIndexEntry = {
    id: 'item-2',
    ghUpdatedAt: 1,
    updatedAt: 1,
  };
  assert.equal(
    selectPreferredGithubThreadEntry(current, candidate).id,
    'item-2'
  );
});

test('selectPreferredGithubThreadEntry: breaks ghUpdatedAt ties with updatedAt', () => {
  const current: GithubThreadIndexEntry = {
    id: 'item-1',
    ghUpdatedAt: 1000,
    updatedAt: 1000,
  };
  const candidate: GithubThreadIndexEntry = {
    id: 'item-2',
    ghUpdatedAt: 1000,
    updatedAt: 1001,
  };
  assert.equal(
    selectPreferredGithubThreadEntry(current, candidate).id,
    'item-2'
  );
});
