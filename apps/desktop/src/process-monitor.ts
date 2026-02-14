import { execFile } from 'node:child_process';
import { clearInterval, setInterval } from 'node:timers';
import { promisify } from 'node:util';

import type { DesktopFocusSettings } from './focus-settings.js';

const execFileAsync = promisify(execFile);
const DEFAULT_POLL_INTERVAL_MS = 4_000;
const MIN_POLL_INTERVAL_MS = 1_000;
const MAX_POLL_INTERVAL_MS = 60_000;

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

type ProcessEntryWithCategory = MonitoredProcess & {
  category: DesktopProcessCategory;
};

export interface WindowsProcessMonitorOptions {
  onEvents: (events: DesktopProcessEvent[]) => void | Promise<void>;
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
  timestamp: number
): DesktopProcessEvent[] {
  const events: DesktopProcessEvent[] = [];

  for (const [key, entry] of next.entries()) {
    if (previous.has(key)) {
      continue;
    }

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

async function listWindowsProcesses(): Promise<MonitoredProcess[]> {
  const { stdout } = await execFileAsync('tasklist', ['/fo', 'csv', '/nh'], {
    windowsHide: true,
    timeout: 8_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return parseTasklistCsv(stdout);
}

export function shouldMonitorProcesses(
  config: DesktopProcessWatchConfig
): boolean {
  return config.ideExecutables.length > 0 || config.appExecutables.length > 0;
}

export class WindowsProcessMonitor {
  private readonly onEvents: WindowsProcessMonitorOptions['onEvents'];
  private config: DesktopProcessWatchConfig = normalizeProcessWatchConfig({});
  private timer: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;
  private previousEntries = new Map<string, ProcessEntryWithCategory>();

  constructor(options: WindowsProcessMonitorOptions) {
    this.onEvents = options.onEvents;
  }

  setConfig(nextConfig: Partial<DesktopProcessWatchConfig>): void {
    this.config = normalizeProcessWatchConfig(nextConfig);
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
      const allProcesses = await listWindowsProcesses();
      const nextEntries = buildMonitoredEntries(allProcesses, this.config);
      const now = Date.now();
      const events = diffProcessEntries(this.previousEntries, nextEntries, now);
      this.previousEntries = nextEntries;

      if (events.length > 0) {
        await this.onEvents(events);
      }
    } catch {
      // Keep the monitor alive on transient tasklist failures.
    } finally {
      this.isPolling = false;
    }
  }
}
