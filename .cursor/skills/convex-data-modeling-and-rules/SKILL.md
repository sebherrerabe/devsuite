---
name: convex-data-modeling-and-rules
description: Define Convex schemas, data modeling patterns, and enforce DevSuite invariants (company scoping, soft delete, external refs only). Use when creating new Convex tables, modifying schemas, or establishing data integrity rules.
---

# Convex Data Modeling and Rules (DevSuite)

## Intent
This skill is responsible for defining Convex schemas that enforce DevSuite's core data integrity invariants:
- **Company scoping**: All work belongs to exactly one company
- **Soft delete**: No hard deletes; use `deletedAt` timestamps
- **External refs only**: Never mirror external system content; store identifiers/URLs only
- **Type safety**: Schemas align with `@devsuite/shared` TypeScript types

## Non-Goals
- Implementing CRUD functions (use `convex-functions-crud-patterns`)
- Authentication/authorization logic (use `authz-and-company-scope`)
- Frontend integration patterns (use `frontend-convex-integration`)

## Inputs to Read First
- Repo: `projects/02-convex-foundation/PROJECT.md`
- Repo: `projects/01-shared-types/PROJECT.md`
- Repo: `/dev_suite_conceptual_architecture_business_vs_tech.md` (sections 2.1-2.12)
- Repo: `projects/_conventions.md` (spec standards)
- Convex docs: Schema definition patterns, table design best practices

## Workflow

### 1) Define schema structure
Create or update `convex/schema.ts` following this pattern:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  companies: defineTable({
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()), // Soft delete
  })
    .index("by_deletedAt", ["deletedAt"])
    .index("by_createdAt", ["createdAt"]),

  // All entities that belong to a company MUST include companyId
  repositories: defineTable({
    companyId: v.id("companies"), // Required: company scoping
    externalId: v.string(), // GitHub repo identifier
    externalUrl: v.string(), // URL reference only, never content
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index("by_companyId", ["companyId"])
    .index("by_companyId_deletedAt", ["companyId", "deletedAt"])
    .index("by_externalId", ["externalId"]),
});
```

### 2) Enforce DevSuite invariants in schema design

**Company scoping rule**:
- Every entity that represents "work" MUST have `companyId: v.id("companies")`
- Exception: `companies` table itself (root entity)
- Create index: `by_companyId` or `by_companyId_deletedAt` for efficient filtering

**Soft delete rule**:
- Every table MUST include `deletedAt: v.union(v.number(), v.null())`
- `null` = active record; `number` (timestamp) = deleted
- Create index: `by_deletedAt` or composite with `companyId`
- Never use Convex's built-in delete operations

**External refs only rule**:
- For GitHub/Notion/TickTick links: store `externalId` (string) and `externalUrl` (string)
- Never store: full content, HTML, markdown from external systems
- Example: PR review stores `prUrl` and `prNumber`, not the diff or review comments

### 3) Align with shared types
- Import types from `@devsuite/shared` when available
- Schema field names should match TypeScript type properties
- Use `v.union()` for optional fields that can be `null`
- Use `v.number()` for timestamps (Unix epoch milliseconds)

### 4) Create indexes for common query patterns
Required indexes for company-scoped entities:
- `by_companyId`: Filter by company
- `by_companyId_deletedAt`: Filter active records by company
- `by_externalId`: Lookup by external system identifier (if applicable)

Optional indexes:
- `by_createdAt`: Time-based queries
- `by_updatedAt`: Recent changes
- Composite indexes for multi-field filters

### 5) Document schema decisions
Add comments in `schema.ts` explaining:
- Why a field exists
- What external system an `externalId` references
- Any special constraints or invariants

Example:
```typescript
repositories: defineTable({
  // Required: all work belongs to a company
  companyId: v.id("companies"),
  // GitHub repo identifier (e.g., "owner/repo")
  externalId: v.string(),
  // URL reference only; DevSuite never mirrors repo content
  externalUrl: v.string(),
  // ...
})
```

## Deliverables Checklist
- [ ] Schema file (`convex/schema.ts`) exists and exports `default defineSchema(...)`
- [ ] All tables include `deletedAt: v.union(v.number(), v.null())`
- [ ] All work entities include `companyId: v.id("companies")`
- [ ] External references use `externalId`/`externalUrl` strings only (no content mirroring)
- [ ] Indexes created for `by_companyId` and `by_companyId_deletedAt` patterns
- [ ] Schema aligns with `@devsuite/shared` types
- [ ] Comments document invariants and external system references

## Default Schema Skeleton

For a new company-scoped entity, use this template:

```typescript
entityName: defineTable({
  // REQUIRED: Company scoping
  companyId: v.id("companies"),

  // Entity-specific fields
  name: v.string(),
  // ... other fields ...

  // REQUIRED: Soft delete
  deletedAt: v.union(v.number(), v.null()),

  // REQUIRED: Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_companyId", ["companyId"])
  .index("by_companyId_deletedAt", ["companyId", "deletedAt"])
```

## References
- Convex schema docs: https://docs.convex.dev/database/schemas
- DevSuite architecture: `/dev_suite_conceptual_architecture_business_vs_tech.md`
- Shared types: `projects/01-shared-types/PROJECT.md`
