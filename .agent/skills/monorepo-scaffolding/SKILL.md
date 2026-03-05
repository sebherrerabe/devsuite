---
name: monorepo-scaffolding
description: Establish DevSuite’s monorepo “soil”: pnpm workspaces, TypeScript project references, lint/format/husky tooling, base folder structure, scripts, and repo-wide conventions. Also create and maintain nested AGENTS.md files (root and key subdirectories) following Cursor Rules documentation. Use when bootstrapping the repo, standardizing workspace tooling, or writing/refreshing AGENTS.md instructions.
---

# Monorepo Scaffolding (DevSuite)

## Intent

This skill is responsible for setting up (or hardening) the foundation that all other DevSuite projects depend on:

- Workspace structure (`apps/`, `packages/`, `convex/`, `docs/`)
- Tooling (pnpm, TypeScript, ESLint, Prettier, husky, lint-staged)
- Conventions + best practices (imports, boundaries, scripts, env handling)
- Agent guidance via **nested `AGENTS.md` files** (root + key folders)

## Non-Goals

- Implementing feature modules (Company/Repo/Project/Task/Session/etc.)
- Defining product scope (use `project-management` for that)
- Shipping “perfect” final dependency choices when not required; prefer sane defaults with documented rationale

## Inputs to Read First (order matters)

1. `projects/_conventions.md` (spec standards)
2. `projects/00-scaffolding/PROJECT.md` and `projects/00-scaffolding/DEPENDENCIES.md`
3. `/dev_suite_conceptual_architecture_business_vs_tech.md` (target repo shape)

## Workflow (follow in order)

### 1) Decide and document baseline versions

- **Node**: default to **Node.js 20+** unless repo already standardizes another version.
- **Package manager**: **pnpm** only.
- Record the decision in root documentation (README and/or `AGENTS.md`).

### 2) Create the canonical repo structure

Ensure this structure exists (add placeholders only when needed):

```
apps/
  web/
  mcp/
convex/
packages/
  shared/
docs/
projects/
```

### 3) Configure workspace + TypeScript project references

Required outcomes:

- `pnpm install` works at repo root
- `pnpm dev` can start relevant dev processes (or a clear default, even if some apps are not implemented yet)
- `pnpm lint` and `pnpm typecheck` work across workspaces
- TS is **strict**, consistent, and supports package boundary imports cleanly

### 4) Configure code quality + hooks (repo-wide)

Required outcomes:

- ESLint configured for TS/React/Node workspaces (modern ESLint v9 flat config preferred if starting fresh)
- Prettier configured and wired into scripts
- husky + lint-staged enforce fast pre-commit checks (format + lint, optionally typecheck only if it’s fast)

### 5) Establish conventions + best practices (document them)

At minimum document:

- **Workspace boundaries**: `packages/shared` contains contracts/utilities; apps consume it; backend (`convex`) should not depend on `apps/*`
- **No hard deletes** (project-wide invariant; backend enforces, but conventions should reinforce)
- **Company scoping** as a foundational rule (even before auth is fully implemented)
- **“External systems referenced, never mirrored”** (GitHub/Notion/TickTick)
- **Env & secrets**: no secrets committed; prefer `.env.example`
- **Scripts**: standard names and expected behavior

### 6) Create/refresh `AGENTS.md` (root + nested)

Cursor supports **plain markdown** `AGENTS.md` in the project root and subdirectories; it’s a simple alternative to `.cursor/rules`.
Reference: `https://cursor.com/docs/context/rules#agentsmd`

Rules for `AGENTS.md`:

- **Plain markdown only** (no YAML frontmatter)
- **Short, actionable instructions**
- Prefer **links to canonical files** over duplicating large docs
- Use **nested `AGENTS.md`** to specialize guidance per folder

Create `AGENTS.md` in:

- Repo root (`/AGENTS.md`)
- `apps/web/AGENTS.md`
- `apps/mcp/AGENTS.md`
- `convex/AGENTS.md`
- `packages/shared/AGENTS.md`
- `projects/AGENTS.md` (optional but recommended: teaches how to operate the spec system)

Use the templates in [AGENTS_TEMPLATES.md](AGENTS_TEMPLATES.md) as the default starting point and adapt to actual code as it lands.

### 7) Verification loop (must pass before “done”)

Run:

- `pnpm -v` and `node -v` (confirm assumptions)
- `pnpm install`
- `pnpm lint`
- `pnpm typecheck`
  If any fail:
- fix config or scripts
- re-run until green

## Deliverables Checklist

- [ ] Workspace folders exist (`apps/web`, `apps/mcp`, `convex`, `packages/shared`, `docs`)
- [ ] pnpm workspace configured and documented
- [ ] TypeScript project references configured for multi-package builds
- [ ] ESLint + Prettier configured and wired into scripts
- [ ] husky + lint-staged enabled with sensible pre-commit checks
- [ ] Root `README` (or equivalent) explains setup + scripts
- [ ] `AGENTS.md` created in root and relevant subdirectories using the provided templates

## Notes on Style

- Optimize for **clarity and repeatability** over cleverness.
- Prefer the simplest tooling that supports the repo today; avoid premature orchestration until needed.

## References

- Cursor Rules (AGENTS.md): `https://cursor.com/docs/context/rules#agentsmd`
- Cursor Skills Documentation: `https://cursor.com/docs/context/skills`
- Project conventions: `projects/_conventions.md`
- Architecture spec: `dev_suite_conceptual_architecture_business_vs_tech.md`
