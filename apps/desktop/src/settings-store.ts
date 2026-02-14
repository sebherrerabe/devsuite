import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  createDefaultDesktopFocusSettings,
  parseDesktopFocusSettings,
  parseDesktopSettingsScope,
  type DesktopSettingsScope,
  type DesktopFocusSettings,
} from './focus-settings.js';

const SETTINGS_FILE_NAME = 'desktop-focus-settings.json';
const require = createRequire(import.meta.url);
const { app } = require('electron') as typeof import('electron');
const USER_DATA_PATH_ENV = 'DEVSUITE_DESKTOP_USER_DATA_PATH';

function resolveDesktopUserDataPath(): string {
  const overridePath = process.env[USER_DATA_PATH_ENV]?.trim();
  if (overridePath) {
    return overridePath;
  }

  return app.getPath('userData');
}

interface StoredDesktopFocusSettings {
  version: 1;
  byScope: Record<string, DesktopFocusSettings>;
}

function getSettingsFilePath(): string {
  return join(resolveDesktopUserDataPath(), SETTINGS_FILE_NAME);
}

function createEmptyStorage(): StoredDesktopFocusSettings {
  return {
    version: 1,
    byScope: {},
  };
}

function getScopeKey(scope: DesktopSettingsScope): string {
  return `${scope.userId}::${scope.companyId}`;
}

function parseStoredData(input: unknown): StoredDesktopFocusSettings {
  if (!input || typeof input !== 'object') {
    return createEmptyStorage();
  }

  const raw = input as { byScope?: unknown };
  if (!raw.byScope || typeof raw.byScope !== 'object') {
    return createEmptyStorage();
  }

  const parsedByScope: Record<string, DesktopFocusSettings> = {};
  for (const [scopeKey, value] of Object.entries(raw.byScope)) {
    try {
      parsedByScope[scopeKey] = parseDesktopFocusSettings(value);
    } catch {
      // Ignore malformed entries and preserve valid scopes.
    }
  }

  return {
    version: 1,
    byScope: parsedByScope,
  };
}

export async function loadDesktopFocusSettings(
  requestedScope: unknown
): Promise<DesktopFocusSettings> {
  const scope = parseDesktopSettingsScope(requestedScope);
  const scopeKey = getScopeKey(scope);
  const settingsFilePath = getSettingsFilePath();

  try {
    const fileContents = await readFile(settingsFilePath, 'utf-8');
    const parsedJson = JSON.parse(fileContents) as unknown;
    const storage = parseStoredData(parsedJson);
    return storage.byScope[scopeKey] ?? createDefaultDesktopFocusSettings();
  } catch {
    return createDefaultDesktopFocusSettings();
  }
}

export async function saveDesktopFocusSettings(
  requestedScope: unknown,
  nextSettings: unknown
): Promise<DesktopFocusSettings> {
  const scope = parseDesktopSettingsScope(requestedScope);
  const scopeKey = getScopeKey(scope);
  const normalizedSettings = parseDesktopFocusSettings(nextSettings);
  const settingsFilePath = getSettingsFilePath();
  let storage = createEmptyStorage();

  try {
    const fileContents = await readFile(settingsFilePath, 'utf-8');
    storage = parseStoredData(JSON.parse(fileContents));
  } catch {
    // Start with empty storage when no file exists.
  }

  storage.byScope[scopeKey] = normalizedSettings;

  await mkdir(dirname(settingsFilePath), { recursive: true });
  await writeFile(
    settingsFilePath,
    `${JSON.stringify(storage, null, 2)}\n`,
    'utf-8'
  );

  return normalizedSettings;
}
