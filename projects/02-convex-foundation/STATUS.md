# Status: Convex Foundation

## Current State

**Status**: in-progress
**Last Updated**: 2026-01-31
**Updated By**: documentation-dx

## Progress

### Completed

- [x] Convex project present in `convex/` with Cloud-first dev workflow documented (needs runtime verification)
- [x] Initial schema exists (`convex/schema.ts`) with core entities and indexes (needs review against specs)
- [x] Initial helper utilities exist (`convex/lib/helpers.ts`) for company scoping + soft delete primitives
- [x] Better Auth wiring present (`convex/auth.config.ts`, `convex/convex.config.ts`, `convex/http.ts`) (needs runtime verification)

### In Progress

- [ ] Align project specs + runbooks with current Cloud-first + Better Auth decisions
- [ ] Verify `convex dev` runtime behavior for schema + auth + env var setup

### Pending

- [ ] TASK-02-005: Create Base CRUD Patterns
- [ ] TASK-02-006: Set Up Realtime Subscription Patterns
- [ ] TASK-02-007: Integrate with Shared Types
- [ ] TASK-02-008: Create Development Utilities
- [ ] TASK-02-010: Convex Cloud Free-First Runbook + Portability Notes
- [ ] TASK-02-011: Downstream Module Author Runbook (Convex Patterns)
- [ ] TASK-02-012: QA Validation Checklist (Convex Invariants)

## Blockers

| Blocker                   | Waiting On      | Since      |
| ------------------------- | --------------- | ---------- |
| Shared types status drift | 01-shared-types | 2026-01-31 |

## Decision Log

| Date       | Decision                                        | Rationale                                          | Made By          |
| ---------- | ----------------------------------------------- | -------------------------------------------------- | ---------------- |
| 2026-01-29 | Soft delete only                                | Data integrity requirement                         | Architecture     |
| 2026-01-29 | Company scoping on all queries                  | Privacy requirement                                | Architecture     |
| 2026-01-31 | Convex Cloud Free-first                         | Fast default with portability later                | Project decision |
| 2026-01-31 | Better Auth on Convex (backend)                 | Standardized auth integration without requiring UI | Project decision |
| 2026-01-31 | Frontend auth UI deferred                       | Keep 02 backend-only; UI handled later             | Project decision |
| 2026-01-31 | Soft delete uses `deletedAt` as source-of-truth | Align with `@devsuite/shared` pattern              | Project decision |

## Notes

- This is a high-complexity project - critical to get patterns right
- Patterns established here affect all feature modules
- 00-scaffolding is **completed** (blocker removed).
- 01-shared-types `STATUS.md` still shows **pending**, but `packages/shared/src/*` appears to be implemented; treat shared contracts as available and update 01 status separately.
