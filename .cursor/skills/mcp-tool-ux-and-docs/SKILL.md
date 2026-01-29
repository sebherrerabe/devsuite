---
name: mcp-tool-ux-and-docs
description: Design MCP tools for optimal agent UX: predictable inputs/outputs, clear documentation, discoverable parameters, structured errors, and helpful descriptions. Use when creating new MCP tools, improving tool usability, or documenting tool contracts for AI agents.
---

# MCP Tool UX and Documentation (DevSuite)

## Intent
This skill ensures MCP tools are designed and documented for optimal AI agent experience. Tools must be predictable, well-documented, discoverable, and provide clear feedback to agents.

## Non-Goals
- Tool implementation logic (covered by `mcp-server-tooling`)
- Convex function design (covered by `convex-functions-crud-patterns`)
- GitHub CLI specifics (covered by `github-cli-integration`)

## Inputs to Read First
- Repo: `projects/09-mcp-server/PROJECT.md`, `projects/_conventions.md`
- MCP SDK examples: `https://github.com/modelcontextprotocol/typescript-sdk/tree/main/src/examples`
- Cursor MCP cookbook: `https://cursor.com/docs/cookbook/building-mcp-server`

## Workflow

### 1) Tool Naming Conventions
- Use **verb-noun** pattern: `createTask`, `listProjects`, `getPRReview`
- Be consistent: `list*` for collections, `get*` for single items, `create*` for creation
- Avoid abbreviations unless universally understood
- Group related tools with prefixes: `task_*`, `session_*`, `pr_*`

### 2) Parameter Design
- **Required vs Optional**: Mark truly optional parameters as optional; prefer required for clarity
- **Default values**: Provide sensible defaults when appropriate
- **Company scoping**: Always include `companyId` as required parameter
- **Descriptions**: Every parameter must have a clear `.describe()` in Zod schema
- **Examples**: Include example values in descriptions when helpful

### 3) Input Schema Documentation
```typescript
// Good: Clear, documented, with examples
const createTaskSchema = z.object({
  companyId: z.string().describe("Company ID (required for scoping)"),
  projectId: z.string().describe("Project ID this task belongs to"),
  title: z.string().min(1).describe("Task title (e.g., 'Implement user auth')"),
  complexity: z.number().int().min(1).max(10).optional()
    .describe("Complexity score 1-10 (optional, defaults to null)"),
});
```

### 4) Output Schema Design
- **Consistent structure**: Always return `{ success: boolean, data?: T, error?: {...} }`
- **Type safety**: Use Zod to validate outputs before returning
- **Null handling**: Be explicit about nullable fields
- **Collections**: Return arrays consistently, never null (empty array instead)

### 5) Error Documentation
- **Error codes**: Use consistent codes: `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`
- **Error messages**: Write clear, actionable messages for agents
- **Error context**: Include relevant IDs or parameters in error messages
- **No stack traces**: Never expose internal errors or stack traces

### 6) Tool Description Standards
Every tool must have:
- **Name**: Clear, action-oriented name
- **Description**: One sentence explaining what the tool does
- **Parameter descriptions**: Each parameter documented with purpose and examples
- **Return value description**: What the tool returns and in what format
- **Error conditions**: When and why the tool might fail

Example:
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "createTask",
      description: "Create a new task in a project. Tasks represent work intent and are never deleted.",
      inputSchema: {
        type: "object",
        properties: {
          companyId: {
            type: "string",
            description: "Company ID for scoping (required)"
          },
          projectId: {
            type: "string",
            description: "Project ID this task belongs to"
          },
          title: {
            type: "string",
            description: "Task title (e.g., 'Implement user authentication')"
          }
        },
        required: ["companyId", "projectId", "title"]
      }
    }
  ]
}));
```

### 7) Discoverability Patterns
- **Tool grouping**: Use consistent naming to group related tools
- **Resource links**: Return `resource_link` content items for large data
- **Pagination**: For list operations, support pagination parameters
- **Filtering**: Provide filter parameters for list operations (by company, date, status)

### 8) Agent-Friendly Patterns
- **Idempotency**: Make tools idempotent when possible (same inputs = same outputs)
- **Atomic operations**: Each tool should do one thing well
- **Composability**: Tools should work well together
- **Feedback**: Provide clear success/failure feedback
- **Context preservation**: Include relevant IDs in responses for chaining operations

### 9) Documentation Maintenance
- Keep tool descriptions up-to-date with implementation
- Document breaking changes clearly
- Include usage examples in tool descriptions
- Reference related tools in descriptions

## Deliverables Checklist
- [ ] All tools follow verb-noun naming convention
- [ ] Every parameter has clear description with examples
- [ ] Input schemas use Zod with `.describe()` on all fields
- [ ] Output schemas are consistent and type-safe
- [ ] Error responses follow standard structure
- [ ] Tool descriptions are clear and actionable
- [ ] Related tools are discoverable through naming
- [ ] Documentation matches implementation

## Tool UX Checklist

When creating a new tool, verify:
- [ ] Name clearly indicates what it does
- [ ] Description explains purpose in one sentence
- [ ] All parameters are documented with examples
- [ ] Required vs optional is clear
- [ ] Output structure is predictable
- [ ] Error cases are documented
- [ ] Tool works well with other tools (composable)
- [ ] Company scoping is explicit
- [ ] No-delete enforcement is clear in docs

## Common Patterns

### List Tool Pattern
```typescript
{
  name: "listTasks",
  description: "List tasks for a project, optionally filtered by status",
  inputSchema: {
    companyId: z.string(),
    projectId: z.string(),
    status: z.enum(["open", "closed"]).optional(),
    limit: z.number().int().min(1).max(100).default(50)
  }
}
```

### Get Tool Pattern
```typescript
{
  name: "getTask",
  description: "Get a single task by ID",
  inputSchema: {
    companyId: z.string(),
    taskId: z.string()
  }
}
```

### Create Tool Pattern
```typescript
{
  name: "createTask",
  description: "Create a new task. Tasks are never deleted.",
  inputSchema: {
    companyId: z.string(),
    projectId: z.string(),
    title: z.string().min(1),
    // ... other fields
  }
}
```

## References
- MCP SDK Examples: `https://github.com/modelcontextprotocol/typescript-sdk/tree/main/src/examples`
- Cursor MCP Cookbook: `https://cursor.com/docs/cookbook/building-mcp-server`
- DevSuite Conventions: `projects/_conventions.md`
