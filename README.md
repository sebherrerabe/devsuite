# DevSuite

DevSuite is a **local-first developer operating system**.

It helps a single developer understand **what they work on**, **how long it takes**, **how complex it is**, and **for whom it was done**, while remaining private, auditable, and AI-friendly.

DevSuite is not a generic task manager.
It is a **work telemetry and review system** designed to be used by both a human developer and AI agents.

---

## Why DevSuite exists

As a developer working across:

- multiple companies
- multiple projects and repositories
- salaried and freelance contexts
- human + AI-assisted workflows

…it becomes hard to answer simple but important questions:

- What did I actually work on this week?
- How much effort did this task really take?
- How complex was it compared to my estimate?
- How much time did I spend reviewing PRs?
- What should I invoice this month?
- Where is my attention really going?

DevSuite exists to answer those questions **honestly**, using real data generated during work.

---

## Core ideas

### Tasks are intent, not time

Tasks represent _what_ you intend to achieve.
They are hierarchical and scoped to a project.

### Sessions are effort

Sessions represent _time spent_.
A single session may touch multiple tasks.

### Companies are hard boundaries

Work is strictly scoped by company.
You can switch between:

- **company mode**
- **private global view**

### External tools are referenced, not mirrored

DevSuite links to:

- GitHub (PRs, issues)
- Notion pages
- TickTick tasks

Only IDs and URLs are stored.
No external content is duplicated.

### AI agents are first-class users

DevSuite exposes a controlled MCP server so agents can:

- create tasks
- start/stop sessions
- generate and store PR reviews
- append summaries

Agents can **never delete data**.

---

## PR reviews (first-class feature)

DevSuite includes a dedicated PR review history system.

It mirrors the workflow of an existing `pr-review` MCP tool and provides:

- persistent storage of review reports (markdown)
- a UI to browse reviews by company, project, repo, or date
- visibility into how much review work you actually do

Richer PR context (diffs, metadata, branch state) is obtained from the **MCP server**, which runs the local GitHub CLI workflow.

DevSuite stores the results — not the raw GitHub data.

---

## Invoicing

Invoicing is **derivative**, not primary.

- Based on sessions
- Hourly rate cards per company
- Monthly aggregation
- Exported as simple CSV
- Designed to be auditable and easy to send

DevSuite is not an accounting system.

---

## Architecture overview

### Frontend

- Vite
- React 19
- TanStack Router
- TanStack Query
- Tailwind CSS v4
- shadcn/ui
- lucide-react (icons)

Client-first, no server components.

### Backend

- Convex (self-hosted)
- PostgreSQL

Responsible for:

- data storage
- realtime subscriptions
- business rule enforcement
- company privacy scoping

### MCP Server

- Separate Node.js process
- Authenticated via local token
- Talks to Convex
- Runs local tooling (GitHub CLI)
- Exposes DevSuite operations to AI agents

---

## Prerequisites

- Node.js v22.x LTS (current active LTS)
- pnpm v9.x (`npm install -g pnpm`)

## Getting started

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev

# Run checks
pnpm lint
pnpm typecheck
pnpm format:check
```

## Monorepo structure

```
devsuite/
├── apps/
│   ├── web/          # React web application (Vite + TypeScript)
│   └── mcp/          # MCP server for AI agents (Node.js + TypeScript)
├── convex/           # Convex backend (schema + functions)
├── packages/
│   └── shared/       # Shared types, schemas, and utilities
├── projects/         # Project specifications and execution plans
├── docs/             # Documentation
└── AGENTS.md         # AI agent instructions
```

## Adding a new package

1. Create the directory structure under `packages/` or `apps/`
2. Add to `pnpm-workspace.yaml` if creating a new workspace type
3. Create `package.json` with scoped name (`@devsuite/*`)
4. Create `tsconfig.json` extending `../../tsconfig.base.json`
5. Add `composite: true` for buildable packages
6. Update root `tsconfig.json` references if needed
7. Add scripts for `build`, `dev`, `clean` in package.json

Example for a new shared package:

```bash
mkdir packages/new-package
cd packages/new-package
echo '{"name": "@devsuite/new-package", "scripts": {"build": "tsc", "dev": "tsc --watch", "clean": "rm -rf dist"}}' > package.json
echo '{"extends": "../../tsconfig.base.json", "compilerOptions": {"composite": true, "outDir": "dist", "rootDir": "src"}, "include": ["src/**/*"], "exclude": ["dist", "node_modules"]}' > tsconfig.json
mkdir src && echo "export const version = '0.0.0';" > src/index.ts
```

Then update root `tsconfig.json` to include the new package in references.
