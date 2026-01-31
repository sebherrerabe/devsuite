# Status: Task Module

## Current State

**Status**: planning  
**Last Updated**: 2026-01-31  
**Updated By**: product-manager

## Progress

### Completed

- [x] Lock acceptance criteria & edge cases (TASK-07-001) (2026-01-31)

### In Progress

- [ ] (none)

### Pending

- [ ] Update `tasks` schema for company scoping + optional projectId
- [ ] Add `sortKey` (persisted ordering) + ordering logic
- [ ] Add `dueDate` (enables Today/Upcoming/Overdue)
- [ ] Replace enum complexity with `complexityScore: 1–10`
- [ ] Add `notesMarkdown` to tasks
- [ ] Add `external_links` table (with title) and migrate away from embedded externalLinks
- [ ] Implement hierarchy + DnD rules (no cross-project moves, max depth 3, no cycles)
- [ ] Implement task tree UI + task side sheet UI
- [ ] Implement global tasks view (`/_app/tasks`) with deterministic filters

## Blockers

| Blocker         | Waiting On | Since      |
| --------------- | ---------- | ---------- |
| None identified | —          | 2026-01-31 |

## Decision Log

| Date       | Decision                                                         | Rationale                                       | Made By    |
| ---------- | ---------------------------------------------------------------- | ----------------------------------------------- | ---------- |
| 2026-01-31 | Tasks are company-scoped; projectId optional                     | Supports company-level tasks + tenant isolation | User       |
| 2026-01-31 | Ordering persisted via `sortKey`                                 | Required for stable manual ordering + DnD       | User       |
| 2026-01-31 | DnD cannot move tasks across projects                            | Prevents cross-project reshuffling              | User       |
| 2026-01-31 | Max depth = 3, cycles prevented                                  | UI safety + data integrity                      | User       |
| 2026-01-31 | Soft-delete subtree on task delete                               | Preserve history; simple mental model           | User       |
| 2026-01-31 | External links normalized table with `title`                     | Needs human names; integration titles later     | User       |
| 2026-01-31 | Complexity uses `complexityScore` 1–10                           | Slider UX; drop enum                            | User       |
| 2026-01-31 | Overdue excludes done/cancelled                                  | Standard behavior; reduces noise                | User       |
| 2026-01-31 | Add `notesMarkdown` to tasks                                     | Optional markdown notes per task                | User       |
| 2026-01-31 | Keyboard-first task flows (Enter/Tab/Shift+Tab/Cmd+K)            | Matches “Linear-lite” speed goals               | User/Agent |
| 2026-01-31 | Keyboard reordering (Alt+↑/↓) in addition to DnD                 | Dense low-latency workflows need it             | User/Agent |
| 2026-01-31 | Today/Upcoming default hide done/cancelled with toggle           | Reduces noise while preserving access           | User/Agent |
| 2026-01-31 | Delete confirmation shows subtree count + undo toast             | Makes subtree delete safe/understandable        | User/Agent |
| 2026-01-31 | Depth=3 has explicit UI indicators + error messaging             | Prevent “it’s a bug” confusion                  | User/Agent |
| 2026-01-31 | URL paste can prefill external link title                        | Faster linking while keeping user control       | User/Agent |
| 2026-01-31 | Tags are a per-company managed tag set                           | Consistency + future rename support             | User       |
| 2026-01-31 | Cmd/Ctrl+K is a global command palette (projects+tasks only MVP) | Keyboard-first navigation/search                | User       |
| 2026-01-31 | Subtree delete undo is session-only                              | Simple + matches MVP constraints                | User       |

## Notes

- Ensure all Convex functions enforce company ownership and soft delete invariants.
- Implement tree operations carefully: validate depth and cycle prevention server-side.
