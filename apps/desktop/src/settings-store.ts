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
const MAX_COMPANION_SHORTCUT_LENGTH = 120;
export const DEFAULT_COMPANION_SHORTCUT = 'Ctrl+Alt+D';
export const DEFAULT_RUNTIME_PREFERENCES = {
  openAtLogin: true,
  runInBackgroundOnClose: false,
} as const;
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

function resolveOpenAtLoginFallback(): boolean {
  try {
    const loginItemSettings = app.getLoginItemSettings({
      path: process.execPath,
    });
    return typeof loginItemSettings.openAtLogin === 'boolean'
      ? loginItemSettings.openAtLogin
      : DEFAULT_RUNTIME_PREFERENCES.openAtLogin;
  } catch {
    return DEFAULT_RUNTIME_PREFERENCES.openAtLogin;
  }
}

interface StoredDesktopFocusSettings {
  version: 1;
  byScope: Record<string, DesktopFocusSettings>;
  companionShortcut: string;
  runtimePreferences: DesktopRuntimePreferences;
}

export interface DesktopRuntimePreferences {
  openAtLogin: boolean;
  runInBackgroundOnClose: boolean;
}

function getSettingsFilePath(): string {
  return join(resolveDesktopUserDataPath(), SETTINGS_FILE_NAME);
}

function createEmptyStorage(): StoredDesktopFocusSettings {
  return {
    version: 1,
    byScope: {},
    companionShortcut: DEFAULT_COMPANION_SHORTCUT,
    runtimePreferences: {
      ...DEFAULT_RUNTIME_PREFERENCES,
      openAtLogin: resolveOpenAtLoginFallback(),
    },
  };
}

function getScopeKey(scope: DesktopSettingsScope): string {
  return `${scope.userId}::${scope.companyId}`;
}

export function parseCompanionShortcut(input: unknown): string {
  if (typeof input !== 'string') {
    throw new Error('Companion shortcut must be a string.');
  }

  const normalized = input.trim();
  if (!normalized) {
    throw new Error('Companion shortcut must be a non-empty string.');
  }
  if (normalized.length > MAX_COMPANION_SHORTCUT_LENGTH) {
    throw new Error(
      `Companion shortcut must be at most ${MAX_COMPANION_SHORTCUT_LENGTH} characters.`
    );
  }

  return normalized;
}

function parseStoredData(input: unknown): StoredDesktopFocusSettings {
  if (!input || typeof input !== 'object') {
    return createEmptyStorage();
  }

  const raw = input as {
    byScope?: unknown;
    companionShortcut?: unknown;
    runtimePreferences?: unknown;
  };
  if (!raw.byScope || typeof raw.byScope !== 'object') {
    const emptyStorage = createEmptyStorage();
    if (raw.companionShortcut === undefined) {
      return {
        ...emptyStorage,
        runtimePreferences: parseRuntimePreferences(raw.runtimePreferences),
      };
    }
    try {
      return {
        ...emptyStorage,
        companionShortcut: parseCompanionShortcut(raw.companionShortcut),
        runtimePreferences: parseRuntimePreferences(raw.runtimePreferences),
      };
    } catch {
      return emptyStorage;
    }
  }

  const parsedByScope: Record<string, DesktopFocusSettings> = {};
  for (const [scopeKey, value] of Object.entries(raw.byScope)) {
    try {
      parsedByScope[scopeKey] = parseDesktopFocusSettings(value);
    } catch {
      // Ignore malformed entries and preserve valid scopes.
    }
  }

  let companionShortcut = DEFAULT_COMPANION_SHORTCUT;
  if (raw.companionShortcut !== undefined) {
    try {
      companionShortcut = parseCompanionShortcut(raw.companionShortcut);
    } catch {
      // Keep default when the persisted shortcut is malformed.
    }
  }

  return {
    version: 1,
    byScope: parsedByScope,
    companionShortcut,
    runtimePreferences: parseRuntimePreferences(raw.runtimePreferences),
  };
}

function parseRuntimePreferences(value: unknown): DesktopRuntimePreferences {
  const openAtLoginFallback = resolveOpenAtLoginFallback();

  if (!value || typeof value !== 'object') {
    return {
      ...DEFAULT_RUNTIME_PREFERENCES,
      openAtLogin: openAtLoginFallback,
    };
  }

  const raw = value as Record<string, unknown>;
  return {
    openAtLogin:
      typeof raw.openAtLogin === 'boolean'
        ? raw.openAtLogin
        : openAtLoginFallback,
    runInBackgroundOnClose:
      typeof raw.runInBackgroundOnClose === 'boolean'
        ? raw.runInBackgroundOnClose
        : DEFAULT_RUNTIME_PREFERENCES.runInBackgroundOnClose,
  };
}

async function writeStorage(
  settingsFilePath: string,
  storage: StoredDesktopFocusSettings
): Promise<void> {
  await mkdir(dirname(settingsFilePath), { recursive: true });
  await writeFile(
    settingsFilePath,
    `${JSON.stringify(storage, null, 2)}\n`,
    'utf-8'
  );
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

  await writeStorage(settingsFilePath, storage);

  return normalizedSettings;
}

export async function loadCompanionShortcut(): Promise<string> {
  const settingsFilePath = getSettingsFilePath();

  try {
    const fileContents = await readFile(settingsFilePath, 'utf-8');
    const parsedJson = JSON.parse(fileContents) as unknown;
    const storage = parseStoredData(parsedJson);
    return storage.companionShortcut;
  } catch {
    return DEFAULT_COMPANION_SHORTCUT;
  }
}

export async function saveCompanionShortcut(
  nextShortcut: unknown
): Promise<string> {
  const normalizedShortcut = parseCompanionShortcut(nextShortcut);
  const settingsFilePath = getSettingsFilePath();
  let storage = createEmptyStorage();

  try {
    const fileContents = await readFile(settingsFilePath, 'utf-8');
    storage = parseStoredData(JSON.parse(fileContents));
  } catch {
    // Start with empty storage when no file exists.
  }

  storage.companionShortcut = normalizedShortcut;
  await writeStorage(settingsFilePath, storage);

  return normalizedShortcut;
}

export async function loadDesktopRuntimePreferences(): Promise<DesktopRuntimePreferences> {
  const settingsFilePath = getSettingsFilePath();

  try {
    const fileContents = await readFile(settingsFilePath, 'utf-8');
    const parsedJson = JSON.parse(fileContents) as unknown;
    const storage = parseStoredData(parsedJson);
    return storage.runtimePreferences;
  } catch {
    return {
      ...DEFAULT_RUNTIME_PREFERENCES,
      openAtLogin: resolveOpenAtLoginFallback(),
    };
  }
}

export async function saveDesktopRuntimePreferences(
  requestedPreferences: unknown
): Promise<DesktopRuntimePreferences> {
  const normalizedPreferences = parseRuntimePreferences(requestedPreferences);
  const settingsFilePath = getSettingsFilePath();
  let storage = createEmptyStorage();

  try {
    const fileContents = await readFile(settingsFilePath, 'utf-8');
    storage = parseStoredData(JSON.parse(fileContents));
  } catch {
    // Start with empty storage when no file exists.
  }

  storage.runtimePreferences = normalizedPreferences;
  await writeStorage(settingsFilePath, storage);
  return normalizedPreferences;
}
