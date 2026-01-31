# Tasks: Convex Foundation

## Task Breakdown

### TASK-02-001: Initialize Convex Project

| Field            | Value                                  |
| ---------------- | -------------------------------------- |
| Assigned Persona | Convex Developer                       |
| Status           | pending                                |
| Depends On       | 00-scaffolding complete                |
| Deliverable      | Working Convex development environment |

**Description**:
Initialize Convex in the `convex/` folder for **Convex Cloud (Free tier) first**, and verify the dev server runs.

**Acceptance Criteria**:

- [ ] `pnpm dev` (in `convex/`) starts successfully (Convex CLI)
- [ ] `convex.json` configured to point to `convex/` functions
- [ ] Local `.env.local` pattern documented for Convex URL (Vite uses `VITE_CONVEX_URL`; other frameworks may use `NEXT_PUBLIC_CONVEX_URL`)
- [ ] Dev server connects to Convex backend

**Notes**:
Follow Convex Cloud docs (Free-first). Portability/self-hosting is documented as a future option, not the default.

---

### TASK-02-002: Define Core Entity Schemas

| Field            | Value                                    |
| ---------------- | ---------------------------------------- |
| Assigned Persona | Convex Developer                         |
| Status           | pending                                  |
| Depends On       | TASK-02-001, 01-shared-types complete    |
| Deliverable      | Schema definitions for all core entities |

**Description**:
Create `convex/schema.ts` with table definitions for all core entities, matching types from `@devsuite/shared`.

**Acceptance Criteria**:

- [ ] `companies` table with indexes
- [ ] `repositories` table with companyId index
- [ ] `projects` table with companyId, repositoryId indexes
- [ ] `tasks` table with projectId, parentTaskId indexes
- [ ] `sessions` table with companyId index
- [ ] `sessionTasks` junction table
- [ ] `inboxItems` table with companyId index
- [ ] `prReviews` table with repositoryId index
- [ ] `performanceSignals` table
- [ ] `invoices` table with companyId index
- [ ] `rateCards` table with companyId index
- [ ] All tables have soft delete fields

**Notes**:
Ensure field names match `@devsuite/shared` types exactly. Add appropriate indexes for query patterns.

---

### TASK-02-003: Implement Soft Delete Pattern

| Field            | Value                                 |
| ---------------- | ------------------------------------- |
| Assigned Persona | Convex Developer                      |
| Status           | pending                               |
| Depends On       | TASK-02-002                           |
| Deliverable      | Soft delete utilities and enforcement |

**Description**:
Create helper functions for soft delete pattern and ensure all queries exclude deleted items by default.

**Acceptance Criteria**:

- [ ] `softDelete(ctx, table, id)` function
- [ ] `deletedAt` is the single source-of-truth for deletion state (align with `@devsuite/shared`)
- [ ] Query pattern to exclude deleted items by default (filter `deletedAt` as “not deleted”)
- [ ] Option to include deleted for admin views
- [ ] No way to hard delete via Convex functions

**Notes**:
This is a non-negotiable data integrity rule from the architecture spec.

---

### TASK-02-004: Implement Company Scoping Pattern

| Field            | Value                     |
| ---------------- | ------------------------- |
| Assigned Persona | Convex Developer          |
| Status           | pending                   |
| Depends On       | TASK-02-002               |
| Deliverable      | Company scoping utilities |

**Description**:
Create helpers to enforce company scoping on all data access.

**Acceptance Criteria**:

- [ ] All company-scoped queries require `companyId` parameter (explicit args)
- [ ] Helper(s) exist to enforce `companyId` presence (e.g., `requireCompanyId`)
- [ ] Validation that entity belongs to company on mutations (ownership checks for passed IDs)
- [ ] Optional future: global view mode for cross-company admin access (explicit and gated)

**Notes**:
Company scoping is enforced at the query level, not just filtering. An entity from company A should never be accessible when viewing company B.

---

### TASK-02-005: Create Base CRUD Patterns

| Field            | Value                           |
| ---------------- | ------------------------------- |
| Assigned Persona | Convex Developer                |
| Status           | pending                         |
| Depends On       | TASK-02-003, TASK-02-004        |
| Deliverable      | Reusable CRUD function patterns |

**Description**:
Create base patterns for CRUD operations that feature modules will extend.

**Acceptance Criteria**:

- [ ] Generic `list` query pattern with pagination
- [ ] Generic `get` query pattern with company validation
- [ ] Generic `create` mutation pattern with timestamps
- [ ] Generic `update` mutation pattern with updatedAt
- [ ] Generic `softDelete` / `archive` mutation pattern (sets `deletedAt`, never hard deletes)
- [ ] Validation helpers for inputs

**Notes**:
These are patterns/utilities, not the actual entity functions. Feature modules implement specific functions using these patterns.

---

### TASK-02-006: Set Up Realtime Subscription Patterns

| Field            | Value                             |
| ---------------- | --------------------------------- |
| Assigned Persona | Convex Developer                  |
| Status           | pending                           |
| Depends On       | TASK-02-005                       |
| Deliverable      | Optimized realtime query patterns |

**Description**:
Establish patterns for realtime subscriptions that work efficiently with Convex's reactive system.

**Acceptance Criteria**:

- [ ] Subscription-friendly query structure
- [ ] Index-based queries for efficiency
- [ ] Pagination that works with realtime
- [ ] Pattern for "live" lists (tasks, sessions)
- [ ] Documentation of subscription patterns

**Notes**:
Convex automatically handles realtime. Focus on query patterns that minimize re-renders and data transfer.

---

### TASK-02-007: Integrate with Shared Types

| Field            | Value                                            |
| ---------------- | ------------------------------------------------ |
| Assigned Persona | Convex Developer                                 |
| Status           | pending                                          |
| Depends On       | TASK-02-002                                      |
| Deliverable      | Type alignment between Convex and shared package |

**Description**:
Ensure Convex-generated types align with `@devsuite/shared` types for seamless type safety.

**Acceptance Criteria**:

- [ ] Convex Doc types match shared entity types
- [ ] ID types are compatible
- [ ] Enum values match
- [ ] No type casting needed at boundaries
- [ ] Type tests verify alignment

**Notes**:
May need adapter types or careful schema design. The goal is end-to-end type safety.

---

### TASK-02-008: Create Development Utilities

| Field            | Value                             |
| ---------------- | --------------------------------- |
| Assigned Persona | Convex Developer                  |
| Status           | pending                           |
| Depends On       | TASK-02-005                       |
| Deliverable      | Dev tools for testing and seeding |

**Description**:
Create utilities for development: seed data, test helpers, reset functions.

**Acceptance Criteria**:

- [ ] Seed function for sample data
- [ ] Reset function for dev environment
- [ ] Test utilities for function testing
- [ ] Documentation for dev workflow

**Notes**:
These should only be available in development, not production.

---

### TASK-02-009: Integrate Better Auth on Convex (Backend-Only)

| Field            | Value                                                  |
| ---------------- | ------------------------------------------------------ |
| Assigned Persona | Convex Developer                                       |
| Status           | pending                                                |
| Depends On       | TASK-02-001                                            |
| Deliverable      | Better Auth integrated in Convex with sanity endpoints |

**Description**:
Integrate Better Auth into the Convex backend (no frontend UI work). Ensure identity is available in functions and auth HTTP routes are wired.

**Acceptance Criteria**:

- [ ] `convex/auth.config.ts` configures Better Auth provider(s)
- [ ] `convex/convex.config.ts` registers the Better Auth component
- [ ] `convex/http.ts` registers Better Auth HTTP routes
- [ ] A minimal “sanity” query exists that returns `ctx.auth.getUserIdentity()`
- [ ] Environment variables required by Better Auth are documented as **Convex env vars** (not committed in `.env`)

**Notes**:
Frontend login/registration UI is explicitly out of scope for this project.

---

### TASK-02-010: Convex Cloud Free-First Runbook + Portability Notes

| Field            | Value                                         |
| ---------------- | --------------------------------------------- |
| Assigned Persona | Infra / DevOps                                |
| Status           | pending                                       |
| Depends On       | TASK-02-001                                   |
| Deliverable      | Reproducible setup/deploy runbook for authors |

**Description**:
Document the standard workflow for developing and deploying DevSuite’s Convex backend using Convex Cloud Free tier as the baseline, with portability guidance for future self-hosting.

**Acceptance Criteria**:

- [ ] Clear “first-time setup” steps for a new developer
- [ ] Clear environment variable guidance (local vs Convex Cloud env)
- [ ] Clear deploy steps (dev vs prod deployments)
- [ ] Portability notes are present (self-hosting is not the default)

**Notes**:
Keep this concise and optimized for downstream module authors.

---

### TASK-02-011: Downstream Module Author Runbook (Convex Patterns)

| Field            | Value                                         |
| ---------------- | --------------------------------------------- |
| Assigned Persona | Documentation / DX                            |
| Status           | pending                                       |
| Depends On       | TASK-02-003, TASK-02-004                      |
| Deliverable      | Single “how to write Convex code” runbook doc |

**Description**:
Create a concise reference for module authors covering company scoping, soft delete, external references only, and realtime/pagination guidance, plus identity/service-auth notes.

**Acceptance Criteria**:

- [ ] Company scoping pattern is explicit (`companyId` required + ownership validation)
- [ ] Soft delete pattern forbids `db.delete` and uses `deletedAt` as source-of-truth
- [ ] “External refs only” examples are included
- [ ] Realtime query + pagination guidance included (indexes + cursor patterns)
- [ ] Identity access (`ctx.auth.getUserIdentity()`) + MCP “service auth” note included

---

### TASK-02-012: QA Validation Checklist (Convex Invariants)

| Field            | Value                                              |
| ---------------- | -------------------------------------------------- |
| Assigned Persona | QA / Validation                                    |
| Status           | pending                                            |
| Depends On       | TASK-02-002, TASK-02-003, TASK-02-004, TASK-02-009 |
| Deliverable      | Validation checklist for foundation invariants     |

**Description**:
Create a lightweight checklist that validates the Convex foundation invariants (company scoping, soft delete, external refs only) and Better Auth baseline behavior.

**Acceptance Criteria**:

- [ ] Confirm no app-level hard deletes (`db.delete`) are used for core entities
- [ ] Confirm all company-scoped tables have appropriate company indexes
- [ ] Confirm queries exclude deleted entities by default
- [ ] Confirm ownership checks exist on mutations that accept entity IDs
- [ ] Confirm unauthenticated requests return no identity from `ctx.auth.getUserIdentity()`

## Task Dependency Graph

```
TASK-02-001 (init)
└── TASK-02-002 (schema)
    ├── TASK-02-003 (soft delete)
    ├── TASK-02-004 (company scoping)
    │   └── TASK-02-005 (CRUD patterns)
    │       ├── TASK-02-006 (realtime)
    │       └── TASK-02-008 (dev utils)
    ├── TASK-02-007 (type integration)
    └── TASK-02-009 (better auth)

TASK-02-001 (init)
└── TASK-02-010 (cloud runbook)

TASK-02-003 + TASK-02-004
└── TASK-02-011 (author runbook)

TASK-02-002 + TASK-02-003 + TASK-02-004 + TASK-02-009
└── TASK-02-012 (qa checklist)
```

## Delegation Order

1. TASK-02-001 (start after scaffolding)
2. TASK-02-002 (after 001 + shared-types)
3. TASK-02-003, TASK-02-004, TASK-02-007 (parallel after 002)
4. TASK-02-009 (after 001)
5. TASK-02-010 (after 001)
6. TASK-02-011 (after 003 + 004)
7. TASK-02-005 (after 003 + 004)
8. TASK-02-006, TASK-02-008 (parallel after 005)
9. TASK-02-012 (after 002 + 003 + 004 + 009)
