---
name: mcp-server-tooling
description: Set up and maintain the MCP server infrastructure in apps/mcp/. Implement tools, handle authentication via static token, integrate with Convex, and enforce DevSuite guardrails (no-delete, company scoping). Use when building MCP tools, setting up the server, or integrating DevSuite operations for AI agents.
---

# MCP Server Tooling (DevSuite)

## Intent
This skill is responsible for implementing and maintaining the MCP server that acts as DevSuite's AI-facing control plane. The server exposes DevSuite operations as MCP tools, handles authentication, integrates with Convex, and enforces critical guardrails.

## Non-Goals
- Frontend UI implementation (covered by `frontend-convex-integration`)
- Convex schema/function design (covered by `convex-data-modeling-and-rules`)
- PR review generation logic (MCP server receives reviews, doesn't generate them)
- GitHub CLI implementation details (covered by `github-cli-integration`)

## Inputs to Read First
- Repo: `projects/09-mcp-server/PROJECT.md`, `projects/01-shared-types/PROJECT.md`, `/dev_suite_conceptual_architecture_business_vs_tech.md`
- Cursor MCP cookbook: `https://cursor.com/docs/cookbook/building-mcp-server`
- MCP SDK docs: `https://github.com/modelcontextprotocol/typescript-sdk` (README and examples)

## Workflow

### 1) Server Setup and Structure
- Create/verify `apps/mcp/` directory structure
- Initialize Node.js/Bun project with TypeScript
- Install dependencies: `@modelcontextprotocol/sdk`, `zod`, Convex client
- Set up stdio transport (default for local development)
- Configure environment variables: `MCP_TOKEN`, `CONVEX_URL`, `CONVEX_DEPLOY_KEY`

### 2) Authentication Implementation
- Implement static token authentication middleware
- Validate `Authorization` header or MCP context token
- Reject requests without valid token
- Keep authentication simple (no OAuth, no complex flows)

### 3) Convex Client Integration
- Initialize Convex client with deployment URL and key
- Create typed Convex client wrapper for DevSuite functions
- Handle connection errors gracefully
- Support both query and mutation calls

### 4) Tool Infrastructure
- Define tool registration pattern using MCP SDK
- Use Zod schemas for all tool inputs/outputs
- Implement consistent error handling:
  - Structured error responses with error codes
  - Clear error messages for agents
  - No stack traces in production responses
- Create base tool handler wrapper for common patterns

### 5) Core Tool Implementation
Implement these base tools following DevSuite patterns:
- **Read tools**: `listProjects`, `getTasks`, `listSessions`, `getPRReview`
- **Write tools**: `createTask`, `startSession`, `endSession`, `submitPRReview`
- **No-delete enforcement**: Explicitly reject any delete operations
- **Company scoping**: All tools require and validate `companyId` parameter

### 6) Guardrails Enforcement
- **No-delete rule**: Block any tool that attempts deletion
  - Return structured error: `{ code: "FORBIDDEN", message: "Delete operations are not allowed" }`
- **Company scoping**: Validate `companyId` exists and user has access
- **Static token auth**: Enforce authentication on all tool calls
- **Input validation**: Use Zod to validate all inputs before processing

### 7) Error Handling and Logging
- Implement structured logging (console or simple logger)
- Log tool calls, errors, and authentication failures
- Never expose sensitive data in error messages
- Return predictable error shapes for agent consumption

### 8) Testing and Verification
- Test server startup and stdio transport
- Verify authentication rejects invalid tokens
- Test tool calls with valid/invalid inputs
- Verify Convex integration works
- Confirm guardrails block delete operations
- Use MCP Inspector for manual testing: `npx @modelcontextprotocol/inspector bun run index.ts`

## Deliverables Checklist
- [ ] MCP server runs in `apps/mcp/` with stdio transport
- [ ] Static token authentication implemented and tested
- [ ] Convex client integrated and working
- [ ] Base tool infrastructure with Zod schemas
- [ ] Core read/write tools implemented
- [ ] No-delete enforcement working (rejects delete attempts)
- [ ] Company scoping validated on all tools
- [ ] Error handling returns structured, agent-friendly errors
- [ ] Server can be tested with MCP Inspector
- [ ] Environment variables documented

## Tool Contract Standards

### Input Schema Pattern
```typescript
const toolInputSchema = z.object({
  companyId: z.string().describe("Company ID for scoping"),
  // ... other fields
});
```

### Output Schema Pattern
```typescript
const toolOutputSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});
```

### Error Response Pattern
```typescript
{
  success: false,
  error: {
    code: "FORBIDDEN" | "VALIDATION_ERROR" | "NOT_FOUND" | "INTERNAL_ERROR",
    message: "Human-readable error message"
  }
}
```

## References
- MCP SDK: `https://github.com/modelcontextprotocol/typescript-sdk`
- Cursor MCP Cookbook: `https://cursor.com/docs/cookbook/building-mcp-server`
- DevSuite Architecture: `/dev_suite_conceptual_architecture_business_vs_tech.md`
