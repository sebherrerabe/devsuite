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

Richer PR context (diffs, metadata, branch state) is obtained through the **DevSuite GitHub service**, consumed by MCP tools.

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

- Convex (Convex Cloud by default; self-hosting is a future portability path)

Responsible for:

- data storage
- realtime subscriptions
- business rule enforcement
- company privacy scoping

### MCP Server

- Separate Node.js process
- Authenticated via local token
- Talks to Convex
- Calls external services (including DevSuite GitHub service)
- Exposes DevSuite operations to AI agents

---

## Prerequisites

- Node.js v22.x LTS (current active LTS)
- pnpm v9.x (`npm install -g pnpm`)
- Convex account ([convex.dev](https://www.convex.dev))

## Services in this repo

| Service           | Package                    | Default port  | Start command                                |
| ----------------- | -------------------------- | ------------- | -------------------------------------------- |
| Web app           | `@devsuite/web`            | `5173`        | `pnpm --filter @devsuite/web dev`            |
| Convex backend    | `@devsuite/convex`         | cloud managed | `pnpm --filter @devsuite/convex dev`         |
| MCP server        | `@devsuite/mcp`            | stdio         | `pnpm --filter @devsuite/mcp dev`            |
| GitHub service    | `@devsuite/gh-service`     | `8790`        | `pnpm --filter @devsuite/gh-service dev`     |
| Notion service    | `@devsuite/notion-service` | `8791`        | `pnpm --filter @devsuite/notion-service dev` |
| Shared TS watcher | `@devsuite/shared`         | n/a           | `pnpm --filter @devsuite/shared dev`         |

Running `pnpm dev` at repo root starts all of them in parallel.

## Full setup (from scratch, all services)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Bootstrap Convex deployment

```bash
pnpm --filter @devsuite/convex dev
```

On first run, Convex CLI will log you in and create/link a deployment.

### 3. Set required Convex Cloud env vars

These are set in Convex Cloud, not in local `.env` files:

```bash
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set SITE_URL "http://localhost:5173"
```

### 4. Create local env files

Copy the template:

```bash
cp .env.example .env.local
```

Generate local secrets:

```bash
# 32-byte base64 keys (for token encryption at rest)
openssl rand -base64 32
openssl rand -base64 32

# 16+ char tokens (for MCP/service auth)
openssl rand -hex 24
openssl rand -hex 24
openssl rand -hex 24
```

Then fill required values in repo root `.env.local`:

```bash
# Required so gh-service can start
DEVSUITE_GH_SERVICE_ENCRYPTION_KEY=<base64-32-byte-key>

# Required so notion-service can start
DEVSUITE_NOTION_SERVICE_ENCRYPTION_KEY=<base64-32-byte-key>

# Required for service -> Convex HTTP routes (GitHub/Notion integrations)
DEVSUITE_CONVEX_SITE_URL=https://<deployment>.convex.site
DEVSUITE_GH_SERVICE_BACKEND_TOKEN=<random-16+-char-token>
DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN=<random-16+-char-token>

# Required when using MCP tools
MCP_TOKEN=<random-token>
```

Set the same backend tokens in Convex Cloud:

```bash
npx convex env set DEVSUITE_GH_SERVICE_BACKEND_TOKEN "<same-value-as-local>"
npx convex env set DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN "<same-value-as-local>"
```

Create `apps/web/.env.local` for Vite client variables:

```bash
VITE_CONVEX_URL=https://<deployment>.convex.cloud
VITE_CONVEX_SITE_URL=https://<deployment>.convex.site
VITE_SITE_URL=http://localhost:5173

# Optional if using defaults:
VITE_GH_SERVICE_URL=http://localhost:8790
VITE_NOTION_SERVICE_URL=http://localhost:8791
```

Optional web push setup:

```bash
npx web-push generate-vapid-keys
```

Use generated keys in Convex Cloud envs (`DEVSUITE_WEB_PUSH_VAPID_PUBLIC_KEY`, `DEVSUITE_WEB_PUSH_VAPID_PRIVATE_KEY`, `DEVSUITE_WEB_PUSH_VAPID_SUBJECT`) and set `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` in `apps/web/.env.local`.

### 5. Start all services

`apps/mcp` reads `MCP_TOKEN` from process env. Export it before starting:

```bash
export MCP_TOKEN="<same-value-you-set-in-.env.local>"
```

```bash
pnpm dev
```

### 6. Verify locally

- Web app: `http://localhost:5173`
- GitHub service health: `http://localhost:8790/health`
- Notion service health: `http://localhost:8791/health`
- Convex functions/dashboard: started by `convex dev`

## Env vars and purpose

### Convex Cloud env vars (`npx convex env set`)

| Variable                                | Required               | Used by                             | Purpose                                                                |
| --------------------------------------- | ---------------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                    | Yes                    | Convex Better Auth                  | Signs/authenticates user sessions.                                     |
| `SITE_URL`                              | Yes                    | Convex Better Auth                  | Trusted origin and auth redirect base URL.                             |
| `DEVSUITE_GH_SERVICE_BACKEND_TOKEN`     | For GitHub integration | Convex HTTP routes + gh-service     | Auth token for gh-service calls into Convex (`/github/service/*`).     |
| `DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN` | For Notion integration | Convex HTTP routes + notion-service | Auth token for notion-service calls into Convex (`/notion/service/*`). |
| `DEVSUITE_WEB_PUSH_VAPID_PUBLIC_KEY`    | For web push           | Convex push delivery + web app      | Public VAPID key used by browser subscriptions.                        |
| `DEVSUITE_WEB_PUSH_VAPID_PRIVATE_KEY`   | For web push           | Convex push delivery                | Private VAPID key used to sign push sends.                             |
| `DEVSUITE_WEB_PUSH_VAPID_SUBJECT`       | For web push           | Convex push delivery                | Contact subject for VAPID metadata.                                    |

### Repo root `.env.local` (Node services)

| Variable                                     | Required                       | Used by                                  | Purpose                                                                               |
| -------------------------------------------- | ------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `MCP_TOKEN`                                  | For MCP usage                  | `apps/mcp`                               | Static auth token checked by MCP tools.                                               |
| `DEVSUITE_GH_SERVICE_ENCRYPTION_KEY`         | Yes for gh-service             | `apps/gh-service`                        | AES-256-GCM key for encrypting stored GitHub access tokens.                           |
| `DEVSUITE_NOTION_SERVICE_ENCRYPTION_KEY`     | Yes for notion-service         | `apps/notion-service`                    | AES-256-GCM key for encrypting stored Notion access tokens.                           |
| `DEVSUITE_CONVEX_SITE_URL`                   | For GitHub/Notion backend sync | `apps/gh-service`, `apps/notion-service` | Base URL for service-to-Convex HTTP ingestion routes.                                 |
| `DEVSUITE_GH_SERVICE_BACKEND_TOKEN`          | For GitHub backend sync        | `apps/gh-service`                        | Bearer token used by gh-service when calling Convex; must match Convex env value.     |
| `DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN`      | For Notion backend sync        | `apps/notion-service`                    | Bearer token used by notion-service when calling Convex; must match Convex env value. |
| `DEVSUITE_GH_SERVICE_TOKEN`                  | Optional in dev                | `apps/gh-service`, MCP                   | Protects gh-service HTTP endpoints when set.                                          |
| `DEVSUITE_NOTION_SERVICE_TOKEN`              | Optional in dev                | `apps/notion-service`                    | Protects notion-service HTTP endpoints when set.                                      |
| `DEVSUITE_GH_SERVICE_URL`                    | Optional                       | `apps/mcp`                               | Override gh-service base URL for MCP requests (default `http://localhost:8790`).      |
| `DEVSUITE_NOTION_OAUTH_CLIENT_ID`            | For Notion connect flow        | `apps/notion-service`                    | Notion OAuth client id.                                                               |
| `DEVSUITE_NOTION_OAUTH_CLIENT_SECRET`        | For Notion connect flow        | `apps/notion-service`                    | Notion OAuth client secret.                                                           |
| `DEVSUITE_NOTION_OAUTH_REDIRECT_URI`         | For Notion connect flow        | `apps/notion-service`                    | OAuth callback URI (must match Notion integration settings exactly).                  |
| `DEVSUITE_NOTION_POST_AUTH_REDIRECT_URL`     | Optional                       | `apps/notion-service`                    | Browser redirect target after OAuth callback.                                         |
| `DEVSUITE_NOTION_WEBHOOK_VERIFICATION_TOKEN` | Optional, recommended          | `apps/notion-service`                    | Verifies `x-notion-signature` for webhook integrity.                                  |

### `apps/web/.env.local` (browser/Vite)

| Variable                         | Required     | Used by                | Purpose                                                    |
| -------------------------------- | ------------ | ---------------------- | ---------------------------------------------------------- |
| `VITE_CONVEX_URL`                | Yes          | `apps/web`             | Convex client URL (`https://<deployment>.convex.cloud`).   |
| `VITE_CONVEX_SITE_URL`           | Yes          | `apps/web` auth client | Better Auth base URL (`https://<deployment>.convex.site`). |
| `VITE_SITE_URL`                  | Recommended  | `apps/web`             | Public app URL; should match Convex `SITE_URL`.            |
| `VITE_GH_SERVICE_URL`            | Optional     | `apps/web`             | GitHub service base URL (default `http://localhost:8790`). |
| `VITE_NOTION_SERVICE_URL`        | Optional     | `apps/web`             | Notion service base URL (default `http://localhost:8791`). |
| `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` | For web push | `apps/web`             | Public VAPID key used to register push subscriptions.      |

For the full variable list and advanced knobs (ports, polling intervals, CORS, OAuth scopes), use `.env.example`.

## Getting started (quick)

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm format:check
```

## Monorepo structure

```
devsuite/
├── apps/
│   ├── web/          # React web application (Vite + TypeScript)
│   ├── mcp/          # MCP server for AI agents (Node.js + TypeScript)
│   ├── gh-service/   # GitHub integration service (Node.js + TypeScript)
│   └── notion-service/ # Notion integration service (Node.js + TypeScript)
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
