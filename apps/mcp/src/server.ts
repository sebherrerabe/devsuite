import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { prBundleTool } from './tools/pr-bundle.js';
import { writeReviewTool } from './tools/write-review.js';
import { readStyleGuideTool } from './tools/read-style-guide.js';
import { prListTool } from './tools/pr-list.js';

function assertAuthToken(args: unknown) {
  const token = process.env.MCP_TOKEN;
  if (!token) {
    throw new Error('MCP_TOKEN is not configured');
  }
  const provided = (args as { authToken?: string } | undefined)?.authToken;
  if (!provided || provided !== token) {
    throw new Error('Unauthorized');
  }
}

/**
 * Creates and configures the MCP server with all registered tools.
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'devsuite-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        prBundleTool.schema,
        readStyleGuideTool.schema,
        writeReviewTool.schema,
        prListTool.schema,
      ],
    };
  });

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: {
      params: { name: string; arguments?: Record<string, unknown> | undefined };
    }) => {
      const args = request.params.arguments ?? {};
      assertAuthToken(args);

      if (request.params.name === prBundleTool.schema.name) {
        return await prBundleTool.handler({ params: args });
      }
      if (request.params.name === readStyleGuideTool.schema.name) {
        return await readStyleGuideTool.handler();
      }
      if (request.params.name === writeReviewTool.schema.name) {
        return await writeReviewTool.handler({ params: args });
      }
      if (request.params.name === prListTool.schema.name) {
        return await prListTool.handler({ params: args });
      }

      throw new Error(`Unknown tool: ${request.params.name}`);
    }
  );

  return server;
}
