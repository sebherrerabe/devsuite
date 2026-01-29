# DevSuite Agent Instructions

## What this repo is

DevSuite is a pnpm monorepo:

- `apps/web`: React web app (Vite, React, TypeScript)
- `apps/mcp`: MCP server (Node.js)
- `convex`: Convex backend (schema + functions)
- `packages/shared`: shared TypeScript types, Zod schemas, utilities
- `projects/`: specs and execution manifest

## Ground rules (project-wide)

- Do not introduce hard deletes. Use soft delete patterns only.
- All application data is company-scoped (tenant isolation is foundational).
- External systems are referenced, never mirrored (store identifiers/links, not full copies).
- No secrets committed. Use `.env.example` where needed.

## How to work in this repo

- Read `projects/_index.md` and `projects/_conventions.md` before planning changes.
- Prefer small, verifiable steps; run `pnpm lint` and `pnpm typecheck` after substantive edits.
- Keep package boundaries clean: apps consume `@devsuite/shared`; backend should not depend on app code.

## Common commands

- `pnpm install`
- `pnpm dev`
- `pnpm lint`
- `pnpm typecheck`
