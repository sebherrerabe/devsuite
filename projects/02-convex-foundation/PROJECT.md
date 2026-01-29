---
id: "02-convex-foundation"
title: "Convex Foundation"
status: "pending"
priority: 3
assigned_pm: null
depends_on: ["00-scaffolding", "01-shared-types"]
unlocks: ["04-company-module", "05-repository-module", "06-project-module", "07-task-module", "08-session-module", "09-mcp-server"]
estimated_complexity: "high"
---

# Convex Foundation

## Summary
Set up Convex as the backend platform for DevSuite. This includes schema definitions for all core entities, base query/mutation patterns, company scoping enforcement, soft delete implementation, and realtime subscription patterns. This is the data layer foundation that all feature modules build upon.

## Objective
Establish a production-ready Convex backend with enforced data integrity rules and patterns that feature modules can extend.

## Key Deliverables
- Convex project initialization (self-hosted configuration)
- Schema definitions for all core entities
- Base CRUD patterns with company scoping
- Soft delete implementation
- Realtime subscription patterns
- Authentication/authorization patterns
- Helper functions for common operations

## Success Criteria
- [ ] Convex dev server runs locally
- [ ] All entity schemas defined and validated
- [ ] Company scoping enforced on all queries/mutations
- [ ] Soft delete works (no hard deletes possible)
- [ ] Realtime subscriptions work for all entities
- [ ] Type safety between Convex and shared types

## Architecture Reference

From `/dev_suite_conceptual_architecture_business_vs_tech.md`:

**Backend Stack**:
- Convex (self-hosted)
- PostgreSQL (via Convex)

**Responsibilities**:
- Data storage
- Realtime subscriptions
- Business rule enforcement
- Company scoping & privacy

**Data Integrity Rules**:
- No hard deletes
- All work attributable to a company
- External systems referenced, never mirrored
- Human override always exists

## Quick Links
- [Scope](./SCOPE.md)
- [Dependencies](./DEPENDENCIES.md)
- [Tasks](./TASKS.md)
- [Status](./STATUS.md)
