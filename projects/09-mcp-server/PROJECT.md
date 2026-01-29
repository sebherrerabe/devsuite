---
id: "09-mcp-server"
title: "MCP Server Foundation"
status: "pending"
priority: 5
assigned_pm: null
depends_on: ["02-convex-foundation"]
unlocks: ["10-pr-review-module", "12-github-integration"]
estimated_complexity: "high"
---

# MCP Server Foundation

## Summary
Implement the MCP (Model Context Protocol) server that acts as the AI-facing control plane for DevSuite. The MCP server exposes DevSuite operations as tools that AI agents can invoke, with proper authentication and Convex integration.

## Objective
Enable AI agents to interact with DevSuite programmatically through a controlled, secure interface.

## Key Deliverables
- Node.js MCP server setup in `apps/mcp/`
- Static token authentication
- Convex client integration
- Base tool infrastructure
- Core tools: createTask, startSession, endSession, etc.
- Read-only tools: listProjects, getTasks, etc.
- Tool documentation for agents
- No-delete enforcement

## Success Criteria
- [ ] MCP server runs and responds to tool calls
- [ ] Authentication via static token works
- [ ] Tools can read from Convex
- [ ] Tools can write to Convex
- [ ] Delete operations are blocked
- [ ] Agent can complete basic workflows

## Architecture Reference

From spec section 5:
- Separate Node.js process as AI-facing control plane
- Exposes DevSuite operations as MCP tools
- Authenticates agents via static token
- Calls Convex functions
- Runs local tooling (GitHub CLI)
- Agents can read and modify, never delete

## Quick Links
- [Scope](./SCOPE.md) _(to be created by AI PM)_
- [Dependencies](./DEPENDENCIES.md) _(to be created by AI PM)_
- [Tasks](./TASKS.md) _(to be created by AI PM)_
- [Status](./STATUS.md) _(to be created by AI PM)_

## Notes for AI PM
When decomposing this project:
1. Start with MCP SDK setup and basic tool structure
2. Authentication is simple (static token) but critical
3. Tool design affects agent UX significantly
4. Consider tool discoverability and documentation
5. PR review workflow is handled in 10-pr-review-module
