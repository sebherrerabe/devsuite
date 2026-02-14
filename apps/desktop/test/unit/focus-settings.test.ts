import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDefaultDesktopFocusSettings,
  parseDesktopSettingsScope,
  parseDesktopFocusSettings,
} from '../../src/focus-settings.js';

test('createDefaultDesktopFocusSettings returns the expected defaults', () => {
  const defaults = createDefaultDesktopFocusSettings();

  assert.deepEqual(defaults.ideWatchList, [
    'code.exe',
    'cursor.exe',
    'idea64.exe',
  ]);
  assert.deepEqual(defaults.appBlockList, []);
  assert.deepEqual(defaults.websiteBlockList, []);
  assert.equal(defaults.strictMode, 'prompt_then_close');
  assert.equal(defaults.appActionMode, 'warn_then_close');
  assert.equal(defaults.websiteActionMode, 'escalate');
  assert.equal(defaults.graceSeconds, 45);
  assert.equal(defaults.reminderIntervalSeconds, 120);
});

test('parseDesktopFocusSettings normalizes executable and website lists', () => {
  const parsed = parseDesktopFocusSettings({
    ideWatchList: ['Code.exe', ' code.exe ', 'CURSOR.EXE'],
    appBlockList: ['WhatsApp.exe', 'whatsapp.exe', ' Telegram.exe '],
    websiteBlockList: ['https://www.YouTube.com/watch?v=1', 'x.com', 'X.com'],
    strictMode: 'prompt_then_close',
    appActionMode: 'warn_then_close',
    websiteActionMode: 'escalate',
    graceSeconds: 30,
    reminderIntervalSeconds: 120,
  });

  assert.deepEqual(parsed.ideWatchList, ['code.exe', 'cursor.exe']);
  assert.deepEqual(parsed.appBlockList, ['whatsapp.exe', 'telegram.exe']);
  assert.deepEqual(parsed.websiteBlockList, ['youtube.com', 'x.com']);
  assert.equal(parsed.strictMode, 'prompt_then_close');
  assert.equal(parsed.appActionMode, 'warn_then_close');
  assert.equal(parsed.websiteActionMode, 'escalate');
  assert.equal(parsed.graceSeconds, 30);
  assert.equal(parsed.reminderIntervalSeconds, 120);
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
