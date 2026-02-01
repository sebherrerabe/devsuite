# Status: Project Module

## Current State

**Status**: planning
**Last Updated**: 2026-01-31
**Updated By**: product-manager

## Progress

### Completed

- [x] Lock acceptance criteria & edge cases (TASK-06-001) (2026-01-31)

### In Progress

- [ ] (none)

### Pending

- [ ] Define/confirm `projects` schema additions (slug/color/pinned/favorite/notesMarkdown)
- [ ] Implement project CRUD (create/update/get/list/softDelete) with company scoping
- [ ] Implement `/_app/projects` list UI (pinned, search, repo filter, archived)
- [ ] Implement project settings UI (repo multi-select, notes editor)
- [ ] Add project detail nested routes (tasks/sessions/settings)

## Blockers

| Blocker         | Waiting On | Since      |
| --------------- | ---------- | ---------- |
| None identified | —          | 2026-01-31 |

## Decision Log

| Date       | Decision                                                                                    | Rationale                                                   | Made By    |
| ---------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------- |
| 2026-01-31 | Tabs are nested routes for project detail                                                   | Matches desired UX + router structure                       | User       |
| 2026-01-31 | Add `notesMarkdown` on projects                                                             | Optional markdown notes per project                         | User       |
| 2026-01-31 | Add `isPinned`, `color`, `isFavorite`, `slug` fields                                        | Required for pinned section + labels + future-friendly URLs | User/Agent |
| 2026-01-31 | Project notes treated as scratchpad in MVP                                                  | Keeps scope lightweight; rich docs deferred                 | User/Agent |
| 2026-01-31 | Project name unique per company                                                             | Prevent confusion + duplicates                              | User       |
| 2026-01-31 | Slug auto-generated (not user-editable in MVP)                                              | Keeps UX simple; supports stable URLs                       | User       |
| 2026-01-31 | Projects list includes pinned section, archived view, search, repo filter, and color labels | Matches “Linear-lite” projects navigation needs             | User/Agent |

## Notes

- Project module must keep strict company scoping and soft delete invariants.
