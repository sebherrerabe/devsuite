# Tasks: Shared Types & Schemas

## Task Breakdown

### TASK-01-001: Define Base Types and Utilities

| Field            | Value                                  |
| ---------------- | -------------------------------------- |
| Assigned Persona | Backend Engineer                       |
| Status           | pending                                |
| Depends On       | 00-scaffolding complete                |
| Deliverable      | Base types, branded IDs, utility types |

**Description**:
Create foundational types used across all entities: branded ID types, timestamp types, pagination, and common patterns.

**Acceptance Criteria**:

- [ ] Branded ID types: `CompanyId`, `RepositoryId`, `ProjectId`, `TaskId`, `SessionId`
- [ ] Timestamp type (Unix ms)
- [ ] `SoftDeletable` type with `isDeleted`, `deletedAt`
- [ ] `Timestamped` type with `createdAt`, `updatedAt`
- [ ] Pagination types: `PaginatedRequest`, `PaginatedResponse`
- [ ] Result type for error handling

**Notes**:
Use TypeScript branded types pattern: `type CompanyId = string & { __brand: 'CompanyId' }`

---

### TASK-01-002: Define Company and Repository Types

| Field            | Value                                         |
| ---------------- | --------------------------------------------- |
| Assigned Persona | Backend Engineer                              |
| Status           | pending                                       |
| Depends On       | TASK-01-001                                   |
| Deliverable      | Company and Repository entity types + schemas |

**Description**:
Define types and Zod schemas for Company and Repository entities.

**Acceptance Criteria**:

- [ ] `Company` type with all fields from spec
- [ ] `CompanySchema` Zod schema
- [ ] `CreateCompanyInput`, `UpdateCompanyInput` types
- [ ] `Repository` type with all fields
- [ ] `RepositorySchema` Zod schema
- [ ] `CreateRepositoryInput`, `UpdateRepositoryInput` types

**Notes**:
Company is the root boundary. Repository belongs to exactly one Company.

---

### TASK-01-003: Define Project and Task Types

| Field            | Value                                   |
| ---------------- | --------------------------------------- |
| Assigned Persona | Backend Engineer                        |
| Status           | pending                                 |
| Depends On       | TASK-01-001                             |
| Deliverable      | Project and Task entity types + schemas |

**Description**:
Define types and Zod schemas for Project and Task entities, including hierarchical task support and external links.

**Acceptance Criteria**:

- [ ] `Project` type with all fields
- [ ] `ProjectSchema` Zod schema
- [ ] `Task` type with hierarchical support (`parentTaskId`)
- [ ] `TaskStatus` enum
- [ ] `TaskSchema` Zod schema
- [ ] `ExternalLink` type and schema
- [ ] `ExternalLinkType` enum

**Notes**:
Tasks are hierarchical - parentTaskId is optional. External links are typed by source system.

---

### TASK-01-004: Define Session Types

| Field            | Value                                          |
| ---------------- | ---------------------------------------------- |
| Assigned Persona | Backend Engineer                               |
| Status           | pending                                        |
| Depends On       | TASK-01-001                                    |
| Deliverable      | Session and SessionTask entity types + schemas |

**Description**:
Define types and Zod schemas for Session and Session-Task relationship.

**Acceptance Criteria**:

- [ ] `Session` type with all fields
- [ ] `SessionSchema` Zod schema
- [ ] `SessionTask` junction type
- [ ] `SessionTaskSchema` Zod schema
- [ ] Support for sessions with no tasks (exploratory work)

**Notes**:
Sessions are the primary source of truth for time tracking. A session may touch multiple tasks or none.

---

### TASK-01-005: Define Inbox and Notification Types

| Field            | Value                     |
| ---------------- | ------------------------- |
| Assigned Persona | Backend Engineer          |
| Status           | pending                   |
| Depends On       | TASK-01-001               |
| Deliverable      | InboxItem types + schemas |

**Description**:
Define types and Zod schemas for the unified inbox system.

**Acceptance Criteria**:

- [ ] `InboxItem` type with all fields
- [ ] `InboxItemType` enum (notification, pr_review, mention, etc.)
- [ ] `InboxItemSource` enum (github, notion, internal)
- [ ] `InboxItemSchema` Zod schema

**Notes**:
Inbox items are company-scoped and respect privacy mode.

---

### TASK-01-006: Define PR Review Types

| Field            | Value                    |
| ---------------- | ------------------------ |
| Assigned Persona | Backend Engineer         |
| Status           | pending                  |
| Depends On       | TASK-01-002              |
| Deliverable      | PRReview types + schemas |

**Description**:
Define types and Zod schemas for PR review storage.

**Acceptance Criteria**:

- [ ] `PRReview` type with all fields
- [ ] `PRReviewSchema` Zod schema
- [ ] Metadata type for review signals (risk areas, etc.)
- [ ] Support for AI-generated content storage

**Notes**:
PR reviews are durable artifacts. Content is typically markdown generated by AI agents via MCP.

---

### TASK-01-007: Define Performance and Invoicing Types

| Field            | Value                                         |
| ---------------- | --------------------------------------------- |
| Assigned Persona | Backend Engineer                              |
| Status           | pending                                       |
| Depends On       | TASK-01-004                                   |
| Deliverable      | PerformanceSignal and Invoice types + schemas |

**Description**:
Define types and Zod schemas for performance signals and invoicing.

**Acceptance Criteria**:

- [ ] `PerformanceSignal` type
- [ ] Signal types enum (time_per_task, context_switches, etc.)
- [ ] `Invoice` type with all fields
- [ ] `RateCard` type for billing configuration
- [ ] `InvoiceSchema` Zod schema

**Notes**:
Invoicing is derivative - based on sessions. Performance signals are raw data, not judgements.

---

### TASK-01-008: Create Export Structure

| Field            | Value                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| Assigned Persona | Backend Engineer                                                             |
| Status           | pending                                                                      |
| Depends On       | TASK-01-002, TASK-01-003, TASK-01-004, TASK-01-005, TASK-01-006, TASK-01-007 |
| Deliverable      | Clean package exports                                                        |

**Description**:
Organize all types and schemas into a clean export structure for the package.

**Acceptance Criteria**:

- [ ] `src/index.ts` exports all public types
- [ ] Types organized by domain (company, task, session, etc.)
- [ ] Schemas exported alongside types
- [ ] No circular dependencies
- [ ] Tree-shakeable exports

**Notes**:
Consider barrel exports per domain: `@devsuite/shared/company`, `@devsuite/shared/task`, etc.

---

## Task Dependency Graph

```
TASK-01-001 (base types)
├── TASK-01-002 (company, repo)
│   └── TASK-01-006 (pr review)
├── TASK-01-003 (project, task)
├── TASK-01-004 (session)
│   └── TASK-01-007 (performance, invoicing)
└── TASK-01-005 (inbox)

All above → TASK-01-008 (exports)
```

## Delegation Order

1. TASK-01-001 (start immediately after 00-scaffolding)
2. TASK-01-002, TASK-01-003, TASK-01-004, TASK-01-005 (parallel)
3. TASK-01-006 (after 002), TASK-01-007 (after 004)
4. TASK-01-008 (after all others)
