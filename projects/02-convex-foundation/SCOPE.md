# Scope: Convex Foundation

## In Scope

### Convex Setup

- Convex project initialization
- Convex Cloud setup (Free-first)
- Development environment setup
- convex.json configuration
- Portability notes (do not assume self-hosted as the default)

### Authentication (Backend)

- Better Auth on Convex (server-side integration)
- Minimal auth endpoints wiring via Convex HTTP routes
- Identity access pattern: `ctx.auth.getUserIdentity()`

### Schema Definitions

All entity tables with proper indexes:

- `companies` - Company entities
- `repositories` - Repository entities
- `projects` - Project entities
- `tasks` - Task entities (with parent reference for hierarchy)
- `sessions` - Session entities
- `sessionTasks` - Session-Task junction
- `inboxItems` - Inbox/notification items
- `prReviews` - PR review artifacts
- `performanceSignals` - Performance metrics
- `invoices` - Invoice records
- `rateCards` - Billing rate configurations

### Base Patterns

**Company Scoping**:

- All queries filter by `companyId` (explicit function argument)
- Mutations validate ownership (IDs passed in must belong to the provided `companyId`)
- Do not assume auth provides “current company” (company context is explicit and validated)
- Optional future: “global view” for cross-company admin tooling (not required for initial modules)

**Soft Delete**:

- `deletedAt` is the source of truth (align with `@devsuite/shared` `SoftDeletable`)
  - Active record: `deletedAt` is unset/empty (Convex schema uses `null` for “not deleted”)
  - Deleted record: `deletedAt` is a timestamp
- Queries exclude deleted by default (filter `deletedAt === null`)
- Never hard delete (`db.delete` is not used in app logic)

**Realtime Patterns**:

- Subscription-friendly query design
- Efficient index usage
- Pagination patterns

### Helper Functions

- `requireCompanyId` - Enforces `companyId` is explicitly provided
- `assertCompanyMatch` - Ensures a record belongs to the company
- `assertNotDeleted` / `isDeleted` - Soft delete safety helpers
- `createSoftDeletePatch` / `createRestorePatch` - Consistent patch shapes
- `assertFound` / `assertCompanyScoped` - Convenience assertion helpers

### Type Integration

- Generate Convex types that align with `@devsuite/shared`
- Ensure type safety between schema and application types

## Out of Scope

- Feature-specific business logic (covered by: feature modules)
- UI components (covered by: 03-frontend-foundation, feature modules)
- MCP tool implementation (covered by: 09-mcp-server)
- External API integrations (covered by: integration modules)
- Frontend login/registration UI (deferred to: 03-frontend-foundation or a dedicated auth UX project)

## Boundaries

### Schema vs Business Logic

This project defines the data schema and basic CRUD patterns. Complex business rules (e.g., "session can only end after it starts") belong in feature modules.

### Foundation vs Features

This project creates the foundation. Feature modules extend with specific queries, mutations, and actions.

### Convex Types vs Shared Types

Convex generates its own types from schema. We ensure these align with `@devsuite/shared` but they're not the same package.

## Assumptions

- Convex Cloud Free tier is the default baseline for development and early production
- Single-user system initially (no complex org membership model yet)
- Company context comes from client-side selection
- Soft delete is sufficient (no audit log yet)

## Open Questions

- [ ] How are users associated to companies (membership model)? (owner: @backend-engineer)
- [ ] Index strategy for large datasets? (owner: @convex-developer)
