---
id: '01-shared-types'
title: 'Shared Types & Schemas'
status: 'pending'
priority: 2
assigned_pm: null
depends_on: ['00-scaffolding']
unlocks: ['02-convex-foundation', '03-frontend-foundation', '04-company-module']
estimated_complexity: 'medium'
---

# Shared Types & Schemas

## Summary

Define the core TypeScript types, Zod schemas, and shared utilities that are used across all DevSuite packages. This creates a single source of truth for data shapes, ensuring consistency between frontend, backend, and MCP server.

## Objective

Establish type-safe data contracts that all packages consume, preventing type drift and enabling end-to-end type safety.

## Key Deliverables

- Core entity types (Company, Repository, Project, Task, Session)
- Relationship types (Session-Task, Task-External Links)
- Zod schemas for runtime validation
- Shared utility types and functions
- Export structure for clean imports

## Success Criteria

- [ ] All core entities from architecture spec have TypeScript types
- [ ] Zod schemas validate entity shapes at runtime
- [ ] Types are importable as `@devsuite/shared`
- [ ] No circular dependencies
- [ ] Types compile with strict TypeScript settings

## Architecture Reference

Core entities from `/dev_suite_conceptual_architecture_business_vs_tech.md`:

- Company (2.1)
- Repository (2.2)
- Project (2.3)
- Task (2.4)
- Session (2.5)
- Session-Task relationship (2.6)
- External Links (2.7)
- Inbox/Notifications (2.8)
- PR Reviews (2.9)
- Performance Signals (2.10)
- Invoicing (2.11)

## Quick Links

- [Scope](./SCOPE.md)
- [Dependencies](./DEPENDENCIES.md)
- [Tasks](./TASKS.md)
- [Status](./STATUS.md)
