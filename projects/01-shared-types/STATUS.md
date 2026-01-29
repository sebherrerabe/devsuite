# Status: Shared Types & Schemas

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
- [ ] TASK-01-001: Define Base Types and Utilities
- [ ] TASK-01-002: Define Company and Repository Types
- [ ] TASK-01-003: Define Project and Task Types
- [ ] TASK-01-004: Define Session Types
- [ ] TASK-01-005: Define Inbox and Notification Types
- [ ] TASK-01-006: Define PR Review Types
- [ ] TASK-01-007: Define Performance and Invoicing Types
- [ ] TASK-01-008: Create Export Structure

## Blockers
| Blocker | Waiting On | Since |
|---------|------------|-------|
| Scaffolding not complete | 00-scaffolding | 2026-01-29 |

## Decision Log
| Date | Decision | Rationale | Made By |
|------|----------|-----------|---------|
| 2026-01-29 | Use Zod for validation | Industry standard, good TS inference | Architecture |
| 2026-01-29 | Branded ID types | Type safety for entity references | Architecture |

## Notes
- Blocked until 00-scaffolding completes
- This is a foundational package - take time to get it right
