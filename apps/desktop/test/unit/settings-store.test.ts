import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  clearDesktopScopedSettings,
  DEFAULT_COMPANION_SHORTCUT,
  loadCompanionShortcut,
  loadDesktopAutoUpdatePreferences,
  loadDesktopFocusSettings,
  loadDesktopRuntimePreferences,
  saveCompanionShortcut,
  saveDesktopAutoUpdatePreferences,
  saveDesktopFocusSettings,
  saveDesktopRuntimePreferences,
} from '../../src/settings-store.js';

const USER_DATA_PATH_ENV = 'DEVSUITE_DESKTOP_USER_DATA_PATH';

async function withTempUserDataPath(
  run: (tempDir: string) => Promise<void>
): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), 'devsuite-settings-store-'));
  const previousValue = process.env[USER_DATA_PATH_ENV];
  process.env[USER_DATA_PATH_ENV] = tempDir;

  try {
    await run(tempDir);
  } finally {
    if (previousValue === undefined) {
      delete process.env[USER_DATA_PATH_ENV];
    } else {
      process.env[USER_DATA_PATH_ENV] = previousValue;
    }
    await rm(tempDir, { recursive: true, force: true });
  }
}

test('loadCompanionShortcut returns default when settings file is missing', async () => {
  await withTempUserDataPath(async () => {
    const loadedShortcut = await loadCompanionShortcut();
    assert.equal(loadedShortcut, DEFAULT_COMPANION_SHORTCUT);
  });
});

test('saveCompanionShortcut persists and loadCompanionShortcut round-trips', async () => {
  await withTempUserDataPath(async tempDir => {
    const savedShortcut = await saveCompanionShortcut('Ctrl+Shift+K');
    assert.equal(savedShortcut, 'Ctrl+Shift+K');

    const loadedShortcut = await loadCompanionShortcut();
    assert.equal(loadedShortcut, 'Ctrl+Shift+K');

    const persisted = JSON.parse(
      await readFile(join(tempDir, 'desktop-focus-settings.json'), 'utf-8')
    ) as { companionShortcut?: string };
    assert.equal(persisted.companionShortcut, 'Ctrl+Shift+K');
  });
});

test('saveCompanionShortcut rejects invalid shortcut values gracefully', async () => {
  await withTempUserDataPath(async () => {
    await assert.rejects(
      saveCompanionShortcut('  '),
      /must be a non-empty string/i
    );
    await assert.rejects(saveCompanionShortcut(123), /must be a string/i);

    const loadedShortcut = await loadCompanionShortcut();
    assert.equal(loadedShortcut, DEFAULT_COMPANION_SHORTCUT);
  });
});

test('clearDesktopScopedSettings removes persisted company-scoped settings only', async () => {
  await withTempUserDataPath(async tempDir => {
    await saveDesktopFocusSettings(
      {
        userId: 'user-1',
        companyId: 'company-1',
      },
      {
        devCoreList: ['code.exe'],
        ideWatchList: ['code.exe'],
        devSupportList: ['powershell.exe'],
        devSiteList: ['github.com'],
        appBlockList: ['spotify.exe'],
        websiteBlockList: ['youtube.com'],
        strictMode: 'prompt_then_close',
        appActionMode: 'warn_then_close',
        websiteActionMode: 'escalate',
        graceSeconds: 45,
        reminderIntervalSeconds: 120,
        inactivityThresholdSeconds: 300,
        autoInactivityPause: true,
        autoSession: false,
        autoSessionWarmupSeconds: 120,
      }
    );
    await saveCompanionShortcut('Ctrl+Shift+K');
    await saveDesktopRuntimePreferences({
      openAtLogin: false,
      runInBackgroundOnClose: true,
    });
    await saveDesktopAutoUpdatePreferences({
      consent: 'enabled',
      consentUpdatedAt: 123,
      dismissedReadyVersion: '0.5.0',
    });

    await clearDesktopScopedSettings();

    const loadedSettings = await loadDesktopFocusSettings({
      userId: 'user-1',
      companyId: 'company-1',
    });
    assert.equal(loadedSettings.websiteBlockList.length, 0);
    assert.equal(loadedSettings.appBlockList.length, 0);

    const loadedShortcut = await loadCompanionShortcut();
    assert.equal(loadedShortcut, 'Ctrl+Shift+K');

    const runtimePreferences = await loadDesktopRuntimePreferences();
    assert.deepEqual(runtimePreferences, {
      openAtLogin: false,
      runInBackgroundOnClose: true,
    });

    const autoUpdatePreferences = await loadDesktopAutoUpdatePreferences();
    assert.deepEqual(autoUpdatePreferences, {
      consent: 'enabled',
      consentUpdatedAt: 123,
      dismissedReadyVersion: '0.5.0',
    });

    const persisted = JSON.parse(
      await readFile(join(tempDir, 'desktop-focus-settings.json'), 'utf-8')
    ) as { byScope?: Record<string, unknown> };
    assert.deepEqual(persisted.byScope, {});
  });
});

test('desktop auto-update preferences round-trip through settings storage', async () => {
  await withTempUserDataPath(async tempDir => {
    const savedPreferences = await saveDesktopAutoUpdatePreferences({
      consent: 'disabled',
      consentUpdatedAt: 456,
      dismissedReadyVersion: '0.6.0',
    });

    assert.deepEqual(savedPreferences, {
      consent: 'disabled',
      consentUpdatedAt: 456,
      dismissedReadyVersion: '0.6.0',
    });

    const loadedPreferences = await loadDesktopAutoUpdatePreferences();
    assert.deepEqual(loadedPreferences, savedPreferences);

    const persisted = JSON.parse(
      await readFile(join(tempDir, 'desktop-focus-settings.json'), 'utf-8')
    ) as {
      autoUpdate?: {
        consent?: string;
        consentUpdatedAt?: number | null;
        dismissedReadyVersion?: string | null;
      };
    };

    assert.deepEqual(persisted.autoUpdate, savedPreferences);
  });
});
