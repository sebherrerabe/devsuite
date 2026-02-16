import { execFile as nodeExecFile } from 'node:child_process';
import {
  readFile as nodeReadFile,
  writeFile as nodeWriteFile,
} from 'node:fs/promises';
import { promisify } from 'node:util';

import { runtimeLog, type RuntimeLogWriter } from './runtime-logger.js';

const execFileAsync = promisify(nodeExecFile);

export const HOSTS_PATH = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
export const BEGIN_MARKER = '# BEGIN DEVSUITE BLOCK';
export const END_MARKER = '# END DEVSUITE BLOCK';

type ReadFileLike = typeof nodeReadFile;
type WriteFileLike = typeof nodeWriteFile;
type ExecFileLike = typeof execFileAsync;

interface FsErrorLike {
  code?: string;
}

export interface HostsManagerOptions {
  hostsPath?: string;
  logger?: RuntimeLogWriter;
  readFile?: ReadFileLike;
  writeFile?: WriteFileLike;
  execFile?: ExecFileLike;
  platform?: string;
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

async function writeHostsFile(params: {
  hostsPath: string;
  contents: string;
  writeFile: WriteFileLike;
  execFile: ExecFileLike;
  logger: RuntimeLogWriter;
  platform: string;
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

    if (params.platform !== 'win32') {
      params.logger.warn(
        'hosts-manager',
        'permission denied and no elevation strategy for non-Windows platform; falling back to notification-only mode'
      );
      return false;
    }

    try {
      await params.execFile(
        'powershell',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `[IO.File]::WriteAllText('${params.hostsPath.replace(/'/g, "''")}', @'${params.contents.replace(/\r/g, '')}'@)`,
        ],
        {
          windowsHide: true,
          timeout: 15_000,
          maxBuffer: 2 * 1024 * 1024,
        }
      );
      params.logger.info(
        'hosts-manager',
        'elevated hosts write command completed'
      );
      return true;
    } catch (elevatedError) {
      params.logger.error(
        'hosts-manager',
        `elevated hosts write failed; falling back to notification-only mode: ${elevatedError instanceof Error ? elevatedError.message : String(elevatedError)}`
      );
      return false;
    }
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
    execFile: options.execFile ?? execFileAsync,
    platform: options.platform ?? process.platform,
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

  resolved.logger.info(
    'hosts-manager',
    `blocking domains via hosts file: ${normalizedDomains.join(',')}`
  );

  const applied = await writeHostsFile({
    hostsPath: resolved.hostsPath,
    contents: nextContents,
    writeFile: resolved.writeFile,
    execFile: resolved.execFile,
    logger: resolved.logger,
    platform: resolved.platform,
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
    writeFile: resolved.writeFile,
    execFile: resolved.execFile,
    logger: resolved.logger,
    platform: resolved.platform,
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

  return blockDomains(next, params.options);
}
