# apps/mcp — Agent Instructions

## Purpose

MCP server is the AI-facing control plane for DevSuite. It exposes safe tools that call into Convex and external services (e.g., DevSuite gh-service).

## Rules (non-negotiable)

- Agents can read and modify; never delete.
- Enforce company scoping for every operation.
- Authentication is required (static token as baseline).

## Tooling conventions

- Tools must have clear, minimal inputs and predictable outputs.
- Return structured errors that help agents recover (don't hide failures).
