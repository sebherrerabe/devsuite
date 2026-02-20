import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPayload,
  matchesRecordingIDE,
  normalizeExecutable,
} from '../../src/foreground-window-tracker.js';

test('normalizeExecutable lowercases and adds .exe', () => {
  assert.equal(normalizeExecutable('Cursor'), 'cursor.exe');
  assert.equal(normalizeExecutable('Code'), 'code.exe');
  assert.equal(normalizeExecutable('cursor.exe'), 'cursor.exe');
});

test('matchesRecordingIDE matches by path basename', () => {
  assert.ok(
    matchesRecordingIDE('cursor.exe', {
      path: 'C:\\Program Files\\Cursor\\Cursor.exe',
      name: 'Other',
    })
  );
  assert.ok(
    matchesRecordingIDE('cursor.exe', {
      path: '/usr/local/bin/cursor.exe',
    })
  );
});

test('matchesRecordingIDE matches by owner name', () => {
  assert.ok(matchesRecordingIDE('cursor.exe', { name: 'Cursor' }));
  assert.ok(matchesRecordingIDE('code.exe', { name: 'Code' }));
});

test('matchesRecordingIDE returns false when no match', () => {
  assert.ok(!matchesRecordingIDE('cursor.exe', { name: 'Chrome' }));
  assert.ok(!matchesRecordingIDE('cursor.exe', { path: 'C:\\Chrome.exe' }));
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
