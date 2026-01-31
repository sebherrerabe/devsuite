---
id: '07-task-module-backend-review'
title: 'Task Module Backend Review (Phase 2)'
status: 'complete'
owner: 'backend-engineer'
last_updated: '2026-01-31'
---

# Backend Review: Indexes + Error Semantics (Phase 2)

## Scope

Review the current schema indexes and error semantics for:

- `getProjectTasks` / `getCompanyTasks` (deleted filtering, parent filtering)
- `listExternalLinksByTask`
- `listTagsByCompany`
- `listProjects` with `includeArchived`
- `dueDate` timezone semantics for global filters

## Index Review

| Query / Pattern                 | Current Index                                                 | Status | Recommendation                                                                                           |
| ------------------------------- | ------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| `getProjectTasks`               | `tasks.by_companyId_projectId_deletedAt`                      | ✅     | Keep. This matches the query pattern exactly.                                                            |
| `getCompanyTasks`               | `tasks.by_companyId_projectId_deletedAt` (`projectId = null`) | ✅     | Keep. This supports company-level tasks efficiently.                                                     |
| Sibling lookup (parent + scope) | `tasks.by_companyId_projectId_parentTaskId_deletedAt`         | ✅     | Use for `sortKey` generation and any parent/child list within a project or company scope.                |
| Descendant traversal            | `tasks.by_parentTaskId`                                       | ⚠️     | Acceptable for internal recursion, but prefer scoped indexes when adding companyId/projectId to helpers. |
| `listExternalLinksByTask`       | `external_links.by_companyId_taskId_deletedAt`                | ✅     | Use to avoid cross-company scans.                                                                        |
| `listTagsByCompany`             | `tags.by_companyId_deletedAt`                                 | ✅     | Keep. Matches usage.                                                                                     |
| Tag name uniqueness             | `tags.by_companyId_name_deletedAt`                            | ✅     | Use for create/update uniqueness checks.                                                                 |
| `listProjects` (archived)       | `projects.by_companyId`                                       | ✅     | Keep for `includeArchived = true`.                                                                       |
| `listProjects` (active only)    | `projects.by_companyId_deletedAt`                             | ✅     | Keep for `includeArchived = false`.                                                                      |

### Optional Index Enhancements (Not Required for Current Scope)

- If server-side ordering by `sortKey` becomes necessary, add a composite
  index that ends with `sortKey` (e.g., `by_companyId_projectId_deletedAt_sortKey`)
  and query with `.order('asc')`.

## Error Semantics Review

### Deterministic Error Contract (Recommended)

Use stable, predictable error strings so the UI can map them reliably.
Prefer consistent capitalization and singular table names.

| Domain        | Condition                   | Recommended Message                                                          |
| ------------- | --------------------------- | ---------------------------------------------------------------------------- |
| Task          | Not found or wrong company  | `Task not found`                                                             |
| Task          | Soft-deleted                | `Task is deleted`                                                            |
| Task          | Parent/child scope mismatch | `Parent and child tasks must have matching project scope`                    |
| Task          | Max depth reached           | `Maximum depth (3) reached`                                                  |
| Task          | Cycle prevention            | `Cannot move task: would create a cycle`                                     |
| Task          | Cross-project move          | `Cannot move task across projects`                                           |
| Task          | Invalid complexity score    | `complexityScore must be between 1 and 10`                                   |
| External link | Title empty                 | `External link title is required`                                            |
| External link | URL invalid                 | `URL must start with http:// or https://`                                    |
| Tag           | Empty name                  | `Tag name cannot be empty`                                                   |
| Tag           | Duplicate name              | `Tag with name "<name>" already exists`                                      |
| Project       | Invalid name                | `Project name cannot be empty` / `Project name cannot exceed 255 characters` |
| Auth/Scope    | Company access denied       | `Company not found or access denied`                                         |

### Observations

- Task-related errors are mostly deterministic, but the current messages vary
  between plural and singular table names (`tasks not found` vs `Task not found`).
- `undoRestoreTaskSubtree` uses custom error strings that differ from
  `assertCompanyScoped` errors; align them to a single format.
- Project functions mix return-`null` and throw patterns; pick one strategy per
  endpoint and document it so UI behavior is predictable.

### Recommendation

Standardize on singular entity names and consistent phrasing for all thrown
errors. If error codes are introduced later, prefix messages with a stable code
string (e.g., `ERR_TASK_NOT_FOUND: Task not found`) while keeping the human
readable message unchanged.

## Timezone Semantics (dueDate)

`dueDate` is stored as a UTC timestamp in milliseconds. The client should
interpret it in the **user's local timezone** for Today/Upcoming/Overdue:

- **Today**: `dueDate` is between `startOfToday` and `endOfToday` in local time.
- **Upcoming**: `dueDate` is after `endOfToday` in local time.
- **Overdue**: `dueDate` is before `startOfToday` in local time and status is not
  `done` or `cancelled`.

For date-only pickers, normalize to local start-of-day (or a consistent local
time like noon) and keep comparisons based on the local-day boundaries above.

## Change Summary

- Added scoped indexes for task siblings, tag uniqueness, and task link lookup.
- `sortKey` generation should use the scoped sibling index.
- Error message standardization and timezone semantics documented for UI alignment.
