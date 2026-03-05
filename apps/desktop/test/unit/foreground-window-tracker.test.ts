import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPayload,
  matchesWatchList,
  normalizeExecutable,
} from '../../src/foreground-window-tracker.js';

test('normalizeExecutable lowercases and adds .exe', () => {
  assert.equal(normalizeExecutable('Cursor'), 'cursor.exe');
  assert.equal(normalizeExecutable('Code'), 'code.exe');
  assert.equal(normalizeExecutable('cursor.exe'), 'cursor.exe');
});

test('matchesWatchList matches by path basename', () => {
  assert.equal(
    matchesWatchList(['cursor.exe', 'code.exe'], {
      path: 'C:\\Program Files\\Cursor\\Cursor.exe',
      name: 'Other',
    }),
    'cursor.exe'
  );
  assert.equal(
    matchesWatchList(['cursor.exe', 'code.exe'], {
      path: '/usr/local/bin/cursor.exe',
    }),
    'cursor.exe'
  );
});

test('matchesWatchList matches by owner name', () => {
  assert.equal(
    matchesWatchList(['cursor.exe', 'code.exe'], { name: 'Cursor' }),
    'cursor.exe'
  );
  assert.equal(
    matchesWatchList(['cursor.exe', 'code.exe'], { name: 'Code' }),
    'code.exe'
  );
});

test('matchesWatchList returns null when no match', () => {
  assert.equal(matchesWatchList(['cursor.exe'], { name: 'Chrome' }), null);
  assert.equal(
    matchesWatchList(['cursor.exe'], { path: 'C:\\Chrome.exe' }),
    null
  );
});

test('buildPayload normalizes executable from name', () => {
  const payload = buildPayload({ name: 'Cursor', processId: 1234 });
  assert.equal(payload.executable, 'cursor.exe');
  assert.equal(payload.processId, 1234);
});

test('buildPayload uses path basename when name absent', () => {
  const payload = buildPayload({
    path: 'C:\\Program Files\\Cursor\\Cursor.exe',
  });
  assert.equal(payload.executable, 'cursor.exe');
});
