const DEFAULT_GH_SERVICE_BASE_URL = 'http://localhost:8790';

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
}

export interface GhServiceDiscoveredPr {
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

export interface GhServicePullRequestBundleMetadata {
  title: string;
  body: string;
  author: {
    login: string;
  };
  state: string;
  baseRefName: string;
  headRefName: string;
  files: Array<{ path: string; additions: number; deletions: number }>;
  additions: number;
  deletions: number;
  commits: Array<{ oid: string; message: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface GhServicePullRequestBundleData {
  metadata: GhServicePullRequestBundleMetadata;
  diff: string;
  checks: unknown | null;
}

export class GhServiceClientError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null
  ) {
    super(message);
  }
}

function parseJson(text: string): unknown {
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function getBaseUrl(): string {
  // nosemgrep: semgrep.devsuite-process-env-without-validation
  const configured = process.env.DEVSUITE_GH_SERVICE_URL?.trim();
  return configured || DEFAULT_GH_SERVICE_BASE_URL;
}

function buildHeaders(userId: string): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'x-devsuite-user-id': userId,
  };

  // nosemgrep: semgrep.devsuite-process-env-without-validation
  const serviceToken = process.env.DEVSUITE_GH_SERVICE_TOKEN?.trim();
  if (serviceToken) {
    headers.authorization = `Bearer ${serviceToken}`;
  }

  return headers;
}

async function post<TResponse>(
  path: string,
  params: {
    userId: string;
    payload: Record<string, unknown>;
  }
): Promise<TResponse> {
  const url = new globalThis.URL(path, getBaseUrl()).toString();
  const response = await globalThis.fetch(url, {
    method: 'POST',
    headers: buildHeaders(params.userId),
    body: JSON.stringify(params.payload),
  });

  const responseText = await response.text();
  const parsed = parseJson(responseText);

  if (!response.ok) {
    const envelope = parsed as ErrorEnvelope;
    const message = envelope.error?.message ?? 'GitHub service request failed';
    const code = envelope.error?.code ?? 'REQUEST_FAILED';
    const requestId = envelope.error?.requestId ?? null;
    throw new GhServiceClientError(response.status, code, message, requestId);
  }

  return parsed as TResponse;
}

function assertDiscoveredPrArray(value: unknown): GhServiceDiscoveredPr[] {
  if (!Array.isArray(value)) {
    throw new GhServiceClientError(
      502,
      'INVALID_RESPONSE',
      'Invalid PR list payload',
      null
    );
  }

  return value as GhServiceDiscoveredPr[];
}

function assertBundleData(value: unknown): GhServicePullRequestBundleData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GhServiceClientError(
      502,
      'INVALID_RESPONSE',
      'Invalid PR bundle payload',
      null
    );
  }

  const candidate = value as Partial<GhServicePullRequestBundleData>;
  if (
    !candidate.metadata ||
    typeof candidate.metadata !== 'object' ||
    typeof candidate.diff !== 'string' ||
    !('checks' in candidate)
  ) {
    throw new GhServiceClientError(
      502,
      'INVALID_RESPONSE',
      'Invalid PR bundle payload',
      null
    );
  }

  return {
    metadata: candidate.metadata as GhServicePullRequestBundleMetadata,
    diff: candidate.diff,
    checks: candidate.checks ?? null,
  };
}

export async function discoverPullRequestsViaService(params: {
  userId: string;
  repo: string;
  state?: 'open' | 'closed' | 'merged' | 'all';
  limit?: number;
}): Promise<GhServiceDiscoveredPr[]> {
  const payload = await post<{ pullRequests?: unknown }>(
    '/github/pr/discover',
    {
      userId: params.userId,
      payload: {
        repo: params.repo,
        ...(params.state ? { state: params.state } : {}),
        ...(typeof params.limit === 'number' ? { limit: params.limit } : {}),
      },
    }
  );

  return assertDiscoveredPrArray(payload.pullRequests);
}

export async function fetchPullRequestBundleDataViaService(params: {
  userId: string;
  repo: string;
  number: number;
  includeChecks: boolean;
}): Promise<GhServicePullRequestBundleData> {
  const payload = await post<{
    metadata?: unknown;
    diff?: unknown;
    checks?: unknown;
  }>('/github/pr/bundle-data', {
    userId: params.userId,
    payload: {
      repo: params.repo,
      number: params.number,
      includeChecks: params.includeChecks,
    },
  });

  return assertBundleData(payload);
}
