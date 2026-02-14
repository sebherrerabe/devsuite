import { createRequire } from 'node:module';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  parseDesktopSettingsScope,
  type DesktopSettingsScope,
} from './focus-settings.js';

const SESSION_SCOPE_FILE_NAME = 'desktop-session-scope.json';
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

function getSessionScopeFilePath(): string {
  return join(resolveDesktopUserDataPath(), SESSION_SCOPE_FILE_NAME);
}

export async function loadDesktopSessionScope(): Promise<DesktopSettingsScope | null> {
  const filePath = getSessionScopeFilePath();
  try {
    const fileContents = await readFile(filePath, 'utf-8');
    return parseDesktopSettingsScope(JSON.parse(fileContents));
  } catch {
    return null;
  }
}

export async function saveDesktopSessionScope(
  requestedScope: unknown
): Promise<DesktopSettingsScope> {
  const scope = parseDesktopSettingsScope(requestedScope);
  const filePath = getSessionScopeFilePath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(scope, null, 2)}\n`, 'utf-8');
  return scope;
}

export async function clearDesktopSessionScope(): Promise<void> {
  const filePath = getSessionScopeFilePath();
  await rm(filePath, { force: true });
}
