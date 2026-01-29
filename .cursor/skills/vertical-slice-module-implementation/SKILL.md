---
name: vertical-slice-module-implementation
description: Implement complete DevSuite modules as vertical slices: Convex functions (CRUD/queries), React UI (list/create/edit), and business logic. Use when implementing any module from projects/04-16 (Company, Repository, Project, Task, Session, Inbox, PR Review, Performance, Invoicing) following DevSuite conventions.
---

# Vertical Slice Module Implementation

## Intent
This skill guides implementation of DevSuite modules as complete vertical slices—from backend Convex functions through frontend React UI—ensuring consistency with DevSuite's architectural patterns, company scoping, soft-delete rules, and external reference-only policies.

## Non-Goals
- Defining new module concepts (use `project-management` for that)
- Implementing MCP tools (use `mcp-server-tooling` for that)
- Creating shared types/schemas (use `convex-data-modeling-and-rules` for that)
- Frontend-only or backend-only work (this skill covers full-stack slices)

## Inputs to Read First
- Repo: `projects/_conventions.md` (spec standards)
- Repo: `projects/XX-module-name/PROJECT.md` (module requirements)
- Repo: `/dev_suite_conceptual_architecture_business_vs_tech.md` (domain model)
- Repo: `projects/01-shared-types/PROJECT.md` (type contracts)
- Docs (Context7): "Convex schema definition TypeScript", "Convex query mutation patterns", "TanStack Router file-based routing", "TanStack Query patterns"

## Workflow

### 1) Understand the Module Domain
- Read the module's `PROJECT.md` to understand:
  - What entity/entities it manages
  - Key relationships (company, parent entities, external links)
  - Required CRUD operations
  - UI surface expectations
- Identify invariants from architecture spec:
  - Company scoping (all entities belong to a company)
  - Soft delete (no hard deletes)
  - External references only (GitHub/Notion/TickTick links, not mirrors)

### 2) Design the Data Model (Convex Schema)
- Add schema definitions to `convex/schema.ts`:
  - Use `v.id()` for primary keys
  - Include `companyId: v.id("companies")` for company scoping
  - Add `deletedAt: v.optional(v.number())` for soft delete
  - Use `v.optional()` for nullable fields
  - Reference external systems by ID/URL only (e.g., `githubPRId: v.optional(v.string())`)
- Ensure schema aligns with `packages/shared/src/types.ts` if shared types exist
- Document relationships in schema comments

### 3) Implement Convex Functions (Backend)
Create functions in `convex/modules/XX-module-name/`:

**Queries** (read-only, realtime):
- `list`: Query all non-deleted items for current company
- `get`: Get single item by ID (with company scoping)
- `listByX`: Filtered queries as needed (e.g., `listByProject`)

**Mutations** (write operations):
- `create`: Create new entity with company scoping
- `update`: Update entity (enforce company scoping, prevent deleted updates)
- `delete`: Soft delete (set `deletedAt` timestamp, never hard delete)

**Pattern to follow**:
```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentCompanyId } from "../authz";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const companyId = await getCurrentCompanyId(ctx);
    return await ctx.db
      .query("items")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
  },
});

export const create = mutation({
  args: { name: v.string(), /* other fields */ },
  handler: async (ctx, args) => {
    const companyId = await getCurrentCompanyId(ctx);
    return await ctx.db.insert("items", {
      companyId,
      name: args.name,
      deletedAt: undefined,
      // ... other fields
    });
  },
});
```

### 4) Create Frontend Routes (TanStack Router)
- Add route files in `apps/web/src/routes/`:
  - `XX-module-name/` directory
  - `index.tsx` (list page)
  - `$id.tsx` (detail page)
  - `new.tsx` (create page, optional)
- Use file-based routing conventions from `frontend-app-shell-and-routing` skill
- Ensure routes are company-scoped (read from context/query params)

### 5) Build React Components
Create components in `apps/web/src/modules/XX-module-name/`:

**List Page**:
- Use `useQuery` with Convex query
- Show loading/empty/error states
- Filter/search UI if needed
- Link to detail pages

**Detail Page**:
- Use `useQuery` to fetch single item
- Show all fields
- Edit button (if editable)
- Delete button (soft delete via mutation)

**Forms** (create/edit):
- Use shadcn/ui form components
- Client-side validation
- Submit via Convex mutation
- Navigate on success

**Pattern**:
```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function ItemList() {
  const items = useQuery(api.modules.items.list);

  if (items === undefined) return <Loading />;
  if (items.length === 0) return <EmptyState />;

  return (
    <div>
      {items.map(item => (
        <ItemCard key={item._id} item={item} />
      ))}
    </div>
  );
}
```

### 6) Integrate with App Shell
- Add navigation link in main nav (if module has primary UI)
- Ensure company context is available (via context provider or route params)
- Add to company switcher scope if applicable

### 7) Handle External Links (if applicable)
- If module supports external links (GitHub, Notion, TickTick):
  - Store link metadata (URL, type, external ID)
  - Display links with icons/badges
  - Validate links on create/update (optional, can be async)
  - Never store external content—only references

### 8) Verify Invariants
Before marking complete, verify:
- [ ] All queries filter by company
- [ ] All mutations enforce company scoping
- [ ] No hard deletes exist (only soft delete via `deletedAt`)
- [ ] External systems referenced by ID/URL only
- [ ] UI respects company context
- [ ] Loading/empty/error states handled

## Deliverables Checklist
- [ ] Convex schema updated with module entities
- [ ] Convex queries implemented (list, get, filtered variants)
- [ ] Convex mutations implemented (create, update, soft delete)
- [ ] Frontend routes created (list, detail, create/edit)
- [ ] React components implemented (list, detail, forms)
- [ ] Company scoping enforced in all operations
- [ ] Soft delete implemented (no hard deletes)
- [ ] External links handled correctly (if applicable)
- [ ] Navigation integrated (if primary module)
- [ ] Loading/empty/error states handled in UI

## Module-Specific Notes

### Company Module (04)
- Root entity (no parent)
- Company switcher integration required
- Settings page for company details

### Repository Module (05)
- Belongs to company
- External reference only (GitHub URL/identifier)
- Used as selector in other modules

### Project Module (06)
- Belongs to company
- Many-to-many with repositories
- Project selector component needed

### Task Module (07)
- Hierarchical (parent-child relationships)
- Complex tree operations
- External links (GitHub, Notion, TickTick, URL)
- Status workflow management

### Session Module (08)
- Time-based (start/end timestamps)
- Many-to-many with tasks (junction table)
- Active session timer UI
- Feeds invoicing module

### Inbox Module (11)
- Aggregates multiple sources
- Different item types need different UI
- Read/archive actions
- Company-scoped filtering

### PR Review Module (10)
- Receives review data from MCP
- Stores markdown reports
- Links to repositories and PRs
- History/filtering UI

### Performance Module (13)
- Signal collection from sessions/tasks/reviews
- Dashboard with charts
- No judgement labels
- Date range filtering

### Invoicing Module (14)
- Derivative data (based on sessions)
- Rate card configuration
- CSV export
- Time period grouping

## References
- `projects/_conventions.md` - Spec standards
- `projects/XX-module-name/PROJECT.md` - Module requirements
- `/dev_suite_conceptual_architecture_business_vs_tech.md` - Domain model
- `convex-data-modeling-and-rules` skill - Schema patterns
- `convex-functions-crud-patterns` skill - Function patterns
- `frontend-app-shell-and-routing` skill - Routing patterns
