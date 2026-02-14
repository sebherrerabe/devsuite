import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMonitoredEntries,
  createProcessWatchConfigFromFocusSettings,
  diffProcessEntries,
  normalizeProcessWatchConfig,
  parseTasklistCsv,
  shouldMonitorProcesses,
} from '../../src/process-monitor.js';

test('parseTasklistCsv parses tasklist output rows', () => {
  const parsed = parseTasklistCsv(
    [
      '"Code.exe","1234","Console","1","100,000 K"',
      '"Cursor.exe","3333","Console","1","99,999 K"',
      '"not-a-pid","abc","Console","1","1 K"',
    ].join('\n')
  );

  assert.deepEqual(parsed, [
    { executable: 'code.exe', pid: 1234 },
    { executable: 'cursor.exe', pid: 3333 },
  ]);
});

test('createProcessWatchConfigFromFocusSettings normalizes and deduplicates', () => {
  const config = createProcessWatchConfigFromFocusSettings({
    ideWatchList: ['Code.exe', 'code.exe', 'Cursor.exe'],
    appBlockList: ['WhatsApp.exe', ' whatsapp.exe '],
    websiteBlockList: [],
    strictMode: 'prompt_only',
    appActionMode: 'warn',
    websiteActionMode: 'warn_only',
    graceSeconds: 60,
    reminderIntervalSeconds: 300,
  });

  assert.deepEqual(config.ideExecutables, ['code.exe', 'cursor.exe']);
  assert.deepEqual(config.appExecutables, ['whatsapp.exe']);
  assert.equal(config.pollIntervalMs, 4000);
});

test('normalizeProcessWatchConfig clamps interval and normalizes executable names', () => {
  const config = normalizeProcessWatchConfig({
    ideExecutables: [' Code.exe '],
    appExecutables: ['WhatsApp.exe'],
    pollIntervalMs: 10,
  });

  assert.deepEqual(config.ideExecutables, ['code.exe']);
  assert.deepEqual(config.appExecutables, ['whatsapp.exe']);
  assert.equal(config.pollIntervalMs, 1000);
});

test('buildMonitoredEntries keeps only configured ide/app executables', () => {
  const config = normalizeProcessWatchConfig({
    ideExecutables: ['code.exe'],
    appExecutables: ['whatsapp.exe'],
  });

  const entries = buildMonitoredEntries(
    [
      { executable: 'code.exe', pid: 1 },
      { executable: 'whatsapp.exe', pid: 2 },
      { executable: 'explorer.exe', pid: 3 },
    ],
    config
  );

  const values = Array.from(entries.values()).sort((a, b) => a.pid - b.pid);
  assert.deepEqual(values, [
    { executable: 'code.exe', pid: 1, category: 'ide' },
    { executable: 'whatsapp.exe', pid: 2, category: 'app_block' },
  ]);
});

test('diffProcessEntries emits start/stop events for process transitions', () => {
  const previous = new Map([
    [
      'code.exe:10',
      { executable: 'code.exe', pid: 10, category: 'ide' as const },
    ],
  ]);
  const next = new Map([
    [
      'code.exe:10',
      { executable: 'code.exe', pid: 10, category: 'ide' as const },
    ],
    [
      'whatsapp.exe:20',
      { executable: 'whatsapp.exe', pid: 20, category: 'app_block' as const },
    ],
  ]);

  const startedEvents = diffProcessEntries(previous, next, 1000);
  assert.deepEqual(startedEvents, [
    {
      type: 'process_started',
      executable: 'whatsapp.exe',
      pid: 20,
      category: 'app_block',
      timestamp: 1000,
    },
  ]);

  const stoppedEvents = diffProcessEntries(next, previous, 2000);
  assert.deepEqual(stoppedEvents, [
    {
      type: 'process_stopped',
      executable: 'whatsapp.exe',
      pid: 20,
      category: 'app_block',
      timestamp: 2000,
    },
  ]);
});

test('shouldMonitorProcesses reports if at least one executable is configured', () => {
  assert.equal(
    shouldMonitorProcesses(
      normalizeProcessWatchConfig({ ideExecutables: [], appExecutables: [] })
    ),
    false
  );
  assert.equal(
    shouldMonitorProcesses(
      normalizeProcessWatchConfig({ ideExecutables: ['code.exe'] })
    ),
    true
  );
});
