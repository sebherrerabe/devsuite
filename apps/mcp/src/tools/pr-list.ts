import { PrListInputSchema } from '../schemas/index.js';
import {
  discoverPullRequestsViaService,
  GhServiceClientError,
} from '../services/gh-service.js';

function formatServiceError(error: unknown): string {
  if (error instanceof GhServiceClientError) {
    return error.requestId
      ? `${error.message} (request ${error.requestId})`
      : error.message;
  }

  return error instanceof Error ? error.message : String(error);
}

export async function prListHandler(request: { params: unknown }) {
  try {
    const args = PrListInputSchema.parse(request.params);
    const { userId, repo, state, limit } = args;

    const items = await discoverPullRequestsViaService({
      userId,
      repo,
      ...(state ? { state } : {}),
      ...(typeof limit === 'number' ? { limit } : {}),
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              repo,
              count: items.length,
              items,
            },
            null,
            2
          ),
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

export const prListTool = {
  schema: {
    name: 'pr_list',
    description:
      'Lists pull requests for a repository using the DevSuite GitHub service',
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
        repo: {
          type: 'string',
          description: 'GitHub repo in owner/name format',
        },
        state: {
          type: 'string',
          description: 'PR state filter: open | closed | merged | all',
        },
        limit: {
          type: 'number',
          description: 'Max PRs to return (default 30)',
        },
      },
      required: ['authToken', 'userId', 'repo'],
    },
  },
  handler: prListHandler,
};
