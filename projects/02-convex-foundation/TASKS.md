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
Initialize Convex in the `convex/` folder, configure for self-hosted deployment, and verify the dev server runs.

**Acceptance Criteria**:

- [ ] `npx convex dev` starts successfully
- [ ] `convex.json` configured
- [ ] `.env.local` pattern for Convex URL
- [ ] Dev server connects to Convex backend

**Notes**:
Follow Convex self-hosted docs. Coordinate with infra for backend URL.

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
- [ ] `isDeleted` and `deletedAt` on all tables
- [ ] Query helper to exclude deleted items
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

- [ ] `withCompanyScope(query, companyId)` helper
- [ ] Context pattern for current company
- [ ] All queries require companyId parameter
- [ ] Global view mode for cross-company access
- [ ] Validation that entity belongs to company on mutations

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
- [ ] Generic `delete` mutation (soft delete)
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

## Task Dependency Graph

```
TASK-02-001 (init)
└── TASK-02-002 (schema)
    ├── TASK-02-003 (soft delete)
    ├── TASK-02-004 (company scoping)
    │   └── TASK-02-005 (CRUD patterns)
    │       ├── TASK-02-006 (realtime)
    │       └── TASK-02-008 (dev utils)
    └── TASK-02-007 (type integration)
```

## Delegation Order

1. TASK-02-001 (start after scaffolding)
2. TASK-02-002 (after 001 + shared-types)
3. TASK-02-003, TASK-02-004, TASK-02-007 (parallel after 002)
4. TASK-02-005 (after 003 + 004)
5. TASK-02-006, TASK-02-008 (parallel after 005)
