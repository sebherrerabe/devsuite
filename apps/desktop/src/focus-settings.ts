export type StrictMode = 'prompt_only' | 'prompt_then_close';
export type AppActionMode = 'warn' | 'warn_then_close';
export type WebsiteActionMode = 'warn_only' | 'escalate';

export interface DesktopSettingsScope {
  userId: string;
  companyId: string;
}

export interface DesktopFocusSettings {
  devCoreList: string[];
  ideWatchList: string[];
  devSupportList: string[];
  devSiteList: string[];
  appBlockList: string[];
  websiteBlockList: string[];
  strictMode: StrictMode;
  appActionMode: AppActionMode;
  websiteActionMode: WebsiteActionMode;
  graceSeconds: number;
  reminderIntervalSeconds: number;
  inactivityThresholdSeconds: number;
  autoInactivityPause: boolean;
  autoSession: boolean;
  autoSessionWarmupSeconds: number;
}

const DEFAULT_DEV_CORE_LIST = ['code.exe', 'cursor.exe', 'idea64.exe'];
const DEFAULT_DEV_SUPPORT_LIST = [
  'wt.exe',
  'windowsterminal.exe',
  'powershell.exe',
  'cmd.exe',
];
const DEFAULT_DEV_SITE_LIST = [
  'chat.openai.com',
  'claude.ai',
  'github.com',
  'localhost',
];
const MIN_GRACE_SECONDS = 5;
const MAX_GRACE_SECONDS = 60 * 60;
const MIN_REMINDER_INTERVAL_SECONDS = 30;
const MAX_REMINDER_INTERVAL_SECONDS = 60 * 60;
const MIN_INACTIVITY_THRESHOLD_SECONDS = 60;
const MAX_INACTIVITY_THRESHOLD_SECONDS = 3600;
const MIN_AUTO_SESSION_WARMUP_SECONDS = 30;
const MAX_AUTO_SESSION_WARMUP_SECONDS = 600;

export const DEFAULT_DESKTOP_FOCUS_SETTINGS: DesktopFocusSettings = {
  devCoreList: DEFAULT_DEV_CORE_LIST,
  ideWatchList: DEFAULT_DEV_CORE_LIST,
  devSupportList: DEFAULT_DEV_SUPPORT_LIST,
  devSiteList: DEFAULT_DEV_SITE_LIST,
  appBlockList: [],
  websiteBlockList: [],
  strictMode: 'prompt_then_close',
  appActionMode: 'warn_then_close',
  websiteActionMode: 'escalate',
  graceSeconds: 45,
  reminderIntervalSeconds: 120,
  inactivityThresholdSeconds: 300,
  autoInactivityPause: true,
  autoSession: false,
  autoSessionWarmupSeconds: 120,
};

type RawSettings = Partial<Record<keyof DesktopFocusSettings, unknown>>;
type RawScope = Partial<Record<keyof DesktopSettingsScope, unknown>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseScopeId(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return trimmed;
}

function parseStringList(
  value: unknown,
  fieldName: string,
  normalizer: (item: string) => string
): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') {
      throw new Error(`${fieldName} values must be strings.`);
    }

    const normalizedItem = normalizer(item);
    if (!normalizedItem) {
      continue;
    }

    if (seen.has(normalizedItem)) {
      continue;
    }

    seen.add(normalizedItem);
    normalized.push(normalizedItem);
  }

  return normalized;
}

function normalizeExecutableName(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeDomain(value: string): string {
  const cleanedValue = value.trim().toLowerCase();
  if (!cleanedValue) {
    return '';
  }

  const withoutProtocol = cleanedValue.replace(/^https?:\/\//, '');
  const withoutWww = withoutProtocol.replace(/^www\./, '');
  const [domainOnly] = withoutWww.split(/[/?#]/, 1);

  return domainOnly ?? '';
}

function parseEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly T[]
): T {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }

  if (!allowedValues.includes(value as T)) {
    throw new Error(
      `${fieldName} must be one of: ${allowedValues.join(', ')}.`
    );
  }

  return value as T;
}

function parseBoundedInteger(
  value: unknown,
  fieldName: string,
  minimum: number,
  maximum: number
): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  const numericValue = value as number;
  if (numericValue < minimum || numericValue > maximum) {
    throw new Error(`${fieldName} must be between ${minimum} and ${maximum}.`);
  }

  return numericValue;
}

function parseBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be a boolean.`);
  }
  return value;
}

export function createDefaultDesktopFocusSettings(): DesktopFocusSettings {
  return {
    ...DEFAULT_DESKTOP_FOCUS_SETTINGS,
    devCoreList: [...DEFAULT_DESKTOP_FOCUS_SETTINGS.devCoreList],
    ideWatchList: [...DEFAULT_DESKTOP_FOCUS_SETTINGS.ideWatchList],
    devSupportList: [...DEFAULT_DESKTOP_FOCUS_SETTINGS.devSupportList],
    devSiteList: [...DEFAULT_DESKTOP_FOCUS_SETTINGS.devSiteList],
    appBlockList: [...DEFAULT_DESKTOP_FOCUS_SETTINGS.appBlockList],
    websiteBlockList: [...DEFAULT_DESKTOP_FOCUS_SETTINGS.websiteBlockList],
  };
}

export function parseDesktopFocusSettings(
  input: unknown
): DesktopFocusSettings {
  if (!isRecord(input)) {
    throw new Error('Desktop focus settings payload must be an object.');
  }

  const raw = input as RawSettings;
  const defaults = createDefaultDesktopFocusSettings();

  const devCoreListRaw = raw.devCoreList ?? raw.ideWatchList;
  const devCoreListParsed =
    devCoreListRaw === undefined
      ? defaults.devCoreList
      : parseStringList(devCoreListRaw, 'devCoreList', normalizeExecutableName);

  return {
    devCoreList: devCoreListParsed,
    ideWatchList: devCoreListParsed,
    devSupportList:
      raw.devSupportList === undefined
        ? defaults.devSupportList
        : parseStringList(
            raw.devSupportList,
            'devSupportList',
            normalizeExecutableName
          ),
    devSiteList:
      raw.devSiteList === undefined
        ? defaults.devSiteList
        : parseStringList(raw.devSiteList, 'devSiteList', normalizeDomain),
    appBlockList:
      raw.appBlockList === undefined
        ? defaults.appBlockList
        : parseStringList(
            raw.appBlockList,
            'appBlockList',
            normalizeExecutableName
          ),
    websiteBlockList:
      raw.websiteBlockList === undefined
        ? defaults.websiteBlockList
        : parseStringList(
            raw.websiteBlockList,
            'websiteBlockList',
            normalizeDomain
          ),
    strictMode:
      raw.strictMode === undefined
        ? defaults.strictMode
        : parseEnum(raw.strictMode, 'strictMode', [
            'prompt_only',
            'prompt_then_close',
          ]),
    appActionMode:
      raw.appActionMode === undefined
        ? defaults.appActionMode
        : parseEnum(raw.appActionMode, 'appActionMode', [
            'warn',
            'warn_then_close',
          ]),
    websiteActionMode:
      raw.websiteActionMode === undefined
        ? defaults.websiteActionMode
        : parseEnum(raw.websiteActionMode, 'websiteActionMode', [
            'warn_only',
            'escalate',
          ]),
    graceSeconds:
      raw.graceSeconds === undefined
        ? defaults.graceSeconds
        : parseBoundedInteger(
            raw.graceSeconds,
            'graceSeconds',
            MIN_GRACE_SECONDS,
            MAX_GRACE_SECONDS
          ),
    reminderIntervalSeconds:
      raw.reminderIntervalSeconds === undefined
        ? defaults.reminderIntervalSeconds
        : parseBoundedInteger(
            raw.reminderIntervalSeconds,
            'reminderIntervalSeconds',
            MIN_REMINDER_INTERVAL_SECONDS,
            MAX_REMINDER_INTERVAL_SECONDS
          ),
    inactivityThresholdSeconds:
      raw.inactivityThresholdSeconds === undefined
        ? defaults.inactivityThresholdSeconds
        : parseBoundedInteger(
            raw.inactivityThresholdSeconds,
            'inactivityThresholdSeconds',
            MIN_INACTIVITY_THRESHOLD_SECONDS,
            MAX_INACTIVITY_THRESHOLD_SECONDS
          ),
    autoInactivityPause:
      raw.autoInactivityPause === undefined
        ? defaults.autoInactivityPause
        : parseBoolean(raw.autoInactivityPause, 'autoInactivityPause'),
    autoSession:
      raw.autoSession === undefined
        ? defaults.autoSession
        : parseBoolean(raw.autoSession, 'autoSession'),
    autoSessionWarmupSeconds:
      raw.autoSessionWarmupSeconds === undefined
        ? defaults.autoSessionWarmupSeconds
        : parseBoundedInteger(
            raw.autoSessionWarmupSeconds,
            'autoSessionWarmupSeconds',
            MIN_AUTO_SESSION_WARMUP_SECONDS,
            MAX_AUTO_SESSION_WARMUP_SECONDS
          ),
  };
}

export function parseDesktopSettingsScope(
  input: unknown
): DesktopSettingsScope {
  if (!isRecord(input)) {
    throw new Error('Desktop settings scope payload must be an object.');
  }

  const raw = input as RawScope;
  return {
    userId: parseScopeId(raw.userId, 'userId'),
    companyId: parseScopeId(raw.companyId, 'companyId'),
  };
}
