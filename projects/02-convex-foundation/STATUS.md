# Status: Convex Foundation

## Current State

**Status**: pending
**Last Updated**: 2026-01-29
**Updated By**: Initial setup

## Progress

### Completed

(none yet)

### In Progress

(none yet)

### Pending

- [ ] TASK-02-001: Initialize Convex Project
- [ ] TASK-02-002: Define Core Entity Schemas
- [ ] TASK-02-003: Implement Soft Delete Pattern
- [ ] TASK-02-004: Implement Company Scoping Pattern
- [ ] TASK-02-005: Create Base CRUD Patterns
- [ ] TASK-02-006: Set Up Realtime Subscription Patterns
- [ ] TASK-02-007: Integrate with Shared Types
- [ ] TASK-02-008: Create Development Utilities

## Blockers

| Blocker                 | Waiting On      | Since      |
| ----------------------- | --------------- | ---------- |
| Scaffolding incomplete  | 00-scaffolding  | 2026-01-29 |
| Shared types incomplete | 01-shared-types | 2026-01-29 |

## Decision Log

| Date       | Decision                       | Rationale                  | Made By      |
| ---------- | ------------------------------ | -------------------------- | ------------ |
| 2026-01-29 | Convex self-hosted             | Per architecture spec      | Architecture |
| 2026-01-29 | Soft delete only               | Data integrity requirement | Architecture |
| 2026-01-29 | Company scoping on all queries | Privacy requirement        | Architecture |

## Notes

- This is a high-complexity project - critical to get patterns right
- Patterns established here affect all feature modules
- Consider creating a "patterns" doc for other developers
