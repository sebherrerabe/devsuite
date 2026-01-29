---
name: docs-and-dx
description: Standardize READMEs, package boundaries, contribution workflow, and developer experience documentation for DevSuite. Use when creating or updating documentation, establishing package boundaries, or improving developer onboarding and contribution processes.
---

# Documentation and Developer Experience

## Intent

This skill guides creation and maintenance of consistent, helpful documentation across DevSuite, ensuring clear package boundaries, contribution workflows, and developer onboarding materials.

## Non-Goals

- Writing user-facing documentation (focuses on developer docs)
- Creating marketing materials
- Writing API documentation for external consumers (internal focus)

## Inputs to Read First

- Repo: `projects/_conventions.md` (spec standards)
- Repo: `projects/00-scaffolding/PROJECT.md` (repo structure)
- Repo: `/dev_suite_conceptual_architecture_business_vs_tech.md` (architecture)
- Repo: Root `README.md` (existing docs)

## Workflow

### 1) Root README Structure

Create/update root `README.md` with:

```markdown
# DevSuite

[One-paragraph description of what DevSuite is]

## Quick Start

\`\`\`bash

# Install dependencies

pnpm install

# Start development

pnpm dev

# Run type checking

pnpm typecheck

# Run linting

pnpm lint
\`\`\`

## Project Structure

\`\`\`
devsuite/
apps/
web/ # Vite + React frontend
mcp/ # MCP server for AI agents
convex/ # Convex backend (schema + functions)
packages/
shared/ # Shared types and utilities
projects/ # Project specifications
\`\`\`

## Development

[Link to CONTRIBUTING.md or inline contribution guide]

## Architecture

[Link to architecture doc or brief overview]

## License

[License info]
```

### 2) Package READMEs

Each package/app should have a `README.md`:

**`apps/web/README.md`**:

- Frontend stack overview
- Development commands
- Key directories
- Routing conventions
- UI component patterns

**`apps/mcp/README.md`**:

- MCP server purpose
- Tool development guide
- Authentication setup
- Local development

**`convex/README.md`**:

- Schema organization
- Function patterns
- Query/mutation conventions
- Company scoping patterns

**`packages/shared/README.md`**:

- Shared types overview
- Usage examples
- Versioning policy

### 3) Package Boundaries Documentation

Document in `packages/shared/README.md` or root `CONTRIBUTING.md`:

**Import Rules**:

- `packages/shared` → No dependencies on `apps/*` or `convex/*`
- `apps/web` → Can import from `packages/shared`, not `convex/*` directly
- `apps/mcp` → Can import from `packages/shared` and `convex/*` (via client)
- `convex/*` → Can import from `packages/shared`, not `apps/*`

**Boundary Violations**:

- ❌ `apps/web` importing Convex functions directly
- ❌ `convex/*` importing React components
- ❌ `packages/shared` importing app-specific code

**Enforcement**:

- ESLint rules for import boundaries
- TypeScript project references
- Document exceptions with rationale

### 4) Contribution Workflow

Create `CONTRIBUTING.md` in root:

```markdown
# Contributing to DevSuite

## Development Setup

1. Clone the repository
2. Install dependencies: \`pnpm install\`
3. Set up environment variables (see .env.example)
4. Start development: \`pnpm dev\`

## Project Structure

DevSuite uses a monorepo structure. See [README.md](./README.md) for overview.

## Making Changes

### Before You Start

- Check `projects/` for existing specifications
- Read relevant `PROJECT.md` files
- Understand module dependencies

### Development Process

1. Create/update project spec if needed (in `projects/`)
2. Implement changes following conventions
3. Run type checking: \`pnpm typecheck\`
4. Run linting: \`pnpm lint\`
5. Test your changes

### Code Style

- Follow TypeScript strict mode
- Use Prettier for formatting (runs on save)
- Follow ESLint rules
- Write self-documenting code

### Commit Messages

[Conventional commits format or team standard]

## Module Development

When implementing a module:

1. Read the module's `PROJECT.md`
2. Follow `vertical-slice-module-implementation` skill
3. Ensure invariants are met (soft delete, company scoping)
4. Update relevant documentation

## Questions?

[Contact info or issue tracker]
```

### 5) Architecture Documentation

Create/update `docs/architecture.md`:

```markdown
# DevSuite Architecture

## Overview

[High-level architecture diagram or description]

## Core Principles

- Local-first
- Realtime by default
- Client-first (no server components)
- Explicit over magic
- AI-agent compatible

## Stack

[Brief stack overview with links to detailed docs]

## Data Flow

[How data flows through the system]

## Module Boundaries

[How modules interact, dependencies]

## Invariants

[List core invariants: soft delete, company scoping, etc.]
```

### 6) Developer Onboarding Guide

Create `docs/onboarding.md`:

```markdown
# Developer Onboarding

## Prerequisites

- Node.js 20+
- pnpm installed
- Git configured

## First-Time Setup

1. Clone repository
2. Install dependencies: \`pnpm install\`
3. Copy \`.env.example\` to \`.env\` and configure
4. Start development: \`pnpm dev\`

## Understanding the Codebase

### Start Here

1. Read root README.md
2. Read architecture doc
3. Browse `projects/` to understand module structure

### Key Concepts

- **Vertical slices**: Modules are full-stack (Convex + React)
- **Company scoping**: All data belongs to a company
- **Soft delete**: No hard deletes, use \`deletedAt\`
- **External references**: Link to external systems, don't mirror

### Common Tasks

- [Adding a new module](link)
- [Adding a Convex function](link)
- [Adding a React component](link)
- [Adding an MCP tool](link)

## Getting Help

[Resources, Slack channel, etc.]
```

### 7) Code Comments Standards

Document comment conventions:

**Function Comments**:

```typescript
/**
 * Creates a new task in the specified project.
 *
 * @param projectId - The project to create the task in
 * @param name - The task name
 * @returns The created task ID
 */
export const createTask = mutation({
  // ...
});
```

**Complex Logic Comments**:

- Explain "why", not "what"
- Document non-obvious decisions
- Reference related code/files

**TODO Comments**:

- Include context and owner: `// TODO(@username): Refactor when X is ready`
- Link to issue if applicable

### 8) Environment Variables Documentation

Create/update `.env.example` with:

```bash
# Convex
CONVEX_DEPLOYMENT=
CONVEX_URL=

# MCP Server
MCP_SERVER_TOKEN=

# External Integrations (optional)
NOTION_API_KEY=
TICKTICK_CLIENT_ID=
TICKTICK_CLIENT_SECRET=
GITHUB_CLI_AUTH=

# Development
NODE_ENV=development
```

Document each variable in comments.

### 9) Scripts Documentation

Document all scripts in root `package.json`:

```json
{
  "scripts": {
    "dev": "Start all development servers",
    "build": "Build all packages",
    "typecheck": "Run TypeScript type checking",
    "lint": "Run ESLint",
    "format": "Format code with Prettier"
  }
}
```

Or create `docs/scripts.md` with detailed descriptions.

### 10) Troubleshooting Guide

Create `docs/troubleshooting.md`:

```markdown
# Troubleshooting

## Common Issues

### pnpm install fails

[Solution]

### Convex functions not updating

[Solution]

### Type errors after dependency update

[Solution]

### MCP server not connecting

[Solution]
```

## Deliverables Checklist

- [ ] Root README.md created/updated
- [ ] Package READMEs created (web, mcp, convex, shared)
- [ ] Package boundaries documented
- [ ] CONTRIBUTING.md created
- [ ] Architecture documentation created/updated
- [ ] Onboarding guide created
- [ ] Code comment standards documented
- [ ] Environment variables documented (.env.example)
- [ ] Scripts documented
- [ ] Troubleshooting guide created

## Documentation Standards

### Markdown Formatting

- Use consistent heading hierarchy
- Use code fences with language specified
- Use tables for structured data
- Link to related docs

### Keep Docs Updated

- Update docs when architecture changes
- Update READMEs when adding features
- Remove outdated information
- Review docs during code reviews

### Accessibility

- Use clear, simple language
- Include examples
- Provide links to related resources
- Use consistent terminology

## References

- `projects/_conventions.md` - Spec standards
- `projects/00-scaffolding/PROJECT.md` - Repo structure
- `/dev_suite_conceptual_architecture_business_vs_tech.md` - Architecture
- `monorepo-scaffolding` skill - Repo setup
