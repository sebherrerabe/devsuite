import { spawn } from 'node:child_process';
import { clearTimeout, setTimeout } from 'node:timers';
import type { Logger } from './logger.js';
import { maskUserId } from './logging-utils.js';

const DEFAULT_TIMEOUT_MS = 15_000;

const allowedCommands = [
  'pr-list',
  'pr-view',
  'pr-diff',
  'pr-checks',
  'notifications-list',
] as const;

type AllowedCommand = (typeof allowedCommands)[number];

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CommandAuditContext {
  actorId: string;
  logger: Logger;
}

export interface PrDiscoverParams {
  token: string;
  repo: string;
  state: 'open' | 'closed' | 'merged' | 'all';
  limit: number;
  audit?: CommandAuditContext;
}

export interface DiscoveredPr {
  number: number;
  title: string;
  url: string;
  state: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  authorLogin: string | null;
  headRefName: string;
  baseRefName: string;
}

export interface PullRequestBundleParams {
  token: string;
  repo: string;
  number: number;
  includeChecks: boolean;
  audit?: CommandAuditContext;
}

export interface PullRequestBundleFile {
  path: string;
  additions: number;
  deletions: number;
}

export interface PullRequestBundleCommit {
  oid: string;
  message: string;
}

export interface PullRequestBundleMetadata {
  title: string;
  body: string;
  author: {
    login: string;
  };
  state: string;
  baseRefName: string;
  headRefName: string;
  files: PullRequestBundleFile[];
  additions: number;
  deletions: number;
  commits: PullRequestBundleCommit[];
  createdAt: string;
  updatedAt: string;
}

export interface PullRequestBundleData {
  metadata: PullRequestBundleMetadata;
  diff: string;
  checks: unknown | null;
}

export interface GhNotification {
  threadId: string;
  reason: string;
  title: string;
  url: string | null;
  repoFullName: string | null;
  orgLogin: string | null;
  subjectType: string | null;
  updatedAt: number | null;
  unread: boolean;
  apiUrl: string | null;
}

export class GhRunnerError extends Error {
  constructor(
    readonly code: 'COMMAND_FAILED' | 'INVALID_OUTPUT',
    message: string
  ) {
    super(message);
  }
}

function runCommand(
  commandClass: AllowedCommand,
  token: string,
  args: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
  audit?: CommandAuditContext
): Promise<CommandResult> {
  if (!allowedCommands.includes(commandClass)) {
    throw new GhRunnerError(
      'COMMAND_FAILED',
      `Command class is not allowlisted: ${commandClass}`
    );
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn('gh', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GH_TOKEN: token,
        GH_HOST: 'github.com',
        GH_NO_UPDATE_NOTIFIER: '1',
        NO_COLOR: '1',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += String(chunk);
    });

    child.stderr.on('data', chunk => {
      stderr += String(chunk);
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      if (audit) {
        audit.logger.warn('gh command execution completed', {
          actor: maskUserId(audit.actorId),
          commandClass,
          outcome: 'timeout',
          durationMs: Date.now() - startedAt,
        });
      }
      reject(
        new GhRunnerError(
          'COMMAND_FAILED',
          `GitHub CLI command timed out (${commandClass})`
        )
      );
    }, timeoutMs);

    child.once('error', error => {
      clearTimeout(timer);
      if (audit) {
        audit.logger.error('gh command execution failed', {
          actor: maskUserId(audit.actorId),
          commandClass,
          outcome: 'spawn_error',
          durationMs: Date.now() - startedAt,
          error: error.message,
        });
      }
      reject(new GhRunnerError('COMMAND_FAILED', error.message));
    });

    child.once('close', code => {
      clearTimeout(timer);
      if (audit) {
        audit.logger.info('gh command execution completed', {
          actor: maskUserId(audit.actorId),
          commandClass,
          outcome: (code ?? 1) === 0 ? 'success' : 'failure',
          exitCode: code ?? 1,
          durationMs: Date.now() - startedAt,
        });
      }
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

function getFailureReason(result: CommandResult): string {
  return (
    result.stderr.trim() || result.stdout.trim() || 'Unknown GitHub CLI failure'
  );
}

async function runJsonCommand(
  commandClass: AllowedCommand,
  token: string,
  args: string[],
  invalidOutputMessage: string,
  audit?: CommandAuditContext
): Promise<unknown> {
  const result = await runCommand(
    commandClass,
    token,
    args,
    DEFAULT_TIMEOUT_MS,
    audit
  );
  if (result.exitCode !== 0) {
    throw new GhRunnerError('COMMAND_FAILED', getFailureReason(result));
  }

  try {
    return JSON.parse(result.stdout) as unknown;
  } catch {
    throw new GhRunnerError('INVALID_OUTPUT', invalidOutputMessage);
  }
}

interface GhPrListItem {
  number: number;
  title: string;
  url: string;
  state: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  author?: { login?: string | null } | null;
  headRefName: string;
  baseRefName: string;
}

interface GhPrViewFile {
  path?: unknown;
  additions?: unknown;
  deletions?: unknown;
}

interface GhPrViewCommit {
  oid?: unknown;
  message?: unknown;
  messageHeadline?: unknown;
}

interface GhPrViewItem {
  title?: unknown;
  body?: unknown;
  author?: {
    login?: unknown;
  } | null;
  state?: unknown;
  baseRefName?: unknown;
  headRefName?: unknown;
  files?: unknown;
  additions?: unknown;
  deletions?: unknown;
  commits?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface GhNotificationItem {
  id?: unknown;
  reason?: unknown;
  unread?: unknown;
  updated_at?: unknown;
  url?: unknown;
  repository?: {
    full_name?: unknown;
    owner?: {
      login?: unknown;
    } | null;
  } | null;
  subject?: {
    title?: unknown;
    url?: unknown;
    type?: unknown;
  } | null;
}

export interface FetchNotificationsParams {
  token: string;
  limit: number;
  since?: number | null;
  audit?: CommandAuditContext;
}

export function buildNotificationsApiPath(params: {
  limit: number;
  since?: number | null;
}): string {
  const query = new globalThis.URLSearchParams({
    all: 'true',
    participating: 'false',
    per_page: `${params.limit}`,
  });

  if (
    typeof params.since === 'number' &&
    Number.isFinite(params.since) &&
    params.since > 0
  ) {
    query.set('since', new Date(params.since).toISOString());
  }

  return `/notifications?${query.toString()}`;
}

function parseUpdatedAt(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function normalizeOrgLogin(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return normalized;
}

function resolveOrgLogin(
  ownerLogin: string | null,
  repoFullName: string | null
): string | null {
  if (ownerLogin) {
    return normalizeOrgLogin(ownerLogin);
  }

  if (!repoFullName) {
    return null;
  }

  const [owner] = repoFullName.split('/');
  return owner ? normalizeOrgLogin(owner) : null;
}

function mapSubjectApiUrlToWebUrl(subjectApiUrl: string | null): string | null {
  if (!subjectApiUrl) {
    return null;
  }

  const match = subjectApiUrl.match(
    /\/repos\/([^/]+)\/([^/]+)\/(pulls|issues|discussions|commits)\/([^/?#]+)/i
  );
  if (!match) {
    return null;
  }

  const owner = match[1];
  const repo = match[2];
  const kind = match[3]?.toLowerCase();
  const entityId = match[4];

  if (!owner || !repo || !kind || !entityId) {
    return null;
  }

  if (kind === 'pulls') {
    return `https://github.com/${owner}/${repo}/pull/${entityId}`;
  }

  if (kind === 'issues') {
    return `https://github.com/${owner}/${repo}/issues/${entityId}`;
  }

  if (kind === 'discussions') {
    return `https://github.com/${owner}/${repo}/discussions/${entityId}`;
  }

  if (kind === 'commits') {
    return `https://github.com/${owner}/${repo}/commit/${entityId}`;
  }

  return null;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeBundleMetadata(raw: unknown): PullRequestBundleMetadata {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new GhRunnerError(
      'INVALID_OUTPUT',
      'GitHub CLI PR metadata payload is not an object'
    );
  }

  const row = raw as GhPrViewItem;

  const title = typeof row.title === 'string' ? row.title : null;
  const body = typeof row.body === 'string' ? row.body : null;
  const state = typeof row.state === 'string' ? row.state : null;
  const baseRefName =
    typeof row.baseRefName === 'string' ? row.baseRefName : null;
  const headRefName =
    typeof row.headRefName === 'string' ? row.headRefName : null;
  const createdAt = typeof row.createdAt === 'string' ? row.createdAt : null;
  const updatedAt = typeof row.updatedAt === 'string' ? row.updatedAt : null;

  if (
    !title ||
    body === null ||
    !state ||
    !baseRefName ||
    !headRefName ||
    !createdAt ||
    !updatedAt
  ) {
    throw new GhRunnerError(
      'INVALID_OUTPUT',
      'GitHub CLI PR metadata payload has invalid shape'
    );
  }

  const authorLogin =
    row.author &&
    typeof row.author === 'object' &&
    typeof row.author.login === 'string'
      ? row.author.login
      : 'unknown';

  const rawFiles = Array.isArray(row.files)
    ? (row.files as GhPrViewFile[])
    : [];
  const files: PullRequestBundleFile[] = rawFiles
    .map(file => {
      const path = typeof file.path === 'string' ? file.path : null;
      if (!path) {
        return null;
      }

      return {
        path,
        additions: toNumber(file.additions, 0),
        deletions: toNumber(file.deletions, 0),
      };
    })
    .filter((file): file is PullRequestBundleFile => file !== null);

  const rawCommits = Array.isArray(row.commits)
    ? (row.commits as GhPrViewCommit[])
    : [];
  const commits: PullRequestBundleCommit[] = rawCommits
    .map(commit => {
      const oid = typeof commit.oid === 'string' ? commit.oid : null;
      if (!oid) {
        return null;
      }

      const message =
        typeof commit.message === 'string'
          ? commit.message
          : typeof commit.messageHeadline === 'string'
            ? commit.messageHeadline
            : '';

      return {
        oid,
        message,
      };
    })
    .filter((commit): commit is PullRequestBundleCommit => commit !== null);

  return {
    title,
    body,
    author: {
      login: authorLogin,
    },
    state,
    baseRefName,
    headRefName,
    files,
    additions: toNumber(row.additions, 0),
    deletions: toNumber(row.deletions, 0),
    commits,
    createdAt,
    updatedAt,
  };
}

async function fetchPullRequestMetadata(
  token: string,
  repo: string,
  number: number,
  audit?: CommandAuditContext
): Promise<PullRequestBundleMetadata> {
  const fieldsWithCommits =
    'title,body,author,state,baseRefName,headRefName,files,additions,deletions,commits,createdAt,updatedAt';

  try {
    const raw = await runJsonCommand(
      'pr-view',
      token,
      ['pr', 'view', `${number}`, '--repo', repo, '--json', fieldsWithCommits],
      'GitHub CLI returned invalid PR metadata JSON',
      audit
    );

    return normalizeBundleMetadata(raw);
  } catch (error) {
    if (!(error instanceof GhRunnerError) || error.code !== 'COMMAND_FAILED') {
      throw error;
    }

    const message = error.message.toLowerCase();
    const missingCommitsAccess =
      message.includes('commits') && message.includes('not accessible');
    if (!missingCommitsAccess) {
      throw error;
    }

    const raw = await runJsonCommand(
      'pr-view',
      token,
      [
        'pr',
        'view',
        `${number}`,
        '--repo',
        repo,
        '--json',
        'title,body,author,state,baseRefName,headRefName,files,additions,deletions,createdAt,updatedAt',
      ],
      'GitHub CLI returned invalid PR metadata JSON',
      audit
    );

    const metadata = normalizeBundleMetadata(raw);
    return {
      ...metadata,
      commits: [],
    };
  }
}

export async function discoverPullRequests(
  params: PrDiscoverParams
): Promise<DiscoveredPr[]> {
  const raw = await runJsonCommand(
    'pr-list',
    params.token,
    [
      'pr',
      'list',
      '--repo',
      params.repo,
      '--state',
      params.state,
      '--limit',
      `${params.limit}`,
      '--json',
      'number,title,url,state,isDraft,createdAt,updatedAt,author,headRefName,baseRefName',
    ],
    'GitHub CLI returned invalid JSON',
    params.audit
  );

  if (!Array.isArray(raw)) {
    throw new GhRunnerError(
      'INVALID_OUTPUT',
      'GitHub CLI PR list payload is not an array'
    );
  }

  return raw.map(item => {
    const row = item as GhPrListItem;
    if (
      typeof row.number !== 'number' ||
      typeof row.title !== 'string' ||
      typeof row.url !== 'string' ||
      typeof row.state !== 'string' ||
      typeof row.isDraft !== 'boolean' ||
      typeof row.createdAt !== 'string' ||
      typeof row.updatedAt !== 'string' ||
      typeof row.headRefName !== 'string' ||
      typeof row.baseRefName !== 'string'
    ) {
      throw new GhRunnerError(
        'INVALID_OUTPUT',
        'GitHub CLI PR list item has invalid shape'
      );
    }

    const authorLogin =
      row.author &&
      typeof row.author === 'object' &&
      typeof row.author.login === 'string'
        ? row.author.login
        : null;

    return {
      number: row.number,
      title: row.title,
      url: row.url,
      state: row.state,
      isDraft: row.isDraft,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      authorLogin,
      headRefName: row.headRefName,
      baseRefName: row.baseRefName,
    };
  });
}

export async function fetchPullRequestBundleData(
  params: PullRequestBundleParams
): Promise<PullRequestBundleData> {
  const metadata = await fetchPullRequestMetadata(
    params.token,
    params.repo,
    params.number,
    params.audit
  );

  const diffResult = await runCommand(
    'pr-diff',
    params.token,
    ['pr', 'diff', `${params.number}`, '--repo', params.repo],
    DEFAULT_TIMEOUT_MS,
    params.audit
  );

  if (diffResult.exitCode !== 0) {
    throw new GhRunnerError('COMMAND_FAILED', getFailureReason(diffResult));
  }

  let checks: unknown | null = null;
  if (params.includeChecks) {
    try {
      checks = await runJsonCommand(
        'pr-checks',
        params.token,
        ['pr', 'checks', `${params.number}`, '--repo', params.repo, '--json'],
        'GitHub CLI returned invalid PR checks JSON',
        params.audit
      );
    } catch {
      checks = null;
    }
  }

  return {
    metadata,
    diff: diffResult.stdout,
    checks,
  };
}

export async function fetchNotifications(
  params: FetchNotificationsParams
): Promise<GhNotification[]> {
  const apiPath = buildNotificationsApiPath({
    limit: params.limit,
    ...(params.since !== undefined ? { since: params.since } : {}),
  });
  const raw = await runJsonCommand(
    'notifications-list',
    params.token,
    ['api', apiPath],
    'GitHub CLI returned invalid notifications JSON',
    params.audit
  );

  if (!Array.isArray(raw)) {
    throw new GhRunnerError(
      'INVALID_OUTPUT',
      'GitHub CLI notifications payload is not an array'
    );
  }

  const notifications: GhNotification[] = [];
  for (const rawItem of raw) {
    if (!rawItem || typeof rawItem !== 'object') {
      continue;
    }

    const row = rawItem as GhNotificationItem;
    const threadId = typeof row.id === 'string' ? row.id : null;
    if (!threadId) {
      continue;
    }

    const reason = typeof row.reason === 'string' ? row.reason : 'unknown';
    const subjectTitle =
      row.subject && typeof row.subject.title === 'string'
        ? row.subject.title
        : null;
    const subjectType =
      row.subject && typeof row.subject.type === 'string'
        ? row.subject.type
        : null;
    const subjectApiUrl =
      row.subject && typeof row.subject.url === 'string'
        ? row.subject.url
        : null;
    const repoFullName =
      row.repository && typeof row.repository.full_name === 'string'
        ? row.repository.full_name
        : null;
    const ownerLogin =
      row.repository &&
      row.repository.owner &&
      typeof row.repository.owner.login === 'string'
        ? row.repository.owner.login
        : null;
    const apiUrl = typeof row.url === 'string' ? row.url : subjectApiUrl;
    const url = mapSubjectApiUrlToWebUrl(subjectApiUrl);
    const orgLogin = resolveOrgLogin(ownerLogin, repoFullName);
    const unread = row.unread === true;
    const updatedAt = parseUpdatedAt(row.updated_at);

    notifications.push({
      threadId,
      reason,
      title: subjectTitle ?? `GitHub notification (${reason})`,
      url,
      repoFullName,
      orgLogin,
      subjectType,
      updatedAt,
      unread,
      apiUrl,
    });
  }

  return notifications;
}
