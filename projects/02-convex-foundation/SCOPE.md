# Scope: Convex Foundation

## In Scope

### Convex Setup

- Convex project initialization
- Self-hosted configuration
- Development environment setup
- convex.json configuration

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

- All queries filter by companyId
- Context provides current company
- "Global view" mode for cross-company access

**Soft Delete**:

- `isDeleted` boolean on all tables
- `deletedAt` timestamp
- Queries exclude deleted by default
- Admin queries can include deleted

**Realtime Patterns**:

- Subscription-friendly query design
- Efficient index usage
- Pagination patterns

### Helper Functions

- `withCompanyScope` - Adds company filter to queries
- `softDelete` - Marks entity as deleted
- `assertNotDeleted` - Validation helper
- `getCurrentCompany` - Context helper

### Type Integration

- Generate Convex types that align with `@devsuite/shared`
- Ensure type safety between schema and application types

## Out of Scope

- Feature-specific business logic (covered by: feature modules)
- UI components (covered by: 03-frontend-foundation, feature modules)
- MCP tool implementation (covered by: 09-mcp-server)
- External API integrations (covered by: integration modules)
- Authentication implementation (deferred - using Convex auth patterns)

## Boundaries

### Schema vs Business Logic

This project defines the data schema and basic CRUD patterns. Complex business rules (e.g., "session can only end after it starts") belong in feature modules.

### Foundation vs Features

This project creates the foundation. Feature modules extend with specific queries, mutations, and actions.

### Convex Types vs Shared Types

Convex generates its own types from schema. We ensure these align with `@devsuite/shared` but they're not the same package.

## Assumptions

- Convex self-hosted is configured separately (infra concern)
- Single-user system initially (no multi-tenant auth complexity)
- Company context comes from client-side selection
- Soft delete is sufficient (no audit log yet)

## Open Questions

- [ ] Convex self-hosted setup specifics? (owner: @infra-devops)
- [ ] Authentication approach (Convex Auth, Clerk, custom)? (owner: @human-review)
- [ ] Index strategy for large datasets? (owner: @convex-developer)
