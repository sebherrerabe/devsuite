import fs from 'fs/promises';
import path from 'path';
import { parsePrUrl } from '../services/url-validator.js';
import {
  buildBundlePath,
  DEFAULT_ALLOWED_ROOT,
} from '../services/path-sanitizer.js';
import { PrBundleInputSchema } from '../schemas/index.js';
import {
  fetchPullRequestBundleDataViaService,
  GhServiceClientError,
} from '../services/gh-service.js';
import type { PrMetadata, BundleResult } from '../types/index.js';

const HUGE_DIFF_THRESHOLD = 5 * 1024 * 1024;

function formatServiceError(error: unknown): string {
  if (error instanceof GhServiceClientError) {
    return error.requestId
      ? `${error.message} (request ${error.requestId})`
      : error.message;
  }

  return error instanceof Error ? error.message : String(error);
}

export async function prBundleHandler(request: { params: unknown }) {
  try {
    const args = PrBundleInputSchema.parse(request.params);
    const { userId, prUrl, outputRoot, includeChecks } = args;

    const parsed = parsePrUrl(prUrl);
    if (!parsed) {
      throw new Error(
        'Invalid PR URL. Expected: https://github.com/owner/repo/pull/123'
      );
    }

    const { owner, repo, number: prNumber } = parsed;
    const repoFullName = `${owner}/${repo}`;

    const allowedRoot = outputRoot || DEFAULT_ALLOWED_ROOT;
    const bundlePath = buildBundlePath(owner, repo, prNumber, allowedRoot);
    await fs.mkdir(bundlePath, { recursive: true });

    const bundle = await fetchPullRequestBundleDataViaService({
      userId,
      repo: repoFullName,
      number: prNumber,
      includeChecks,
    });

    const metadata = bundle.metadata as PrMetadata;
    const diffText = bundle.diff;
    const diffSizeBytes = Buffer.byteLength(diffText, 'utf8');
    const truncated = diffSizeBytes > HUGE_DIFF_THRESHOLD;

    const files: string[] = [];

    const metaPath = path.join(bundlePath, 'meta.json');
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
    files.push('meta.json');

    const diffPath = path.join(bundlePath, 'diff.patch');
    await fs.writeFile(diffPath, diffText, 'utf8');
    files.push('diff.patch');

    const filesPath = path.join(bundlePath, 'files.txt');
    const fileList = metadata.files.map(f => f.path).join('\n');
    await fs.writeFile(filesPath, fileList, 'utf8');
    files.push('files.txt');

    if (includeChecks && bundle.checks !== null) {
      const checksPath = path.join(bundlePath, 'checks.json');
      await fs.writeFile(
        checksPath,
        JSON.stringify(bundle.checks, null, 2),
        'utf8'
      );
      files.push('checks.json');
    }

    const summary =
      `PR bundle created at ${bundlePath}\n` +
      `PR: ${metadata.title} (#${prNumber})\n` +
      `Author: ${metadata.author.login || 'unknown'}\n` +
      `Branch: ${metadata.headRefName} -> ${metadata.baseRefName}\n` +
      `Files changed: ${metadata.files.length}\n` +
      `Additions: +${metadata.additions}, Deletions: -${metadata.deletions}\n` +
      `Diff size: ${(diffSizeBytes / 1024).toFixed(2)} KB${
        truncated ? ' (huge diff, written anyway)' : ''
      }`;

    const result: BundleResult = {
      bundlePath,
      files,
      truncated,
      diffSizeBytes,
      summary,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = formatServiceError(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: errorMessage,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

export const prBundleTool = {
  schema: {
    name: 'pr_bundle',
    description:
      'Fetches a GitHub PR via DevSuite GitHub service and creates a local bundle with metadata, diff, and optional checks',
    inputSchema: {
      type: 'object',
      properties: {
        authToken: {
          type: 'string',
          description: 'MCP auth token',
        },
        userId: {
          type: 'string',
          description:
            'DevSuite user id for GitHub service authorization context',
        },
        prUrl: {
          type: 'string',
          description:
            'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
        },
        outputRoot: {
          type: 'string',
          description:
            'Override output directory (defaults to ~/.private/pr-reviews/)',
        },
        includeChecks: {
          type: 'boolean',
          description: 'Include CI check results in the bundle',
          default: false,
        },
      },
      required: ['authToken', 'userId', 'prUrl'],
    },
  },
  handler: prBundleHandler,
};
