# AGENTS.md Templates (DevSuite)

These are **starting templates** for the `AGENTS.md` files created by the `monorepo-scaffolding` skill.

Cursor rules reference (AGENTS.md): `https://cursor.com/docs/context/rules#agentsmd`

---

## `/AGENTS.md` (repo root)

```markdown
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
```

---

## `/projects/AGENTS.md`

```markdown
# Projects (Specs) — Agent Instructions

## Purpose

`projects/` is the spec system and execution plan for DevSuite. It is the source of truth for what gets built, in what order, and how work is decomposed.

## Conventions

- Follow `projects/_conventions.md` exactly for file formats and checklists.
- Update project status docs (`STATUS.md`) when progress/blockers change.
- Decompose work into vertical slices and assign to personas defined in `projects/_personas.md`.

## Where to start

- `projects/_index.md` for dependencies and priority order
- Each project’s `PROJECT.md` for summary/success criteria
```

---

## `/packages/shared/AGENTS.md`

```markdown
# packages/shared — Agent Instructions

## Purpose

Single source of truth for shared contracts:

- TypeScript types
- Zod schemas for runtime validation
- small shared utilities (no app-specific logic)

## Rules

- Keep exports stable; document breaking changes.
- Avoid circular dependencies.
- Keep imports dependency-light (shared should not depend on apps; avoid backend-specific imports).
- Prefer Zod schemas colocated with types when feasible.

## Outputs expected

- Clean import surface: `@devsuite/shared`
- Strict TypeScript compatibility
```

---

## `/convex/AGENTS.md`

```markdown
# convex — Agent Instructions

## Purpose

Convex backend for DevSuite: schema + functions enforcing integrity.

## Rules (non-negotiable)

- Enforce company scoping on every query/mutation/action.
- No hard deletes; implement soft delete patterns only.
- External systems referenced, never mirrored.

## Implementation conventions

- Validate inputs (prefer shared Zod schemas where appropriate).
- Prefer shared helper utilities for common scoping/authorization checks.
- Index for common access patterns (companyId + entity fields).
```

---

## `/apps/web/AGENTS.md`

```markdown
# apps/web — Agent Instructions

## Stack

- Vite + React + TypeScript
- TanStack Router
- Tailwind CSS + shadcn/ui
- Convex React client

## UI conventions

- Build accessible, responsive components by default.
- Always include loading/empty/error states for data-driven UI.
- Prefer reusable components for selectors (company/repo/project/task).

## Data conventions

- Use Convex subscriptions for realtime entity lists when appropriate.
- Keep company context consistent with the shell’s company switcher.
```

---

## `/apps/mcp/AGENTS.md`

```markdown
# apps/mcp — Agent Instructions

## Purpose

MCP server is the AI-facing control plane for DevSuite. It exposes safe tools that call into Convex and local tooling (e.g., GitHub CLI).

## Rules (non-negotiable)

- Agents can read and modify; never delete.
- Enforce company scoping for every operation.
- Authentication is required (static token as baseline).

## Tooling conventions

- Tools must have clear, minimal inputs and predictable outputs.
- Return structured errors that help agents recover (don’t hide failures).
```
