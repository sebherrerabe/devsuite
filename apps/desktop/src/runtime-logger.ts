import { appendFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const DEFAULT_LOG_FILE_NAME = 'desktop-runtime.log';
const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_QUEUED_LINES = 5_000;

export type RuntimeLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type RuntimeLogSubsystem =
  | 'process-monitor'
  | 'strict-policy'
  | 'website-block'
  | 'session-sync'
  | 'hosts-manager'
  | 'widget';

export interface RuntimeLogWriter {
  debug(subsystem: RuntimeLogSubsystem, message: string): void;
  info(subsystem: RuntimeLogSubsystem, message: string): void;
  warn(subsystem: RuntimeLogSubsystem, message: string): void;
  error(subsystem: RuntimeLogSubsystem, message: string): void;
}

interface ElectronAppLike {
  isReady: () => boolean;
  getPath: (name: 'userData') => string;
  whenReady?: () => Promise<void>;
}

interface RuntimeLoggerFs {
  appendFile: typeof appendFile;
  mkdir: typeof mkdir;
  rename: typeof rename;
  rm: typeof rm;
  stat: typeof stat;
}

interface FsErrorLike {
  code?: string;
}

export interface RuntimeLoggerOptions {
  logDirPath?: string;
  logFilePath?: string;
  logFileName?: string;
  maxFileBytes?: number;
  now?: () => Date;
  getApp?: () => ElectronAppLike | null;
  fsOps?: Partial<RuntimeLoggerFs>;
}

const defaultFsOps: RuntimeLoggerFs = {
  appendFile,
  mkdir,
  rename,
  rm,
  stat,
};

function resolveElectronApp(): ElectronAppLike | null {
  try {
    const electronModule = require('electron') as {
      app?: ElectronAppLike;
    };

    if (
      electronModule.app &&
      typeof electronModule.app.isReady === 'function' &&
      typeof electronModule.app.getPath === 'function'
    ) {
      return electronModule.app;
    }
  } catch {
    // Electron is unavailable in non-desktop test/runtime contexts.
  }

  return null;
}

function isFsErrorWithCode(error: unknown, code: string): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as FsErrorLike).code === code;
}

function normalizeMessage(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim();
}

export class RuntimeLogger implements RuntimeLogWriter {
  private readonly logFileName: string;
  private readonly maxFileBytes: number;
  private readonly now: () => Date;
  private readonly getApp: () => ElectronAppLike | null;
  private readonly fsOps: RuntimeLoggerFs;

  private queue: string[] = [];
  private writeChain: Promise<void> = Promise.resolve();
  private flushScheduled = false;
  private attachedWhenReadyHook = false;
  private logFilePath: string | null;

  constructor(options: RuntimeLoggerOptions = {}) {
    this.logFileName = options.logFileName ?? DEFAULT_LOG_FILE_NAME;
    this.maxFileBytes = Math.max(
      1,
      Math.trunc(options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES)
    );
    this.now = options.now ?? (() => new Date());
    this.getApp = options.getApp ?? resolveElectronApp;
    this.fsOps = {
      ...defaultFsOps,
      ...(options.fsOps ?? {}),
    };

    if (options.logFilePath) {
      this.logFilePath = options.logFilePath;
    } else if (options.logDirPath) {
      this.logFilePath = join(options.logDirPath, this.logFileName);
    } else {
      this.logFilePath = null;
    }

    this.attachWhenReadyFlush();
    void this.resolveLogFilePath();
  }

  setLogDir(logDirPath: string): void {
    this.logFilePath = join(logDirPath, this.logFileName);
    this.scheduleFlush();
  }

  setLogFilePath(logFilePath: string): void {
    this.logFilePath = logFilePath;
    this.scheduleFlush();
  }

  debug(subsystem: RuntimeLogSubsystem, message: string): void {
    this.enqueue('debug', subsystem, message);
  }

  info(subsystem: RuntimeLogSubsystem, message: string): void {
    this.enqueue('info', subsystem, message);
  }

  warn(subsystem: RuntimeLogSubsystem, message: string): void {
    this.enqueue('warn', subsystem, message);
  }

  error(subsystem: RuntimeLogSubsystem, message: string): void {
    this.enqueue('error', subsystem, message);
  }

  async flush(): Promise<void> {
    this.scheduleFlush();
    await this.writeChain;
  }

  private enqueue(
    level: RuntimeLogLevel,
    subsystem: RuntimeLogSubsystem,
    message: string
  ): void {
    const timestamp = this.now().toISOString();
    const line = `[${timestamp}] [${level.toUpperCase()}] [${subsystem}] ${normalizeMessage(message)}\n`;
    this.queue.push(line);

    if (this.queue.length > MAX_QUEUED_LINES) {
      this.queue = this.queue.slice(-MAX_QUEUED_LINES);
    }

    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) {
      return;
    }

    this.flushScheduled = true;
    this.writeChain = this.writeChain
      .then(async () => {
        this.flushScheduled = false;
        await this.flushQueue();
      })
      .catch(() => {
        this.flushScheduled = false;
      });
  }

  private attachWhenReadyFlush(): void {
    if (this.attachedWhenReadyHook || this.logFilePath) {
      return;
    }

    const app = this.getApp();
    if (!app || typeof app.whenReady !== 'function') {
      return;
    }

    this.attachedWhenReadyHook = true;
    void app
      .whenReady()
      .then(async () => {
        await this.resolveLogFilePath();
        this.scheduleFlush();
      })
      .catch(() => {
        // Keep logger non-fatal if app bootstrap fails.
      });
  }

  private async resolveLogFilePath(): Promise<void> {
    if (this.logFilePath) {
      return;
    }

    const app = this.getApp();
    if (!app || !app.isReady()) {
      this.attachWhenReadyFlush();
      return;
    }

    const userDataPath = app.getPath('userData');
    this.logFilePath = join(userDataPath, 'logs', this.logFileName);
  }

  private async rotateIfNeeded(incomingBytes: number): Promise<void> {
    if (!this.logFilePath) {
      return;
    }

    let currentSize = 0;
    try {
      const metadata = await this.fsOps.stat(this.logFilePath);
      currentSize = metadata.size;
    } catch (error) {
      if (!isFsErrorWithCode(error, 'ENOENT')) {
        throw error;
      }
    }

    if (currentSize + incomingBytes <= this.maxFileBytes) {
      return;
    }

    const rotatedPath = `${this.logFilePath}.1`;
    await this.fsOps.rm(rotatedPath, { force: true });

    try {
      await this.fsOps.rename(this.logFilePath, rotatedPath);
    } catch (error) {
      if (!isFsErrorWithCode(error, 'ENOENT')) {
        throw error;
      }
    }
  }

  private async flushQueue(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    await this.resolveLogFilePath();
    if (!this.logFilePath) {
      return;
    }

    const pendingLines = this.queue.splice(0, this.queue.length);

    try {
      await this.fsOps.mkdir(dirname(this.logFilePath), {
        recursive: true,
      });

      const payload = pendingLines.join('');
      await this.rotateIfNeeded(Buffer.byteLength(payload, 'utf8'));
      await this.fsOps.appendFile(this.logFilePath, payload, 'utf8');
    } catch {
      this.queue.unshift(...pendingLines);

      if (this.queue.length > MAX_QUEUED_LINES) {
        this.queue = this.queue.slice(-MAX_QUEUED_LINES);
      }
    }
  }
}

export const runtimeLog = new RuntimeLogger();
