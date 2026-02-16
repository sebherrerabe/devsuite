import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  DEFAULT_COMPANION_SHORTCUT,
  loadCompanionShortcut,
  saveCompanionShortcut,
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
