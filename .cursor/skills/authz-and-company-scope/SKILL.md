---
name: authz-and-company-scope
description: Implement authorization patterns and company scoping enforcement for Convex functions. Use when adding auth checks, implementing company context switching, or enforcing privacy boundaries.
---

# Authorization and Company Scoping (DevSuite)

## Intent
This skill is responsible for implementing DevSuite's authorization model:
- **Company scoping**: All queries/mutations filter by company context
- **Privacy mode**: Support "private global mode" vs "company-scoped mode"
- **Auth token parsing**: Extract company context from authentication
- **Access control**: Enforce that users can only access their own company's data

## Non-Goals
- Full authentication implementation (login flows, token generation)
- User management (user creation, roles, permissions)
- Frontend auth UI (use `frontend-convex-integration`)

## Inputs to Read First
- Repo: `projects/02-convex-foundation/PROJECT.md`
- Repo: `/dev_suite_conceptual_architecture_business_vs_tech.md` (sections 2.1, 2.12, 3.7)
- Repo: `projects/_conventions.md` (privacy and scoping rules)
- Convex docs: Authentication patterns, HTTP actions, token validation

## Workflow

### 1) Define authentication context structure

Create `convex/lib/auth.ts`:

```typescript
import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export interface AuthContext {
  userId: string; // User identifier from token
  companyId: Id<"companies"> | null; // null = private global mode
  isPrivateMode: boolean; // true if companyId is null
}

/**
 * Extract auth context from Convex request.
 *
 * For now, this is a placeholder. In production:
 * - Parse JWT token from request headers
 * - Extract userId and companyId from token claims
 * - Support "private mode" when companyId is null
 */
export function getAuthContext(
  ctx: QueryCtx | MutationCtx | ActionCtx
): AuthContext {
  // TODO: Implement actual token parsing
  // Placeholder: return first company for development
  throw new Error("Auth not implemented - use placeholder for development");
}

/**
 * Get company ID with fallback to private mode.
 *
 * Returns companyId if in company-scoped mode, or null for private global mode.
 */
export function getCompanyIdOrNull(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Id<"companies"> | null {
  const auth = getAuthContext(ctx);
  return auth.companyId;
}

/**
 * Require company context (throws if in private mode).
 *
 * Use this when an operation MUST be company-scoped.
 */
export function requireCompanyId(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Id<"companies"> {
  const companyId = getCompanyIdOrNull(ctx);
  if (companyId === null) {
    throw new Error("Operation requires company context");
  }
  return companyId;
}

/**
 * Get company context, allowing private mode.
 *
 * Returns companyId if available, or null for private global operations.
 */
export function getCompanyContext(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Id<"companies"> | null {
  return getCompanyIdOrNull(ctx);
}
```

### 2) Implement HTTP action for token validation

Create `convex/auth.ts`:

```typescript
import { httpAction } from "./_generated/server";
import { httpRouter } from "convex/server";
import { getAuthContext } from "./lib/auth";

const http = httpRouter();

/**
 * Validate auth token and return user context.
 *
 * Called by frontend to verify token and get current company context.
 */
http.route({
  path: "/auth/validate",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // Extract token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 401,
      });
    }

    const token = authHeader.substring(7);
    // TODO: Validate JWT token and extract claims
    // For now, return placeholder

    const auth = getAuthContext(ctx);
    return new Response(JSON.stringify(auth), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
```

### 3) Enforce company scoping in queries

**Pattern: Company-scoped query (default)**

```typescript
import { query } from "./_generated/server";
import { getCompanyIdOrNull } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const companyId = getCompanyIdOrNull(ctx);

    if (companyId === null) {
      // Private global mode: return empty or all companies' data
      // For now, return empty to enforce company scoping
      return [];
    }

    return await ctx.db
      .query("repositories")
      .withIndex("by_companyId_deletedAt", (q) =>
        q.eq("companyId", companyId).eq("deletedAt", null)
      )
      .collect();
  },
});
```

**Pattern: Private global mode query (explicit)**

```typescript
import { query } from "./_generated/server";
import { getCompanyIdOrNull } from "./lib/auth";

/**
 * List all repositories across all companies (private global mode only).
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const companyId = getCompanyIdOrNull(ctx);

    // Allow this query in private mode
    if (companyId === null) {
      return await ctx.db
        .query("repositories")
        .withIndex("by_deletedAt", (q) => q.eq("deletedAt", null))
        .collect();
    }

    // In company mode, still filter by company
    return await ctx.db
      .query("repositories")
      .withIndex("by_companyId_deletedAt", (q) =>
        q.eq("companyId", companyId).eq("deletedAt", null)
      )
      .collect();
  },
});
```

### 4) Enforce company scoping in mutations

**Pattern: Require company context**

```typescript
import { mutation } from "./_generated/server";
import { requireCompanyId } from "./lib/auth";

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    // Require company context (throws if in private mode)
    const companyId = requireCompanyId(ctx);

    return await ctx.db.insert("repositories", {
      companyId,
      name: args.name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
    });
  },
});
```

**Pattern: Assert company ownership**

```typescript
import { mutation } from "./_generated/server";
import { requireCompanyId } from "./lib/auth";

export const update = mutation({
  args: { id: v.id("repositories"), name: v.string() },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(ctx);

    const repo = await ctx.db.get(args.id);
    if (!repo) {
      throw new Error("Repository not found");
    }

    // Assert company ownership
    if (repo.companyId !== companyId) {
      throw new Error("Repository does not belong to company");
    }

    if (repo.deletedAt !== null) {
      throw new Error("Repository is deleted");
    }

    await ctx.db.patch(args.id, {
      name: args.name,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});
```

### 5) Support company context switching

Create `convex/companies.ts`:

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthContext, requireCompanyId } from "./lib/auth";

/**
 * Switch to company-scoped mode.
 *
 * This is a placeholder for future implementation.
 * In production, this would update the user's session/token.
 */
export const switchToCompany = mutation({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const auth = getAuthContext(ctx);

    // Verify user has access to this company
    // TODO: Check user-company relationship table

    // In production, update session/token
    // For now, this is a no-op (companyId comes from token)

    return { companyId: args.companyId };
  },
});

/**
 * Switch to private global mode.
 */
export const switchToPrivateMode = mutation({
  args: {},
  handler: async (ctx) => {
    // In production, update session/token to remove companyId
    return { companyId: null };
  },
});
```

### 6) Privacy mode rules

Document and enforce these rules:

**Company-scoped mode** (default):
- All queries filter by `companyId`
- All mutations require `companyId`
- Data is isolated by company
- Suitable for "office-safe" usage

**Private global mode**:
- Queries can access all companies' data
- Mutations still require explicit `companyId` (cannot create orphaned records)
- Suitable for personal analytics and cross-company insights
- User must explicitly switch to this mode

**Enforcement**:
- Default to company-scoped mode
- Require explicit opt-in for private global mode
- Log mode switches for audit trail

## Deliverables Checklist
- [ ] `convex/lib/auth.ts` exists with `getAuthContext`, `requireCompanyId`, `getCompanyIdOrNull`
- [ ] All queries filter by company context (or explicitly support private mode)
- [ ] All mutations require company context and assert ownership
- [ ] HTTP action exists for token validation (`/auth/validate`)
- [ ] Company context switching functions exist (placeholders acceptable)
- [ ] Error messages clearly indicate authorization failures
- [ ] Private global mode is explicitly opt-in, not default

## Authorization Helper Skeleton

```typescript
// convex/lib/auth.ts
import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export interface AuthContext {
  userId: string;
  companyId: Id<"companies"> | null;
  isPrivateMode: boolean;
}

export function getAuthContext(ctx: QueryCtx | MutationCtx | ActionCtx): AuthContext {
  // TODO: Parse JWT token from request
  throw new Error("Auth not implemented");
}

export function requireCompanyId(ctx: QueryCtx | MutationCtx | ActionCtx): Id<"companies"> {
  const companyId = getCompanyIdOrNull(ctx);
  if (companyId === null) {
    throw new Error("Operation requires company context");
  }
  return companyId;
}

export function getCompanyIdOrNull(ctx: QueryCtx | MutationCtx | ActionCtx): Id<"companies"> | null {
  return getAuthContext(ctx).companyId;
}
```

## References
- Convex auth docs: https://docs.convex.dev/auth
- Convex HTTP actions: https://docs.convex.dev/functions/http-actions
- DevSuite architecture: `/dev_suite_conceptual_architecture_business_vs_tech.md`
- Privacy rules: `projects/_conventions.md`
