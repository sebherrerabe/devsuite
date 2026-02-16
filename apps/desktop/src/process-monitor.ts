import { execFile } from 'node:child_process';
import { clearInterval, setInterval } from 'node:timers';
import { promisify } from 'node:util';

import type { DesktopFocusSettings } from './focus-settings.js';
import { runtimeLog, type RuntimeLogWriter } from './runtime-logger.js';

const execFileAsync = promisify(execFile);
const DEFAULT_POLL_INTERVAL_MS = 4_000;
const MIN_POLL_INTERVAL_MS = 1_000;
const MAX_POLL_INTERVAL_MS = 60_000;
const TASKLIST_TIMEOUT_MS = 8_000;
const TASKLIST_MAX_BUFFER_BYTES = 16 * 1024 * 1024;

type ProcessCommandExecutor = typeof execFileAsync;

interface ProcessCommandError {
  code?: string | number;
  stderr?: string | Buffer;
  message?: string;
  stack?: string;
  signal?: string | null;
  killed?: boolean;
}

export type DesktopProcessCategory = 'ide' | 'app_block';
export type DesktopProcessEventType = 'process_started' | 'process_stopped';

export interface DesktopProcessEvent {
  type: DesktopProcessEventType;
  executable: string;
  pid: number;
  category: DesktopProcessCategory;
  timestamp: number;
}

export interface DesktopProcessWatchConfig {
  ideExecutables: string[];
  appExecutables: string[];
  pollIntervalMs: number;
}

export interface MonitoredProcess {
  executable: string;
  pid: number;
}

export interface RunningProcessSummary {
  executable: string;
  windowTitle: string;
}

type ProcessEntryWithCategory = MonitoredProcess & {
  category: DesktopProcessCategory;
};

export interface WindowsProcessMonitorOptions {
  onEvents: (events: DesktopProcessEvent[]) => void | Promise<void>;
  listProcesses?: () => Promise<MonitoredProcess[]>;
  logger?: RuntimeLogWriter;
}

interface ListWindowsProcessOptions {
  executor?: ProcessCommandExecutor;
  logger?: RuntimeLogWriter;
}

function normalizeExecutable(value: string): string {
  return value.trim().toLowerCase();
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let cursor = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cursor += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(cursor);
      cursor = '';
      continue;
    }

    cursor += char;
  }

  values.push(cursor);
  return values;
}

function normalizeErrorOutput(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('utf8').trim();
  }

  return '';
}

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const rawCode = (error as ProcessCommandError).code;
  if (typeof rawCode === 'number') {
    return `${rawCode}`;
  }
  if (typeof rawCode === 'string' && rawCode.trim()) {
    return rawCode.trim();
  }

  return null;
}

function getErrorStderr(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return '';
  }

  return normalizeErrorOutput((error as ProcessCommandError).stderr);
}

export function formatProcessMonitorError(error: unknown): string {
  if (error instanceof Error) {
    const details: string[] = [error.stack ?? error.message];
    const code = getErrorCode(error);
    if (code) {
      details.push(`code=${code}`);
    }

    const stderr = getErrorStderr(error);
    if (stderr) {
      details.push(`stderr=${stderr}`);
    }

    return details.join(' | ');
  }

  const code = getErrorCode(error);
  const stderr = getErrorStderr(error);
  const fallback = String(error);

  const details = [fallback];
  if (code) {
    details.push(`code=${code}`);
  }
  if (stderr) {
    details.push(`stderr=${stderr}`);
  }

  return details.join(' | ');
}

function isPermissionDeniedError(error: unknown): boolean {
  const code = getErrorCode(error);
  return code === 'EPERM' || code === 'EACCES';
}

function isTimeoutError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code === 'ETIMEDOUT') {
    return true;
  }

  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as ProcessCommandError;
  if (candidate.killed && candidate.signal) {
    return true;
  }

  if (typeof candidate.message === 'string') {
    return /timed out/i.test(candidate.message);
  }

  return false;
}

export function parseTasklistCsv(rawOutput: string): MonitoredProcess[] {
  const lines = rawOutput
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const entries: MonitoredProcess[] = [];

  for (const line of lines) {
    const columns = parseCsvLine(line);
    if (columns.length < 2) {
      continue;
    }

    const executable = normalizeExecutable(columns[0] ?? '');
    const pid = Number.parseInt(columns[1] ?? '', 10);
    if (!executable || !Number.isInteger(pid) || pid <= 0) {
      continue;
    }

    entries.push({
      executable,
      pid,
    });
  }

  return entries;
}

function normalizeWindowTitle(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'n/a') {
    return '';
  }
  return trimmed;
}

export function parseTasklistCsvVerbose(
  rawOutput: string
): RunningProcessSummary[] {
  const lines = rawOutput
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const entries: RunningProcessSummary[] = [];

  for (const line of lines) {
    const columns = parseCsvLine(line);
    if (columns.length < 9) {
      continue;
    }

    const executable = normalizeExecutable(columns[0] ?? '');
    if (!executable) {
      continue;
    }

    entries.push({
      executable,
      windowTitle: normalizeWindowTitle(columns[8] ?? ''),
    });
  }

  return entries;
}

function pickBetterRunningProcess(
  current: RunningProcessSummary,
  candidate: RunningProcessSummary
): RunningProcessSummary {
  if (!current.windowTitle && candidate.windowTitle) {
    return candidate;
  }

  if (candidate.windowTitle.length > current.windowTitle.length) {
    return candidate;
  }

  return current;
}

export function dedupeRunningProcessesByExecutable(
  entries: RunningProcessSummary[]
): RunningProcessSummary[] {
  const bestByExecutable = new Map<string, RunningProcessSummary>();

  for (const entry of entries) {
    const current = bestByExecutable.get(entry.executable);
    if (!current) {
      bestByExecutable.set(entry.executable, entry);
      continue;
    }

    bestByExecutable.set(
      entry.executable,
      pickBetterRunningProcess(current, entry)
    );
  }

  return Array.from(bestByExecutable.values()).sort((left, right) =>
    left.executable.localeCompare(right.executable)
  );
}

export function createProcessWatchConfigFromFocusSettings(
  settings: DesktopFocusSettings
): DesktopProcessWatchConfig {
  const ideExecutables = Array.from(
    new Set(settings.ideWatchList.map(normalizeExecutable).filter(Boolean))
  );
  const appExecutables = Array.from(
    new Set(settings.appBlockList.map(normalizeExecutable).filter(Boolean))
  );

  return {
    ideExecutables,
    appExecutables,
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  };
}

export function normalizeProcessWatchConfig(
  input: Partial<DesktopProcessWatchConfig>
): DesktopProcessWatchConfig {
  const ideExecutables = Array.from(
    new Set(
      (input.ideExecutables ?? []).map(normalizeExecutable).filter(Boolean)
    )
  );
  const appExecutables = Array.from(
    new Set(
      (input.appExecutables ?? []).map(normalizeExecutable).filter(Boolean)
    )
  );

  const pollCandidate = input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const safePollIntervalMs = Number.isInteger(pollCandidate)
    ? Math.max(
        MIN_POLL_INTERVAL_MS,
        Math.min(MAX_POLL_INTERVAL_MS, pollCandidate as number)
      )
    : DEFAULT_POLL_INTERVAL_MS;

  return {
    ideExecutables,
    appExecutables,
    pollIntervalMs: safePollIntervalMs,
  };
}

function getCategoryForExecutable(
  executable: string,
  ideSet: Set<string>,
  appSet: Set<string>
): DesktopProcessCategory | null {
  if (ideSet.has(executable)) {
    return 'ide';
  }

  if (appSet.has(executable)) {
    return 'app_block';
  }

  return null;
}

function toEntryKey(entry: ProcessEntryWithCategory): string {
  return `${entry.executable}:${entry.pid}`;
}

export function buildMonitoredEntries(
  allProcesses: MonitoredProcess[],
  config: DesktopProcessWatchConfig
): Map<string, ProcessEntryWithCategory> {
  const ideSet = new Set(config.ideExecutables);
  const appSet = new Set(config.appExecutables);
  const entries = new Map<string, ProcessEntryWithCategory>();

  for (const process of allProcesses) {
    const category = getCategoryForExecutable(
      process.executable,
      ideSet,
      appSet
    );
    if (!category) {
      continue;
    }

    const entry: ProcessEntryWithCategory = {
      executable: process.executable,
      pid: process.pid,
      category,
    };
    entries.set(toEntryKey(entry), entry);
  }

  return entries;
}

export function diffProcessEntries(
  previous: Map<string, ProcessEntryWithCategory>,
  next: Map<string, ProcessEntryWithCategory>,
  timestamp: number,
  logger: RuntimeLogWriter = runtimeLog
): DesktopProcessEvent[] {
  const events: DesktopProcessEvent[] = [];

  for (const [key, entry] of next.entries()) {
    if (previous.has(key)) {
      continue;
    }

    logger.debug(
      'process-monitor',
      `process transition: type=process_started executable=${entry.executable} pid=${entry.pid} category=${entry.category}`
    );
    events.push({
      type: 'process_started',
      executable: entry.executable,
      pid: entry.pid,
      category: entry.category,
      timestamp,
    });
  }

  for (const [key, entry] of previous.entries()) {
    if (next.has(key)) {
      continue;
    }

    logger.debug(
      'process-monitor',
      `process transition: type=process_stopped executable=${entry.executable} pid=${entry.pid} category=${entry.category}`
    );
    events.push({
      type: 'process_stopped',
      executable: entry.executable,
      pid: entry.pid,
      category: entry.category,
      timestamp,
    });
  }

  return events;
}

function logTasklistCommandFailure(params: {
  command: string;
  error: unknown;
  logger: RuntimeLogWriter;
  verbose: boolean;
}): void {
  const code = getErrorCode(params.error) ?? 'unknown';
  const stderr = getErrorStderr(params.error) || 'n/a';

  params.logger.error(
    'process-monitor',
    `tasklist failed: command=${params.command}, exitCode=${code}, stderr=${stderr}, details=${formatProcessMonitorError(params.error)}`
  );

  if (isPermissionDeniedError(params.error)) {
    params.logger.warn(
      'process-monitor',
      'tasklist returned EPERM/EACCES. Try running the desktop app with elevated permissions.'
    );
  }

  if (params.verbose && isTimeoutError(params.error)) {
    params.logger.warn(
      'process-monitor',
      `tasklist verbose command timed out after ${TASKLIST_TIMEOUT_MS}ms`
    );
  }
}

export async function listWindowsProcesses(
  options: ListWindowsProcessOptions = {}
): Promise<MonitoredProcess[]> {
  const executor = options.executor ?? execFileAsync;
  const logger = options.logger ?? runtimeLog;

  try {
    const { stdout } = await executor('tasklist', ['/fo', 'csv', '/nh'], {
      windowsHide: true,
      timeout: TASKLIST_TIMEOUT_MS,
      maxBuffer: TASKLIST_MAX_BUFFER_BYTES,
    });
    return parseTasklistCsv(String(stdout));
  } catch (error) {
    logTasklistCommandFailure({
      command: 'tasklist /fo csv /nh',
      error,
      logger,
      verbose: false,
    });
    throw error;
  }
}

export async function listWindowsProcessesVerbose(
  options: ListWindowsProcessOptions = {}
): Promise<RunningProcessSummary[]> {
  const executor = options.executor ?? execFileAsync;
  const logger = options.logger ?? runtimeLog;

  try {
    const { stdout } = await executor('tasklist', ['/fo', 'csv', '/v', '/nh'], {
      windowsHide: true,
      timeout: TASKLIST_TIMEOUT_MS,
      maxBuffer: TASKLIST_MAX_BUFFER_BYTES,
    });
    return dedupeRunningProcessesByExecutable(
      parseTasklistCsvVerbose(String(stdout))
    );
  } catch (error) {
    logTasklistCommandFailure({
      command: 'tasklist /fo csv /v /nh',
      error,
      logger,
      verbose: true,
    });
    throw error;
  }
}

export function shouldMonitorProcesses(
  config: DesktopProcessWatchConfig
): boolean {
  return config.ideExecutables.length > 0 || config.appExecutables.length > 0;
}

export class WindowsProcessMonitor {
  private readonly onEvents: WindowsProcessMonitorOptions['onEvents'];
  private readonly listProcesses: () => Promise<MonitoredProcess[]>;
  private readonly logger: RuntimeLogWriter;
  private config: DesktopProcessWatchConfig = normalizeProcessWatchConfig({});
  private timer: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;
  private previousEntries = new Map<string, ProcessEntryWithCategory>();

  constructor(options: WindowsProcessMonitorOptions) {
    this.onEvents = options.onEvents;
    this.listProcesses = options.listProcesses ?? listWindowsProcesses;
    this.logger = options.logger ?? runtimeLog;
  }

  setConfig(nextConfig: Partial<DesktopProcessWatchConfig>): void {
    this.config = normalizeProcessWatchConfig(nextConfig);
    this.logger.info(
      'process-monitor',
      `config updated: ideExecutables=${this.config.ideExecutables.join('|') || 'none'}, appExecutables=${this.config.appExecutables.join('|') || 'none'}, pollIntervalMs=${this.config.pollIntervalMs}`
    );
    this.previousEntries.clear();
    this.restart();
  }

  getConfig(): DesktopProcessWatchConfig {
    return this.config;
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.previousEntries.clear();
    this.isPolling = false;
  }

  private restart(): void {
    this.stop();

    if (!shouldMonitorProcesses(this.config)) {
      return;
    }

    if (process.platform !== 'win32') {
      return;
    }

    this.timer = setInterval(() => {
      void this.pollOnce();
    }, this.config.pollIntervalMs);

    void this.pollOnce();
  }

  private async pollOnce(): Promise<void> {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    try {
      const allProcesses = await this.listProcesses();
      const nextEntries = buildMonitoredEntries(allProcesses, this.config);
      const now = Date.now();
      const events = diffProcessEntries(
        this.previousEntries,
        nextEntries,
        now,
        this.logger
      );
      this.previousEntries = nextEntries;

      if (events.length > 0) {
        await this.onEvents(events);
      }
    } catch (error) {
      this.logger.error(
        'process-monitor',
        `pollOnce failed: ${formatProcessMonitorError(error)}`
      );
    } finally {
      this.isPolling = false;
    }
  }
}
