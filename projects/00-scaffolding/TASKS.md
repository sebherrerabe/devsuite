# Tasks: Project Scaffolding

## Task Breakdown

### TASK-00-001: Initialize pnpm Workspace
| Field | Value |
|-------|-------|
| Assigned Persona | Infra / DevOps |
| Status | pending |
| Depends On | none |
| Deliverable | Working pnpm workspace with folder structure |

**Description**:
Create the monorepo structure with pnpm workspaces. Set up the folder hierarchy and root package.json with workspace configuration.

**Acceptance Criteria**:
- [ ] `pnpm-workspace.yaml` exists and lists all workspace packages
- [ ] Root `package.json` has `"private": true` and workspace scripts
- [ ] Folder structure matches architecture spec
- [ ] `pnpm install` succeeds from repo root

**Notes**:
Reference architecture spec for exact folder structure. Create placeholder package.json files in each workspace package.

---

### TASK-00-002: Configure TypeScript
| Field | Value |
|-------|-------|
| Assigned Persona | Infra / DevOps |
| Status | pending |
| Depends On | TASK-00-001 |
| Deliverable | TypeScript configuration with project references |

**Description**:
Set up TypeScript configuration using project references for optimal build performance and type checking across packages.

**Acceptance Criteria**:
- [ ] Root `tsconfig.json` with project references
- [ ] `tsconfig.base.json` with shared compiler options
- [ ] Per-package `tsconfig.json` extending base
- [ ] `pnpm typecheck` validates all packages

**Notes**:
Use strict mode. Configure paths for package imports. Ensure incremental builds work.

---

### TASK-00-003: Configure ESLint + Prettier
| Field | Value |
|-------|-------|
| Assigned Persona | Infra / DevOps |
| Status | pending |
| Depends On | TASK-00-001 |
| Deliverable | Consistent code style enforcement |

**Description**:
Set up ESLint with TypeScript support and Prettier for formatting. Configure for React (web app) and Node.js (MCP server) environments.

**Acceptance Criteria**:
- [ ] ESLint config supports TypeScript
- [ ] ESLint config supports React (for apps/web)
- [ ] Prettier config defined
- [ ] ESLint and Prettier don't conflict
- [ ] `pnpm lint` runs across all packages
- [ ] `pnpm format` formats all files

**Notes**:
Use flat config format (eslint.config.js). Consider @antfu/eslint-config or similar for sensible defaults.

---

### TASK-00-004: Configure Git Hooks
| Field | Value |
|-------|-------|
| Assigned Persona | Infra / DevOps |
| Status | pending |
| Depends On | TASK-00-003 |
| Deliverable | Pre-commit hooks for code quality |

**Description**:
Set up husky and lint-staged to run linting and formatting on staged files before commit.

**Acceptance Criteria**:
- [ ] husky installed and configured
- [ ] lint-staged runs ESLint on staged .ts/.tsx files
- [ ] lint-staged runs Prettier on staged files
- [ ] Pre-commit hook blocks commits with lint errors

**Notes**:
Keep hooks fast - only lint staged files, not entire repo.

---

### TASK-00-005: Create Placeholder Packages
| Field | Value |
|-------|-------|
| Assigned Persona | Infra / DevOps |
| Status | pending |
| Depends On | TASK-00-002 |
| Deliverable | Minimal placeholder packages for each workspace |

**Description**:
Create minimal placeholder packages for apps/web, apps/mcp, packages/shared, and convex. Each should have package.json, tsconfig.json, and a simple entry point.

**Acceptance Criteria**:
- [ ] `apps/web/` has package.json, tsconfig.json, src/index.ts
- [ ] `apps/mcp/` has package.json, tsconfig.json, src/index.ts
- [ ] `packages/shared/` has package.json, tsconfig.json, src/index.ts
- [ ] `convex/` has package.json, tsconfig.json (Convex-specific setup deferred)
- [ ] All packages can be imported by name in other packages

**Notes**:
Use consistent naming: `@devsuite/web`, `@devsuite/mcp`, `@devsuite/shared`. Convex may have different conventions.

---

### TASK-00-006: Create Development Scripts
| Field | Value |
|-------|-------|
| Assigned Persona | Infra / DevOps |
| Status | pending |
| Depends On | TASK-00-005 |
| Deliverable | Unified development scripts in root package.json |

**Description**:
Add development scripts to root package.json that orchestrate all workspace packages.

**Acceptance Criteria**:
- [ ] `pnpm dev` starts all dev servers (placeholder for now)
- [ ] `pnpm build` builds all packages
- [ ] `pnpm lint` lints all packages
- [ ] `pnpm typecheck` type-checks all packages
- [ ] `pnpm clean` removes build artifacts
- [ ] `pnpm test` runs tests (placeholder for now)

**Notes**:
Use pnpm's `--filter` or `--recursive` flags. Consider parallel execution where possible.

---

### TASK-00-007: Write Documentation
| Field | Value |
|-------|-------|
| Assigned Persona | Documentation / DX |
| Status | pending |
| Depends On | TASK-00-006 |
| Deliverable | Updated README with setup and development instructions |

**Description**:
Update the root README.md with comprehensive setup instructions, development workflow, and package structure explanation.

**Acceptance Criteria**:
- [ ] Prerequisites section (Node.js, pnpm)
- [ ] Installation instructions
- [ ] Development workflow (scripts, common tasks)
- [ ] Package structure explanation
- [ ] Contributing guidelines (basic)

**Notes**:
Keep it concise but complete. A new developer should be able to get started from README alone.

---

## Task Dependency Graph

```
TASK-00-001 (pnpm workspace)
├── TASK-00-002 (TypeScript)
│   └── TASK-00-005 (placeholders)
│       └── TASK-00-006 (scripts)
│           └── TASK-00-007 (docs)
└── TASK-00-003 (ESLint/Prettier)
    └── TASK-00-004 (git hooks)
```

## Delegation Order
1. TASK-00-001 (start immediately)
2. TASK-00-002, TASK-00-003 (parallel, after 001)
3. TASK-00-004 (after 003)
4. TASK-00-005 (after 002)
5. TASK-00-006 (after 005)
6. TASK-00-007 (after 006)
