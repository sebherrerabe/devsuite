---
name: convex-functions-crud-patterns
description: Implement Convex query, mutation, and action functions following DevSuite CRUD patterns with company scoping, soft delete, and type safety. Use when creating or modifying Convex functions for data operations.
---

# Convex Functions: CRUD Patterns (DevSuite)

## Intent
This skill provides standardized patterns for implementing Convex functions (queries, mutations, actions) that:
- Enforce company scoping automatically
- Implement soft delete (never hard delete)
- Maintain type safety with `@devsuite/shared` types
- Follow consistent error handling and validation patterns

## Non-Goals
- Schema definition (use `convex-data-modeling-and-rules`)
- Authorization logic (use `authz-and-company-scope`)
- External API calls (use actions, but patterns are module-specific)

## Inputs to Read First
- Repo: `projects/02-convex-foundation/PROJECT.md`
- Repo: `projects/01-shared-types/PROJECT.md`
- Repo: `/dev_suite_conceptual_architecture_business_vs_tech.md` (sections 2.1-2.12)
- Convex docs: Query/mutation/action patterns, error handling, type inference

## Workflow

### 1) Create helper utilities for common patterns

Create `convex/lib/helpers.ts` with reusable functions:

```typescript
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Get company ID from context (placeholder until auth is implemented).
 * TODO: Replace with actual auth token parsing.
 */
export function getCompanyId(ctx: QueryCtx | MutationCtx): Id<"companies"> {
  // Placeholder: return first company for now
  // In production, extract from auth token
  throw new Error("Auth not implemented");
}

/**
 * Assert record belongs to company and is not deleted.
 */
export async function assertCompanyScoped<T extends { companyId: Id<"companies">; deletedAt: number | null }>(
  ctx: QueryCtx | MutationCtx,
  table: string,
  id: Id<T>,
  companyId: Id<"companies">
): Promise<T> {
  const record = await ctx.db.get(id);
  if (!record) {
    throw new Error(`${table} not found`);
  }
  if (record.companyId !== companyId) {
    throw new Error(`${table} does not belong to company`);
  }
  if (record.deletedAt !== null) {
    throw new Error(`${table} is deleted`);
  }
  return record as T;
}
```

### 2) Implement query functions

**Pattern: List active records by company**

```typescript
// convex/companies.ts
import { query } from "./_generated/server";
import { v } from "convex/values";
import { getCompanyId } from "./lib/helpers";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const companyId = getCompanyId(ctx);
    return await ctx.db
      .query("repositories")
      .withIndex("by_companyId_deletedAt", (q) =>
        q.eq("companyId", companyId).eq("deletedAt", null)
      )
      .collect();
  },
});

export const get = query({
  args: { id: v.id("repositories") },
  handler: async (ctx, args) => {
    const companyId = getCompanyId(ctx);
    const repo = await assertCompanyScoped(ctx, "repositories", args.id, companyId);
    return repo;
  },
});
```

**Pattern: Filter by external ID**

```typescript
export const getByExternalId = query({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    const companyId = getCompanyId(ctx);
    const repo = await ctx.db
      .query("repositories")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .filter((q) => q.eq(q.field("companyId"), companyId))
      .filter((q) => q.eq(q.field("deletedAt"), null))
      .first();
    return repo ?? null;
  },
});
```

### 3) Implement mutation functions

**Pattern: Create with company scoping**

```typescript
// convex/repositories.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCompanyId } from "./lib/helpers";

export const create = mutation({
  args: {
    externalId: v.string(),
    externalUrl: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const companyId = getCompanyId(ctx);
    const now = Date.now();

    return await ctx.db.insert("repositories", {
      companyId,
      externalId: args.externalId,
      externalUrl: args.externalUrl,
      name: args.name,
      createdAt: now,
      updatedAt: now,
      deletedAt: null, // Always start as active
    });
  },
});
```

**Pattern: Update (never allow companyId change)**

```typescript
export const update = mutation({
  args: {
    id: v.id("repositories"),
    name: v.optional(v.string()),
    externalUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const companyId = getCompanyId(ctx);
    const repo = await assertCompanyScoped(ctx, "repositories", args.id, companyId);

    await ctx.db.patch(args.id, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.externalUrl !== undefined && { externalUrl: args.externalUrl }),
      updatedAt: Date.now(),
      // Never patch companyId or deletedAt via update
    });

    return args.id;
  },
});
```

**Pattern: Soft delete (never hard delete)**

```typescript
export const remove = mutation({
  args: { id: v.id("repositories") },
  handler: async (ctx, args) => {
    const companyId = getCompanyId(ctx);
    const repo = await assertCompanyScoped(ctx, "repositories", args.id, companyId);

    // Soft delete: set deletedAt timestamp
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return args.id;
  },
});
```

**CRITICAL**: Never use `ctx.db.delete()`. Always use soft delete pattern.

### 4) Handle relationships and cascading

**Pattern: Check for dependent records before soft delete**

```typescript
export const remove = mutation({
  args: { id: v.id("repositories") },
  handler: async (ctx, args) => {
    const companyId = getCompanyId(ctx);
    const repo = await assertCompanyScoped(ctx, "repositories", args.id, companyId);

    // Check if repository has active projects
    const activeProjects = await ctx.db
      .query("projects")
      .withIndex("by_repositoryId_deletedAt", (q) =>
        q.eq("repositoryId", args.id).eq("deletedAt", null)
      )
      .first();

    if (activeProjects) {
      throw new Error("Cannot delete repository with active projects");
    }

    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return args.id;
  },
});
```

### 5) Type safety with shared types

Import and validate with Zod schemas from `@devsuite/shared`:

```typescript
import { RepositoryCreateInput, RepositoryUpdateInput } from "@devsuite/shared";

export const create = mutation({
  args: {
    externalId: v.string(),
    externalUrl: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate input matches shared type expectations
    const input: RepositoryCreateInput = {
      externalId: args.externalId,
      externalUrl: args.externalUrl,
      name: args.name,
    };

    // ... rest of implementation
  },
});
```

### 6) Error handling patterns

Use consistent error messages:

```typescript
// Not found
throw new Error(`${tableName} not found`);

// Company mismatch
throw new Error(`${tableName} does not belong to company`);

// Already deleted
throw new Error(`${tableName} is deleted`);

// Validation error
throw new Error(`Invalid ${fieldName}: ${reason}`);

// Dependency violation
throw new Error(`Cannot delete ${tableName} with active ${dependentTable}`);
```

## Deliverables Checklist
- [ ] Helper functions exist in `convex/lib/helpers.ts` for company scoping and assertions
- [ ] Query functions filter by `companyId` and `deletedAt === null`
- [ ] Mutation functions enforce company scoping and never allow `companyId` changes
- [ ] All delete operations use soft delete (patch `deletedAt`), never `ctx.db.delete()`
- [ ] Functions validate inputs and return consistent error messages
- [ ] Functions use indexes for efficient queries
- [ ] Type safety maintained with `@devsuite/shared` imports where available

## Default CRUD Skeleton

For a new entity, create these functions:

```typescript
// convex/entities.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCompanyId, assertCompanyScoped } from "./lib/helpers";

// List active records
export const list = query({
  args: {},
  handler: async (ctx) => {
    const companyId = getCompanyId(ctx);
    return await ctx.db
      .query("entities")
      .withIndex("by_companyId_deletedAt", (q) =>
        q.eq("companyId", companyId).eq("deletedAt", null)
      )
      .collect();
  },
});

// Get single record
export const get = query({
  args: { id: v.id("entities") },
  handler: async (ctx, args) => {
    const companyId = getCompanyId(ctx);
    return await assertCompanyScoped(ctx, "entities", args.id, companyId);
  },
});

// Create
export const create = mutation({
  args: { /* entity fields */ },
  handler: async (ctx, args) => {
    const companyId = getCompanyId(ctx);
    const now = Date.now();
    return await ctx.db.insert("entities", {
      companyId,
      ...args,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  },
});

// Update
export const update = mutation({
  args: { id: v.id("entities"), /* optional fields */ },
  handler: async (ctx, args) => {
    const companyId = getCompanyId(ctx);
    await assertCompanyScoped(ctx, "entities", args.id, companyId);
    await ctx.db.patch(args.id, {
      ...args,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

// Soft delete
export const remove = mutation({
  args: { id: v.id("entities") },
  handler: async (ctx, args) => {
    const companyId = getCompanyId(ctx);
    await assertCompanyScoped(ctx, "entities", args.id, companyId);
    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return args.id;
  },
});
```

## References
- Convex functions docs: https://docs.convex.dev/functions
- DevSuite architecture: `/dev_suite_conceptual_architecture_business_vs_tech.md`
- Shared types: `projects/01-shared-types/PROJECT.md`
