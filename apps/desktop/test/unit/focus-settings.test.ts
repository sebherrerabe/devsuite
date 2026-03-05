import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDefaultDesktopFocusSettings,
  parseDesktopSettingsScope,
  parseDesktopFocusSettings,
} from '../../src/focus-settings.js';

test('createDefaultDesktopFocusSettings returns the expected defaults', () => {
  const defaults = createDefaultDesktopFocusSettings();

  assert.deepEqual(defaults.devCoreList, [
    'code.exe',
    'cursor.exe',
    'idea64.exe',
  ]);
  assert.deepEqual(defaults.ideWatchList, defaults.devCoreList);
  assert.deepEqual(defaults.devSupportList, [
    'wt.exe',
    'windowsterminal.exe',
    'powershell.exe',
    'cmd.exe',
  ]);
  assert.deepEqual(defaults.devSiteList, [
    'chat.openai.com',
    'claude.ai',
    'github.com',
    'localhost',
  ]);
  assert.deepEqual(defaults.appBlockList, []);
  assert.deepEqual(defaults.websiteBlockList, []);
  assert.equal(defaults.strictMode, 'prompt_then_close');
  assert.equal(defaults.appActionMode, 'warn_then_close');
  assert.equal(defaults.websiteActionMode, 'escalate');
  assert.equal(defaults.graceSeconds, 45);
  assert.equal(defaults.reminderIntervalSeconds, 120);
  assert.equal(defaults.inactivityThresholdSeconds, 300);
  assert.equal(defaults.autoInactivityPause, true);
  assert.equal(defaults.autoSession, false);
  assert.equal(defaults.autoSessionWarmupSeconds, 120);
});

test('parseDesktopFocusSettings normalizes executable and website lists', () => {
  const parsed = parseDesktopFocusSettings({
    devCoreList: ['Code.exe', ' code.exe ', 'CURSOR.EXE'],
    devSupportList: [' WT.exe ', 'cmd.exe'],
    devSiteList: ['https://ChatGPT.com/', ' localhost:3000 '],
    appBlockList: ['WhatsApp.exe', 'whatsapp.exe', ' Telegram.exe '],
    websiteBlockList: ['https://www.YouTube.com/watch?v=1', 'x.com', 'X.com'],
    strictMode: 'prompt_then_close',
    appActionMode: 'warn_then_close',
    websiteActionMode: 'escalate',
    graceSeconds: 30,
    reminderIntervalSeconds: 120,
    inactivityThresholdSeconds: 350,
    autoInactivityPause: false,
    autoSession: true,
    autoSessionWarmupSeconds: 60,
  });

  assert.deepEqual(parsed.devCoreList, ['code.exe', 'cursor.exe']);
  assert.deepEqual(parsed.devSupportList, ['wt.exe', 'cmd.exe']);
  assert.deepEqual(parsed.devSiteList, ['chatgpt.com', 'localhost:3000']);
  assert.deepEqual(parsed.appBlockList, ['whatsapp.exe', 'telegram.exe']);
  assert.deepEqual(parsed.websiteBlockList, ['youtube.com', 'x.com']);
  assert.equal(parsed.strictMode, 'prompt_then_close');
  assert.equal(parsed.appActionMode, 'warn_then_close');
  assert.equal(parsed.websiteActionMode, 'escalate');
  assert.equal(parsed.graceSeconds, 30);
  assert.equal(parsed.reminderIntervalSeconds, 120);
  assert.equal(parsed.inactivityThresholdSeconds, 350);
  assert.equal(parsed.autoInactivityPause, false);
  assert.equal(parsed.autoSession, true);
  assert.equal(parsed.autoSessionWarmupSeconds, 60);
});

test('parseDesktopFocusSettings uses ideWatchList as fallback alias for devCoreList', () => {
  const parsed = parseDesktopFocusSettings({
    ideWatchList: ['legacy.exe'],
  });

  assert.deepEqual(parsed.devCoreList, ['legacy.exe']);
  assert.deepEqual(parsed.ideWatchList, ['legacy.exe']);
});

test('parseDesktopFocusSettings rejects invalid integer bounds', () => {
  assert.throws(
    () =>
      parseDesktopFocusSettings({
        graceSeconds: 0,
      }),
    /graceSeconds must be between/
  );
});

test('parseDesktopFocusSettings rejects non-object payloads', () => {
  assert.throws(
    () => parseDesktopFocusSettings(null),
    /payload must be an object/
  );
  assert.throws(
    () => parseDesktopFocusSettings('nope'),
    /payload must be an object/
  );
});

test('parseDesktopSettingsScope validates and trims scope values', () => {
  const parsed = parseDesktopSettingsScope({
    userId: '  user-123  ',
    companyId: ' company-456 ',
  });

  assert.deepEqual(parsed, {
    userId: 'user-123',
    companyId: 'company-456',
  });
});

test('parseDesktopSettingsScope rejects invalid payloads', () => {
  assert.throws(
    () => parseDesktopSettingsScope(null),
    /payload must be an object/
  );
  assert.throws(
    () => parseDesktopSettingsScope({ userId: '', companyId: 'company-1' }),
    /userId must be a non-empty string/
  );
});
