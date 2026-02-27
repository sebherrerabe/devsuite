import { execFile as nodeExecFile } from 'node:child_process';
import {
  readFile as nodeReadFile,
  mkdir as nodeMkdir,
  writeFile as nodeWriteFile,
} from 'node:fs/promises';
import { join as joinPath } from 'node:path';
import { promisify } from 'node:util';

import { runtimeLog, type RuntimeLogWriter } from './runtime-logger.js';

const execFileAsync = promisify(nodeExecFile);

export const HOSTS_PATH = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
export const BEGIN_MARKER = '# BEGIN DEVSUITE BLOCK';
export const END_MARKER = '# END DEVSUITE BLOCK';
export const HOSTS_WRITE_HELPER_FLAG = '--devsuite-hosts-write';
export const HOSTS_WRITE_HELPER_PATH_ARG = '--hosts-path';
export const HOSTS_WRITE_HELPER_BASE64_ARG = '--hosts-base64';
export const HOSTS_WRITE_HELPER_TASK_NAME = 'DevSuiteHostsWriteHelper';
export const HOSTS_WRITE_HELPER_DIR_SEGMENTS = ['DevSuite', 'hosts-helper'];
export const HOSTS_WRITE_HELPER_REQUEST_FILENAME = 'request.json';
export const HOSTS_WRITE_HELPER_RESULT_FILENAME = 'result.json';
const HOSTS_WRITE_HELPER_TIMEOUT_MS = 15_000;
const HOSTS_WRITE_HELPER_POLL_INTERVAL_MS = 200;

type ReadFileLike = typeof nodeReadFile;
type WriteFileLike = typeof nodeWriteFile;
type ExecFileLike = typeof execFileAsync;
type MkdirLike = typeof nodeMkdir;

interface FsErrorLike {
  code?: string;
}

export interface HostsManagerOptions {
  hostsPath?: string;
  logger?: RuntimeLogWriter;
  readFile?: ReadFileLike;
  writeFile?: WriteFileLike;
  mkdir?: MkdirLike;
  execFile?: ExecFileLike;
  platform?: string;
  programDataPath?: string;
  helperTaskName?: string;
  helperTimeoutMs?: number;
}

function isPermissionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as FsErrorLike).code;
  return code === 'EACCES' || code === 'EPERM';
}

function ensureTrailingNewline(input: string): string {
  return input.endsWith('\n') ? input : `${input}\n`;
}

function normalizeHostsText(input: string): string {
  return input.replace(/\r\n/g, '\n').trim();
}

export function normalizeHostsDomain(domain: string): string {
  const value = domain.trim().toLowerCase();
  if (!value) {
    return '';
  }

  const withoutProtocol = value.replace(/^https?:\/\//, '');
  const withoutWww = withoutProtocol.replace(/^www\./, '');
  const [host] = withoutWww.split(/[/?#]/, 1);

  return (host ?? '').trim();
}

export function normalizeHostsDomains(domains: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const candidate of domains) {
    const value = normalizeHostsDomain(candidate);
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

export function stripDevSuiteHostsBlock(contents: string): string {
  const beginIndex = contents.indexOf(BEGIN_MARKER);
  const endIndex = contents.indexOf(END_MARKER);

  if (beginIndex === -1 || endIndex === -1 || endIndex < beginIndex) {
    return contents;
  }

  const endMarkerEnd = endIndex + END_MARKER.length;
  const suffixStartsWithLineBreak = /\r?\n/.test(
    contents.slice(endMarkerEnd, endMarkerEnd + 2)
  );
  const removeUntil = suffixStartsWithLineBreak
    ? endMarkerEnd + 1
    : endMarkerEnd;

  const before = contents.slice(0, beginIndex).replace(/[\t ]*\r?\n?$/, '');
  const after = contents.slice(removeUntil).replace(/^\r?\n/, '');

  if (!before && !after) {
    return '';
  }
  if (!before) {
    return ensureTrailingNewline(after);
  }
  if (!after) {
    return ensureTrailingNewline(before);
  }

  return ensureTrailingNewline(`${before}\n${after}`);
}

export function buildDevSuiteHostsBlock(domains: string[]): string {
  const normalizedDomains = normalizeHostsDomains(domains);
  const lines = [BEGIN_MARKER];

  for (const domain of normalizedDomains) {
    lines.push(`127.0.0.1 ${domain}`);
    lines.push(`127.0.0.1 www.${domain}`);
  }

  lines.push(END_MARKER);
  return `${lines.join('\n')}\n`;
}

async function readHostsFile(params: {
  hostsPath: string;
  readFile: ReadFileLike;
  logger: RuntimeLogWriter;
}): Promise<string> {
  try {
    const contents = await params.readFile(params.hostsPath, 'utf8');
    return contents;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      (error as FsErrorLike).code === 'ENOENT'
    ) {
      params.logger.warn(
        'hosts-manager',
        `hosts file not found at ${params.hostsPath}; starting from empty content`
      );
      return '';
    }

    throw error;
  }
}

function resolveHostsWriteHelperPaths(programDataPath: string): {
  helperDirectoryPath: string;
  requestPath: string;
  resultPath: string;
} {
  const helperDirectoryPath = joinPath(
    programDataPath,
    ...HOSTS_WRITE_HELPER_DIR_SEGMENTS
  );
  return {
    helperDirectoryPath,
    requestPath: joinPath(
      helperDirectoryPath,
      HOSTS_WRITE_HELPER_REQUEST_FILENAME
    ),
    resultPath: joinPath(
      helperDirectoryPath,
      HOSTS_WRITE_HELPER_RESULT_FILENAME
    ),
  };
}

function isHostsWriteHelperResultRecord(value: unknown): value is {
  requestId?: unknown;
  ok?: unknown;
  error?: unknown;
} {
  return typeof value === 'object' && value !== null;
}

async function writeWithRegisteredHelper(params: {
  hostsPath: string;
  contents: string;
  readFile: ReadFileLike;
  writeFile: WriteFileLike;
  mkdir: MkdirLike;
  execFile: ExecFileLike;
  logger: RuntimeLogWriter;
  platform: string;
  programDataPath: string;
  helperTaskName: string;
  helperTimeoutMs: number;
}): Promise<boolean> {
  if (params.platform !== 'win32') {
    return false;
  }

  const paths = resolveHostsWriteHelperPaths(params.programDataPath);
  try {
    await params.mkdir(paths.helperDirectoryPath, {
      recursive: true,
    });
  } catch (error) {
    params.logger.warn(
      'hosts-manager',
      `failed to prepare helper directory at ${paths.helperDirectoryPath}: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }

  try {
    await params.execFile('schtasks', ['/Query', '/TN', params.helperTaskName]);
  } catch {
    params.logger.warn(
      'hosts-manager',
      `hosts helper task "${params.helperTaskName}" is unavailable; reinstall DevSuite to restore installer-level permissions`
    );
    return false;
  }

  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const requestPayload = JSON.stringify({
    requestId,
    hostsPath: params.hostsPath,
    encodedContents: Buffer.from(params.contents, 'utf8').toString('base64'),
  });

  try {
    await params.writeFile(paths.requestPath, requestPayload, 'utf8');
    await params.writeFile(paths.resultPath, '', 'utf8');
  } catch (error) {
    params.logger.warn(
      'hosts-manager',
      `failed to stage helper request payload: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }

  try {
    await params.execFile('schtasks', ['/Run', '/TN', params.helperTaskName], {
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    params.logger.warn(
      'hosts-manager',
      `failed to invoke helper task "${params.helperTaskName}": ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }

  const timeoutAt = Date.now() + params.helperTimeoutMs;
  while (Date.now() < timeoutAt) {
    await new Promise(resolve =>
      globalThis.setTimeout(resolve, HOSTS_WRITE_HELPER_POLL_INTERVAL_MS)
    );

    let rawResult = '';
    try {
      rawResult = await params.readFile(paths.resultPath, 'utf8');
    } catch {
      continue;
    }

    if (!rawResult.trim()) {
      continue;
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(rawResult);
    } catch {
      continue;
    }

    if (!isHostsWriteHelperResultRecord(parsed)) {
      continue;
    }

    if (parsed.requestId !== requestId) {
      continue;
    }

    if (parsed.ok === true) {
      params.logger.info(
        'hosts-manager',
        `hosts file updated via installer helper task: ${params.helperTaskName}`
      );
      return true;
    }

    params.logger.warn(
      'hosts-manager',
      `helper task failed to write hosts file: ${typeof parsed.error === 'string' ? parsed.error : 'unknown error'}`
    );
    return false;
  }

  params.logger.warn(
    'hosts-manager',
    `helper task timed out while writing hosts file: ${params.helperTaskName}`
  );
  return false;
}

async function writeHostsFile(params: {
  hostsPath: string;
  contents: string;
  readFile: ReadFileLike;
  writeFile: WriteFileLike;
  mkdir: MkdirLike;
  execFile: ExecFileLike;
  logger: RuntimeLogWriter;
  platform: string;
  programDataPath: string;
  helperTaskName: string;
  helperTimeoutMs: number;
}): Promise<boolean> {
  try {
    await params.writeFile(params.hostsPath, params.contents, 'utf8');
    params.logger.info(
      'hosts-manager',
      `hosts file updated: ${params.hostsPath}`
    );
    return true;
  } catch (error) {
    if (!isPermissionError(error)) {
      throw error;
    }

    params.logger.warn(
      'hosts-manager',
      `hosts write permission denied at ${params.hostsPath}; attempting elevated fallback`
    );

    const appliedWithHelper = await writeWithRegisteredHelper({
      hostsPath: params.hostsPath,
      contents: params.contents,
      readFile: params.readFile,
      writeFile: params.writeFile,
      mkdir: params.mkdir,
      execFile: params.execFile,
      logger: params.logger,
      platform: params.platform,
      programDataPath: params.programDataPath,
      helperTaskName: params.helperTaskName,
      helperTimeoutMs: params.helperTimeoutMs,
    });
    if (appliedWithHelper) {
      return true;
    }

    params.logger.warn(
      'hosts-manager',
      'hosts helper is unavailable or failed; focus mode will continue without hosts enforcement until helper permissions are restored'
    );
    return false;
  }
}

async function flushDns(params: {
  execFile: ExecFileLike;
  logger: RuntimeLogWriter;
  platform: string;
}): Promise<void> {
  if (params.platform !== 'win32') {
    return;
  }

  try {
    await params.execFile('ipconfig', ['/flushdns'], {
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
    params.logger.info(
      'hosts-manager',
      'dns cache flushed with ipconfig /flushdns'
    );
  } catch (error) {
    params.logger.warn(
      'hosts-manager',
      `failed to flush dns: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function resolveOptions(options: HostsManagerOptions = {}) {
  return {
    hostsPath: options.hostsPath ?? HOSTS_PATH,
    logger: options.logger ?? runtimeLog,
    readFile: options.readFile ?? nodeReadFile,
    writeFile: options.writeFile ?? nodeWriteFile,
    mkdir: options.mkdir ?? nodeMkdir,
    execFile: options.execFile ?? execFileAsync,
    platform: options.platform ?? process.platform,
    programDataPath:
      // nosemgrep: semgrep.devsuite-process-env-without-validation
      options.programDataPath ?? process.env.ProgramData ?? 'C:\\ProgramData',
    helperTaskName: options.helperTaskName ?? HOSTS_WRITE_HELPER_TASK_NAME,
    helperTimeoutMs: options.helperTimeoutMs ?? HOSTS_WRITE_HELPER_TIMEOUT_MS,
  };
}

export async function blockDomains(
  domains: string[],
  options?: HostsManagerOptions
): Promise<{ applied: boolean; normalizedDomains: string[] }> {
  const resolved = resolveOptions(options);
  const normalizedDomains = normalizeHostsDomains(domains);

  if (normalizedDomains.length === 0) {
    resolved.logger.debug(
      'hosts-manager',
      'blockDomains no-op: empty domain list'
    );
    return {
      applied: false,
      normalizedDomains,
    };
  }

  const existing = await readHostsFile({
    hostsPath: resolved.hostsPath,
    readFile: resolved.readFile,
    logger: resolved.logger,
  });
  const stripped = stripDevSuiteHostsBlock(existing);
  const block = buildDevSuiteHostsBlock(normalizedDomains);
  const nextContents = stripped.trim()
    ? ensureTrailingNewline(stripped.trim()) + '\n' + block
    : block;

  if (normalizeHostsText(nextContents) === normalizeHostsText(existing)) {
    resolved.logger.info(
      'hosts-manager',
      `blockDomains no-op: hosts block already matches requested domains (${normalizedDomains.join(',')})`
    );
    return {
      applied: false,
      normalizedDomains,
    };
  }

  resolved.logger.info(
    'hosts-manager',
    `blocking domains via hosts file: ${normalizedDomains.join(',')}`
  );

  const applied = await writeHostsFile({
    hostsPath: resolved.hostsPath,
    contents: nextContents,
    readFile: resolved.readFile,
    writeFile: resolved.writeFile,
    mkdir: resolved.mkdir,
    execFile: resolved.execFile,
    logger: resolved.logger,
    platform: resolved.platform,
    programDataPath: resolved.programDataPath,
    helperTaskName: resolved.helperTaskName,
    helperTimeoutMs: resolved.helperTimeoutMs,
  });

  if (applied) {
    await flushDns({
      execFile: resolved.execFile,
      logger: resolved.logger,
      platform: resolved.platform,
    });
  }

  return {
    applied,
    normalizedDomains,
  };
}

export async function unblockAll(
  options?: HostsManagerOptions
): Promise<{ applied: boolean }> {
  const resolved = resolveOptions(options);
  const existing = await readHostsFile({
    hostsPath: resolved.hostsPath,
    readFile: resolved.readFile,
    logger: resolved.logger,
  });
  const stripped = stripDevSuiteHostsBlock(existing);

  if (stripped === existing) {
    resolved.logger.debug(
      'hosts-manager',
      'unblockAll no-op: no managed hosts block found'
    );
    return {
      applied: false,
    };
  }

  resolved.logger.info('hosts-manager', 'removing managed hosts block');
  const applied = await writeHostsFile({
    hostsPath: resolved.hostsPath,
    contents: stripped,
    readFile: resolved.readFile,
    writeFile: resolved.writeFile,
    mkdir: resolved.mkdir,
    execFile: resolved.execFile,
    logger: resolved.logger,
    platform: resolved.platform,
    programDataPath: resolved.programDataPath,
    helperTaskName: resolved.helperTaskName,
    helperTimeoutMs: resolved.helperTimeoutMs,
  });

  if (applied) {
    await flushDns({
      execFile: resolved.execFile,
      logger: resolved.logger,
      platform: resolved.platform,
    });
  }

  return {
    applied,
  };
}

export async function cleanupStaleBlocks(
  options?: HostsManagerOptions
): Promise<{ applied: boolean }> {
  return unblockAll(options);
}

export async function reconcileDomains(params: {
  currentDomains: string[];
  newDomains: string[];
  options?: HostsManagerOptions;
}): Promise<{ applied: boolean; normalizedDomains: string[] }> {
  const current = normalizeHostsDomains(params.currentDomains);
  const next = normalizeHostsDomains(params.newDomains);

  if (
    current.length === next.length &&
    current.every((domain, index) => domain === next[index])
  ) {
    return {
      applied: false,
      normalizedDomains: next,
    };
  }

  if (next.length === 0) {
    const unblocked = await unblockAll(params.options);
    return {
      applied: unblocked.applied,
      normalizedDomains: next,
    };
  }

  return blockDomains(next, params.options);
}
