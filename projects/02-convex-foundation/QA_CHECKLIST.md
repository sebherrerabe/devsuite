# QA Checklist: Convex Foundation

## Metadata

**Project**: 02-convex-foundation  
**Created**: 2026-01-31  
**Last Updated**: 2026-01-31  
**Purpose**: Comprehensive QA validation for Convex foundation invariants, edge cases, and failure modes

---

## Overview

This checklist validates that the Convex foundation properly enforces DevSuite's core data integrity rules:

1. **Soft Delete Invariant** - No hard deletes; all deletions use `deletedAt` timestamps
2. **Company Scoping Invariant** - All data access is company-scoped; cross-company isolation enforced
3. **Authentication Patterns** - Better Auth integration, identity management, authorization
4. **External References Only** - External systems referenced by ID/URL, never mirrored
5. **Pagination & Realtime** - Cursor-based pagination, stable sorting, subscription behavior
6. **Schema Integrity** - Type safety, indexes, constraints

---

## 1. Soft Delete Invariant

### 1.1 Schema Validation

- [ ] **All tables have soft delete fields**
  - [ ] `deletedAt: v.union(v.number(), v.null())` present on all entity tables
  - [ ] No tables allow direct deletion via schema
  - [ ] Indexes include `deletedAt` for common queries (e.g., `by_companyId_deletedAt`)

- [ ] **Soft delete field consistency**
  - [ ] All tables use same field name: `deletedAt` (not `isDeleted`, `deleted`, etc.)
  - [ ] Field type is consistent: nullable timestamp (number | null)
  - [ ] No boolean `isDeleted` fields (timestamps preferred for audit trail)

### 1.2 Code Validation

- [ ] **No hard delete calls exist**
  - [ ] Search codebase for `db.delete(` - should return zero results
  - [ ] Search for `.delete(` in convex functions - should return zero results
  - [ ] No raw SQL DELETE statements (if PostgreSQL access exists)

- [ ] **Soft delete helper exists**
  - [ ] Helper function `softDelete(ctx, table, id)` or similar exists
  - [ ] Sets `deletedAt` to current timestamp
  - [ ] Sets `updatedAt` to current timestamp
  - [ ] Returns success/failure status

- [ ] **Query filtering**
  - [ ] Default queries filter out deleted items: `.filter(q => q.eq(q.field("deletedAt"), null))`
  - [ ] Admin queries have explicit `includeDeleted` parameter
  - [ ] List queries exclude deleted items by default

### 1.3 Functional Test Cases

**Test 1: Basic soft delete**

```typescript
// Setup
const companyId = await createTestCompany();
const projectId = await createTestProject({ companyId });

// Execute
await softDeleteProject(projectId);

// Assert
const project = await db.get(projectId);
expect(project.deletedAt).not.toBeNull();
expect(project.deletedAt).toBeGreaterThan(0);
```

**Test 2: Deleted items excluded from queries**

```typescript
// Setup
const companyId = await createTestCompany();
const project1 = await createTestProject({ companyId, name: 'Active' });
const project2 = await createTestProject({ companyId, name: 'Deleted' });
await softDeleteProject(project2);

// Execute
const projects = await listProjects({ companyId });

// Assert
expect(projects).toHaveLength(1);
expect(projects[0]._id).toBe(project1);
```

**Test 3: Admin can retrieve deleted items**

```typescript
// Setup
const companyId = await createTestCompany();
const projectId = await createTestProject({ companyId });
await softDeleteProject(projectId);

// Execute
const projects = await listProjects({ companyId, includeDeleted: true });

// Assert
expect(projects).toHaveLength(1);
expect(projects[0]._id).toBe(projectId);
expect(projects[0].deletedAt).not.toBeNull();
```

**Test 4: Cascade soft delete behavior**

```typescript
// Setup
const companyId = await createTestCompany();
const projectId = await createTestProject({ companyId });
const taskId = await createTestTask({ projectId });

// Execute
await softDeleteProject(projectId);

// Assert
const tasks = await listTasks({ projectId });
// Should either:
// (a) Return empty array (children hidden when parent deleted), OR
// (b) Soft-delete children automatically
expect(tasks).toHaveLength(0); // OR expect task.deletedAt to be set
```

**Test 5: Attempt to hard delete (should fail)**

```typescript
// This test verifies no hard delete path exists
// If db.delete() is exposed, this should throw or be prevented

// Execute & Assert
expect(() => db.delete('projects', projectId)).toThrow();
// OR verify db.delete is not exposed at all
```

### 1.4 Edge Cases & Failure Modes

- [ ] **Double soft delete**
  - Attempting to soft-delete an already deleted item should be idempotent
  - `deletedAt` should not be updated again (preserve original deletion time)

- [ ] **Querying deleted parent with active children**
  - Verify child queries handle parent soft-delete gracefully
  - Either filter children or return with parent context

- [ ] **Restoring soft-deleted items**
  - If restore functionality exists, verify `deletedAt` is set back to `null`
  - Verify related entities are restored appropriately

- [ ] **Performance with many deleted items**
  - Indexes should efficiently filter `deletedAt = null`
  - Verify query performance doesn't degrade with large deleted item count

---

## 2. Company Scoping Invariant

### 2.1 Schema Validation

- [ ] **All company-scoped tables have `companyId`**
  - [ ] `repositories` has `companyId: v.id("companies")`
  - [ ] `projects` has `companyId: v.id("companies")`
  - [ ] `sessions` has `companyId: v.id("companies")`
  - [ ] `inboxItems` has `companyId: v.id("companies")`
  - [ ] `prReviews` has `companyId: v.id("companies")`
  - [ ] `performanceSignals` has `companyId: v.id("companies")`
  - [ ] `invoices` has `companyId: v.id("companies")`
  - [ ] `rateCards` has `companyId: v.id("companies")`

- [ ] **Tasks are company-scoped via project**
  - [ ] `tasks` table has `projectId: v.id("projects")`
  - [ ] Company is derived: task → project → companyId
  - [ ] No direct `companyId` on tasks (single source of truth)

- [ ] **Company indexes exist**
  - [ ] All company-scoped tables have `by_companyId` index
  - [ ] Composite indexes include `companyId` (e.g., `by_companyId_deletedAt`)

### 2.2 Code Validation

- [ ] **Query filtering enforces company scope**
  - [ ] All list queries accept `companyId` parameter
  - [ ] Queries use `.filter(q => q.eq(q.field("companyId"), companyId))`
  - [ ] No queries omit company filtering (except admin/global queries)

- [ ] **Mutation validation enforces company ownership**
  - [ ] Create mutations set `companyId` from context
  - [ ] Update mutations verify entity belongs to current company
  - [ ] Delete mutations verify entity belongs to current company

- [ ] **Helper functions exist**
  - [ ] `withCompanyScope(query, companyId)` helper exists
  - [ ] `assertCompanyOwnership(ctx, entityId, companyId)` helper exists
  - [ ] Context provides `getCurrentCompany(ctx)` or similar

### 2.3 Functional Test Cases

**Test 1: Entity isolation between companies**

```typescript
// Setup
const companyA = await createTestCompany({ name: 'Company A' });
const companyB = await createTestCompany({ name: 'Company B' });
const projectA = await createTestProject({ companyId: companyA });
const projectB = await createTestProject({ companyId: companyB });

// Execute: Query company A projects
const projectsA = await listProjects({ companyId: companyA });

// Assert: Only company A's project returned
expect(projectsA).toHaveLength(1);
expect(projectsA[0]._id).toBe(projectA);
expect(projectsA[0].companyId).toBe(companyA);
```

**Test 2: Cross-company access attempt (update)**

```typescript
// Setup
const companyA = await createTestCompany({ name: 'Company A' });
const companyB = await createTestCompany({ name: 'Company B' });
const projectA = await createTestProject({ companyId: companyA });

// Execute & Assert: Attempt to update project from wrong company
await expect(
  updateProject({ _id: projectA, companyId: companyB, name: 'Hacked' })
).rejects.toThrow(/not found|unauthorized|invalid company/i);
```

**Test 3: Cross-company access attempt (delete)**

```typescript
// Setup
const companyA = await createTestCompany({ name: 'Company A' });
const companyB = await createTestCompany({ name: 'Company B' });
const projectA = await createTestProject({ companyId: companyA });

// Execute & Assert: Attempt to delete project from wrong company
await expect(
  softDeleteProject({ _id: projectA, companyId: companyB })
).rejects.toThrow(/not found|unauthorized|invalid company/i);
```

**Test 4: Query by ID with wrong company (get by ID)**

```typescript
// Setup
const companyA = await createTestCompany({ name: 'Company A' });
const companyB = await createTestCompany({ name: 'Company B' });
const projectA = await createTestProject({ companyId: companyA });

// Execute
const result = await getProject({ _id: projectA, companyId: companyB });

// Assert: Should return null or throw
expect(result).toBeNull();
// OR expect(() => getProject(...)).rejects.toThrow();
```

**Test 5: Company switcher updates data**

```typescript
// Setup: Create projects in two companies
const companyA = await createTestCompany({ name: 'Company A' });
const companyB = await createTestCompany({ name: 'Company B' });
await createTestProject({ companyId: companyA, name: 'Project A' });
await createTestProject({ companyId: companyB, name: 'Project B' });

// Execute: Query company A
const projectsA = await listProjects({ companyId: companyA });
expect(projectsA).toHaveLength(1);
expect(projectsA[0].name).toBe('Project A');

// Execute: Switch to company B
const projectsB = await listProjects({ companyId: companyB });
expect(projectsB).toHaveLength(1);
expect(projectsB[0].name).toBe('Project B');
```

### 2.4 Edge Cases & Failure Modes

- [ ] **Derived company scoping (tasks via projects)**
  - Verify task queries correctly resolve companyId through project relationship
  - Test: Create task in project A, query with company B context → should return empty

- [ ] **Junction table scoping (sessionTasks)**
  - Verify session-task junction respects company boundaries
  - Test: Cannot link session from company A to task in company B

- [ ] **Company soft delete cascade**
  - If company is soft-deleted, verify:
    - Company-scoped entities are still accessible (for data export)
    - Company doesn't appear in switcher
    - New entities cannot be created under deleted company

- [ ] **Global view mode (if implemented)**
  - Verify explicit "global" parameter bypasses company filtering
  - Verify global view is protected/admin-only
  - Test: Global query returns entities from all companies

- [ ] **Performance with many companies**
  - Verify company indexes are used efficiently
  - Large number of companies should not degrade query performance

---

## 3. Authentication & Authorization

### 3.1 Better Auth Integration

- [ ] **Better Auth configured**
  - [ ] `convex/auth.config.ts` exists and exports valid config
  - [ ] `convex/auth.ts` exists with auth helpers
  - [ ] Better Auth adapter configured in `convex/betterAuth/adapter.ts`
  - [ ] Schema includes Better Auth tables (from `convex/betterAuth/schema.ts`)

- [ ] **HTTP endpoints mounted**
  - [ ] `convex/http.ts` mounts Better Auth handlers
  - [ ] Auth endpoints respond (e.g., `/api/auth/signin`, `/api/auth/session`)

- [ ] **Session management**
  - [ ] Better Auth session table exists
  - [ ] Sessions properly scoped to users
  - [ ] Session expiration handled

### 3.2 Identity & Context

- [ ] **Identity query works**
  - [ ] Helper function to get current user identity from context
  - [ ] Unauthenticated requests return null/undefined identity
  - [ ] Authenticated requests return valid user object

- [ ] **Company context propagation**
  - [ ] Current company ID available in context
  - [ ] Company context can be switched by user
  - [ ] Company context persists across requests (session storage)

### 3.3 Authorization Patterns

- [ ] **Unauthenticated access behavior**
  - [ ] Define which queries/mutations require authentication
  - [ ] Unauthenticated queries return empty results or throw explicit error
  - [ ] No sensitive data exposed to unauthenticated users

- [ ] **Company ownership validation**
  - [ ] Users can only access companies they belong to
  - [ ] Attempting to switch to non-owned company is blocked

### 3.4 Test Cases

**Test 1: Authenticated user can query their data**

```typescript
// Setup: Create user and authenticate
const { userId, token } = await authenticateTestUser();
const companyId = await createTestCompany({ ownerId: userId });

// Execute: Query as authenticated user
const companies = await listCompanies({ userId }, { token });

// Assert
expect(companies).toContainEqual(expect.objectContaining({ _id: companyId }));
```

**Test 2: Unauthenticated user cannot access data**

```typescript
// Execute: Query without authentication
await expect(listCompanies({}, { token: null })).rejects.toThrow(
  /unauthorized|unauthenticated/i
);
```

**Test 3: Better Auth session creation**

```typescript
// Execute: Sign in via Better Auth
const response = await fetch('/api/auth/signin', {
  method: 'POST',
  body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
});

// Assert: Session created
expect(response.ok).toBe(true);
const session = await response.json();
expect(session).toHaveProperty('token');
```

---

## 4. External References Only Invariant

### 4.1 Schema Validation

- [ ] **No content mirroring fields**
  - [ ] `repositories` table has `url: v.string()` but no `files`, `commits`, `branches` fields
  - [ ] `tasks` table has `externalLinks` array with `{ type, identifier, url }` structure
  - [ ] `inboxItems` table stores `externalId` but not full external content
  - [ ] `prReviews` table stores `prIdentifier` and `prUrl` but not full PR diff

- [ ] **External link structure**
  - [ ] External links include: `type`, `identifier`, `url`
  - [ ] No embedded content fields (e.g., no `githubPrTitle`, `githubPrBody`)
  - [ ] Optional: `prTitle` allowed for display (but not full content)

### 4.2 Code Validation

- [ ] **No content synchronization**
  - [ ] No code that fetches and stores full external content
  - [ ] No periodic sync jobs that mirror external data
  - [ ] Links are validated but content is not copied

- [ ] **Graceful degradation**
  - [ ] System works if external system unavailable
  - [ ] Broken links don't break core functionality
  - [ ] External data fetched on-demand (not stored)

### 4.3 Test Cases

**Test 1: Task linked to GitHub PR stores only reference**

```typescript
// Setup
const projectId = await createTestProject({ companyId });
const taskId = await createTestTask({ projectId });

// Execute: Link task to GitHub PR
await addExternalLink({
  taskId,
  link: {
    type: 'github_pr',
    identifier: 'owner/repo#123',
    url: 'https://github.com/owner/repo/pull/123',
  },
});

// Assert: Only reference stored, not PR content
const task = await getTask({ _id: taskId });
expect(task.externalLinks).toHaveLength(1);
expect(task.externalLinks[0]).toMatchObject({
  type: 'github_pr',
  identifier: 'owner/repo#123',
  url: expect.stringContaining('github.com'),
});
// Verify no content fields
expect(task).not.toHaveProperty('prContent');
expect(task).not.toHaveProperty('prDiff');
```

**Test 2: Remove external link leaves no orphaned data**

```typescript
// Setup
const taskId = await createTestTask({ projectId });
await addExternalLink({
  taskId,
  link: { type: 'github_pr', identifier: 'pr#1', url: '...' },
});

// Execute: Remove link
await removeExternalLink({ taskId, linkUrl: '...' });

// Assert: Link removed, no orphaned data
const task = await getTask({ _id: taskId });
expect(task.externalLinks).toHaveLength(0);
```

**Test 3: System functions when external system unavailable**

```typescript
// Setup: Task with broken GitHub link
const taskId = await createTestTask({
  projectId,
  externalLinks: [
    { type: 'github_pr', identifier: 'invalid', url: 'https://github.com/404' },
  ],
});

// Execute: Normal operations should still work
const task = await getTask({ _id: taskId });
await updateTask({ _id: taskId, title: 'Updated title' });

// Assert: No errors, system still functional
expect(task).toBeDefined();
```

### 4.4 Edge Cases

- [ ] **Valid link validation**
  - Test: Adding invalid URL format is rejected
  - Test: Duplicate links are handled (prevent or deduplicate)

- [ ] **External system rate limits**
  - Verify system doesn't make excessive external API calls
  - Links are display-only unless explicitly clicked

- [ ] **Link metadata caching**
  - If metadata (e.g., PR title) is cached for display, verify it's read-only
  - Cached metadata should have TTL or manual refresh

---

## 5. Pagination & Realtime Patterns

### 5.1 Pagination Implementation

- [ ] **Cursor-based pagination exists**
  - [ ] List queries support `cursor` parameter
  - [ ] List queries support `limit` parameter (default: 50-100)
  - [ ] Queries return `{ items, nextCursor, hasMore }`

- [ ] **Stable sorting**
  - [ ] Queries use indexed fields for sorting (e.g., `createdAt`, `updatedAt`)
  - [ ] Sorting is consistent across pagination calls
  - [ ] No random ordering that breaks cursor pagination

- [ ] **Index usage**
  - [ ] Paginated queries use appropriate indexes
  - [ ] Verify with Convex query profiling (if available)

### 5.2 Realtime Subscription Patterns

- [ ] **Subscription-friendly queries**
  - [ ] Queries are designed for efficient reactivity
  - [ ] No expensive joins or aggregations in realtime queries
  - [ ] Filters applied at query level (not post-processing)

- [ ] **Subscription behavior**
  - [ ] UI subscribes to Convex queries via `useQuery`
  - [ ] Updates propagate automatically when data changes
  - [ ] No manual polling or refresh needed

### 5.3 Test Cases

**Test 1: Basic pagination**

```typescript
// Setup: Create 150 projects
const companyId = await createTestCompany();
for (let i = 0; i < 150; i++) {
  await createTestProject({ companyId, name: `Project ${i}` });
}

// Execute: Paginate through projects
const page1 = await listProjects({ companyId, limit: 50 });
expect(page1.items).toHaveLength(50);
expect(page1.hasMore).toBe(true);

const page2 = await listProjects({
  companyId,
  limit: 50,
  cursor: page1.nextCursor,
});
expect(page2.items).toHaveLength(50);
expect(page2.hasMore).toBe(true);

const page3 = await listProjects({
  companyId,
  limit: 50,
  cursor: page2.nextCursor,
});
expect(page3.items).toHaveLength(50);
expect(page3.hasMore).toBe(false);
```

**Test 2: Cursor stability across updates**

```typescript
// Setup: Create projects and get first page
const companyId = await createTestCompany();
for (let i = 0; i < 100; i++) {
  await createTestProject({ companyId, name: `Project ${i}` });
}
const page1 = await listProjects({ companyId, limit: 50 });

// Execute: Update a project, then fetch page 2
await updateProject({ _id: page1.items[0]._id, name: 'Updated' });
const page2 = await listProjects({
  companyId,
  limit: 50,
  cursor: page1.nextCursor,
});

// Assert: Pagination cursor still valid
expect(page2.items).toHaveLength(50);
expect(page2.items[0]._id).not.toBe(page1.items[0]._id); // No duplicates
```

**Test 3: Realtime subscription updates**

```typescript
// Setup: Subscribe to projects list
const companyId = await createTestCompany();
const subscription = subscribeToProjects({ companyId });
const updates = [];
subscription.on('update', data => updates.push(data));

// Execute: Create new project
await wait(100); // Let subscription settle
await createTestProject({ companyId, name: 'New project' });
await wait(500); // Wait for realtime update

// Assert: Subscription received update
expect(updates.length).toBeGreaterThan(0);
expect(updates[updates.length - 1]).toContainEqual(
  expect.objectContaining({ name: 'New project' })
);
```

### 5.4 Edge Cases

- [ ] **Empty result pagination**
  - Test: Paginating when no results returns empty array, no cursor

- [ ] **Pagination with filters**
  - Test: Cursor works correctly when combined with filters (e.g., status filter)

- [ ] **Concurrent updates during pagination**
  - Test: Items created/deleted during pagination don't break cursor

---

## 6. Schema & Data Integrity

### 6.1 Type Safety

- [ ] **Convex types align with shared types**
  - [ ] Entity field names match `@devsuite/shared` types
  - [ ] Enum values match across packages
  - [ ] ID types compatible (can pass Convex IDs to shared utilities)

- [ ] **No type casting at boundaries**
  - [ ] Frontend can consume Convex types directly
  - [ ] Shared utilities accept Convex types without casting

### 6.2 Constraints & Validation

- [ ] **Required fields enforced**
  - [ ] Schema marks required fields (no `v.optional()` on mandatory fields)
  - [ ] Mutations validate required fields before insert

- [ ] **Unique constraints (if applicable)**
  - [ ] Repository URL uniqueness enforced (if required)
  - [ ] Company name uniqueness (if required)

- [ ] **Foreign key relationships**
  - [ ] All `v.id("tableName")` references point to valid tables
  - [ ] Relationships are enforced (cannot reference non-existent entity)

### 6.3 Test Cases

**Test 1: Type safety between Convex and shared**

```typescript
import type { Project } from '@devsuite/shared';
import type { Doc } from 'convex/_generated/dataModel';

// Assert: Types are compatible
const convexProject: Doc<'projects'> = await getProject({ _id: 'xyz' });
const sharedProject: Project = convexProject; // Should not require casting

expect(sharedProject.name).toBe(convexProject.name);
```

**Test 2: Required field validation**

```typescript
// Execute & Assert: Missing required field
await expect(
  createProject({ companyId: 'xyz', description: 'Missing name' })
).rejects.toThrow(/name.*required/i);
```

**Test 3: Foreign key validation**

```typescript
// Execute & Assert: Invalid companyId reference
await expect(
  createProject({ companyId: 'invalid_id_not_exists', name: 'Project' })
).rejects.toThrow(/company.*not found|invalid.*company/i);
```

### 6.4 Edge Cases

- [ ] **Orphaned records (many-to-many junctions)**
  - Verify sessionTasks junction cleans up if session or task is soft-deleted
  - Or: Verify queries filter out junction rows pointing to deleted entities

- [ ] **Index consistency**
  - Verify indexes are created successfully on deployment
  - Test query performance with and without indexes

- [ ] **Schema migrations**
  - If schema changes, verify migration path doesn't break existing data
  - Verify additive changes (new optional fields) are safe

---

## 7. Manual Test Workflow

### 7.1 Environment Setup

1. **Start Convex dev server**

   ```bash
   cd /home/sebherrerabe/repos/devsuite
   pnpm install
   npx convex dev
   ```

2. **Verify dev server**
   - Server starts without errors
   - Dashboard accessible at https://dashboard.convex.dev
   - Schema deployed successfully

### 7.2 Smoke Test Checklist

- [ ] **Schema validation**
  - Open Convex dashboard → Data → Verify all tables exist
  - Verify indexes are created for all tables

- [ ] **Create company**

  ```javascript
  // In Convex dashboard console
  const companyId = await mutation('companies.create', { name: 'Test Co' });
  console.log({ companyId });
  ```

  - Verify `createdAt`, `updatedAt` timestamps set
  - Verify `deletedAt` is `null`

- [ ] **Create company-scoped entities**

  ```javascript
  const projectId = await mutation('projects.create', {
    companyId: companyId,
    name: 'Test Project',
  });
  ```

  - Verify entity created with correct `companyId`

- [ ] **Query with company scope**

  ```javascript
  const projects = await query('projects.list', { companyId: companyId });
  console.log({ projects });
  ```

  - Verify only company's entities returned

- [ ] **Soft delete**

  ```javascript
  await mutation('projects.softDelete', { _id: projectId });
  const allProjects = await query('projects.list', { companyId: companyId });
  console.log({ allProjects }); // Should be empty
  ```

  - Verify entity no longer in default queries
  - Verify `deletedAt` timestamp set (check in dashboard)

- [ ] **Query deleted (admin)**

  ```javascript
  const deletedProjects = await query('projects.list', {
    companyId: companyId,
    includeDeleted: true,
  });
  console.log({ deletedProjects }); // Should include soft-deleted
  ```

### 7.3 Cross-Company Isolation Test

- [ ] **Create two companies**

  ```javascript
  const companyA = await mutation('companies.create', { name: 'Company A' });
  const companyB = await mutation('companies.create', { name: 'Company B' });
  ```

- [ ] **Create entities in each**

  ```javascript
  const projectA = await mutation('projects.create', {
    companyId: companyA,
    name: 'Project A',
  });
  const projectB = await mutation('projects.create', {
    companyId: companyB,
    name: 'Project B',
  });
  ```

- [ ] **Query company A - should not see company B's data**

  ```javascript
  const projectsA = await query('projects.list', { companyId: companyA });
  // Should only contain projectA
  ```

- [ ] **Attempt cross-company update (should fail)**

  ```javascript
  // Try to update company A's project while in company B context
  await mutation('projects.update', {
    _id: projectA,
    companyId: companyB,
    name: 'Hacked',
  });
  // Should throw or fail validation
  ```

### 7.4 Realtime Subscription Test

- [ ] **Open Convex dashboard → Functions → Watch a query**
- [ ] **Execute mutation to create entity**
- [ ] **Verify query result updates in realtime**

---

## 8. Failure Modes & Defensive Checks

### 8.1 Soft Delete Violations

| **Failure Mode**                       | **Detection Method**                     | **Mitigation**                                   |
| -------------------------------------- | ---------------------------------------- | ------------------------------------------------ |
| Hard delete call exists in code        | Code search for `db.delete(`             | Remove and replace with soft delete              |
| Queries return deleted items           | Test: Create+delete, verify not in list  | Add `deletedAt = null` filter to all queries     |
| Admin query doesn't respect flag       | Test: Query with `includeDeleted: false` | Fix filter logic in admin queries                |
| Cascade delete doesn't propagate       | Test: Delete parent, query children      | Implement cascade soft delete or filter children |
| Double soft delete changes `deletedAt` | Test: Soft delete twice, check timestamp | Make soft delete idempotent                      |

### 8.2 Company Scoping Violations

| **Failure Mode**                     | **Detection Method**                               | **Mitigation**                                   |
| ------------------------------------ | -------------------------------------------------- | ------------------------------------------------ |
| Query returns cross-company data     | Test: Create in A, query in B, verify empty        | Add `companyId` filter to all queries            |
| Mutation allows cross-company update | Test: Update entity from wrong company, expect 404 | Validate `companyId` ownership in mutations      |
| Derived company scope broken (tasks) | Test: Query task with wrong company via project    | Ensure project → company resolution is correct   |
| Junction table leaks data            | Test: Link session A to task B (different company) | Validate company consistency on junction inserts |
| Missing `companyId` index            | Query profiling shows full table scan              | Add index: `by_companyId`                        |
| Global query not protected           | Test: Call global query without admin auth         | Add authorization check to global queries        |

### 8.3 Authentication Violations

| **Failure Mode**                        | **Detection Method**                         | **Mitigation**                             |
| --------------------------------------- | -------------------------------------------- | ------------------------------------------ |
| Unauthenticated access allowed          | Test: Call mutation without token            | Add auth check: `ctx.auth.getUserIdentity` |
| Session not created on login            | Test: Login, verify session in database      | Debug Better Auth integration              |
| Identity query returns null when authed | Test: Authenticated call, check identity     | Fix context setup in Convex functions      |
| Company context not propagated          | Test: Switch company, verify context updates | Fix context provider or parameter passing  |

### 8.4 External Reference Violations

| **Failure Mode**                  | **Detection Method**                         | **Mitigation**                               |
| --------------------------------- | -------------------------------------------- | -------------------------------------------- |
| Full external content stored      | Schema audit: Check for content fields       | Remove content fields, keep only identifiers |
| Sync job mirrors external data    | Code search for sync/fetch/store patterns    | Remove sync, fetch on-demand only            |
| Broken link breaks core function  | Test: Invalid link, verify operations work   | Add error handling for external calls        |
| Link removal leaves orphaned data | Test: Remove link, check for leftover fields | Ensure clean removal                         |

### 8.5 Pagination & Realtime Issues

| **Failure Mode**                  | **Detection Method**                        | **Mitigation**                                |
| --------------------------------- | ------------------------------------------- | --------------------------------------------- |
| Cursor becomes invalid            | Test: Paginate, update entity, continue     | Use stable sorting (e.g., createdAt)          |
| Duplicate items across pages      | Test: Paginate twice, check for duplicates  | Fix sorting + cursor logic                    |
| Subscription doesn't update       | Test: Mutate entity, wait, check subscriber | Verify Convex query is reactive               |
| Expensive query blocks reactivity | Monitor query latency in dashboard          | Optimize query, add indexes                   |
| Empty pagination returns error    | Test: Paginate on empty table               | Handle edge case: return `{ items: [], ... }` |

---

## 9. Validation Report Template

Use this template after completing the checklist to report results:

```markdown
# QA Validation Report: Convex Foundation

**Date**: YYYY-MM-DD  
**Validated By**: [Name/AI identifier]  
**Convex Version**: [version]  
**Commit SHA**: [git sha]

---

## Core Invariants

### Soft Delete: ✅ PASS / ❌ FAIL

- Issues found: [list issues or "none"]
- Notes: [additional context]

### Company Scoping: ✅ PASS / ❌ FAIL

- Issues found: [list issues or "none"]
- Notes: [additional context]

### Authentication: ✅ PASS / ❌ FAIL

- Issues found: [list issues or "none"]
- Notes: [additional context]

### External References Only: ✅ PASS / ❌ FAIL

- Issues found: [list issues or "none"]
- Notes: [additional context]

### Pagination & Realtime: ✅ PASS / ❌ FAIL

- Issues found: [list issues or "none"]
- Notes: [additional context]

### Schema Integrity: ✅ PASS / ❌ FAIL

- Issues found: [list issues or "none"]
- Notes: [additional context]

---

## Critical Issues

1. **[Issue Title]** - Severity: 🔴 HIGH / 🟡 MEDIUM / 🟢 LOW
   - Description: [what's broken]
   - Impact: [consequences]
   - Reproduction: [steps to reproduce]
   - Recommendation: [fix suggestion]

---

## Recommendations

- [Recommendation 1]
- [Recommendation 2]
- [Recommendation 3]

---

## Sign-Off

- [ ] All critical issues resolved
- [ ] All high-severity issues resolved or documented as acceptable risk
- [ ] Convex foundation ready for feature module development

**QA Approval**: ******\_\_\_\_******  
**Date**: YYYY-MM-DD
```

---

## 10. References

- **Project Spec**: `projects/02-convex-foundation/PROJECT.md`
- **Scope**: `projects/02-convex-foundation/SCOPE.md`
- **Tasks**: `projects/02-convex-foundation/TASKS.md`
- **Schema**: `convex/schema.ts`
- **Architecture**: `/dev_suite_conceptual_architecture_business_vs_tech.md`
- **QA Skill**: `.cursor/skills/qa-validation-checklists/SKILL.md`

---

## 11. Changelog

| Date       | Change Description           | Updated By |
| ---------- | ---------------------------- | ---------- |
| 2026-01-31 | Initial QA checklist created | QA Agent   |

---

**End of QA Checklist**
