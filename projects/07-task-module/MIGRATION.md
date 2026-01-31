---
id: '07-task-module-migration'
title: 'Task Module Migration Plan (Phase 1)'
status: 'draft'
owner: 'backend-engineer'
last_updated: '2026-01-31'
---

# Task Module Migration Plan (Phase 1)

## Summary

This plan covers the data migration path from legacy task fields to the
Phase 1 schema:

- `complexity` enum → `complexityScore` (1–10)
- embedded `externalLinks` → `external_links` table
- freeform `tags: string[]` → `tagIds: Id<"tags">[]` (managed tags)

## Compatibility Strategy (No Hard Deletes)

- **Do not hard delete** legacy fields or documents during Phase 1.
- **Write new data only** to the normalized structures (`external_links`, `tagIds`,
  `complexityScore`). Treat legacy fields as **read-only** if they appear.
- **Optional backfill** action can copy legacy data forward; cleanup/removal of
  legacy fields should be a separate, later phase after validation.

## Current Data State (Assumption)

There is no existing production data yet for the legacy task fields because the
new tables/functions were introduced before any tasks were created.

**Decision**: Treat migration as **no-op** unless the verification checklist
below indicates legacy data exists. Even in a no-op path, keep legacy fields
tolerated/read-only to avoid hard deletes.

## Verification Checklist (Before Declaring No-op)

- [ ] Count rows in `tasks`
- [ ] Sample tasks for legacy fields: `complexity`, `externalLinks`, `tags`
- [ ] Count rows in `external_links` and `tags`

If any legacy fields exist, run the migration steps below.

## Migration Plan (Only If Legacy Data Exists)

### 1) `complexity` → `complexityScore`

**Mapping table (deterministic):**

| legacy complexity | complexityScore |
| ----------------- | --------------- |
| trivial           | 1               |
| small             | 3               |
| medium            | 5               |
| large             | 8               |
| epic              | 10              |

**Rules:**

- If `complexity` is missing, set `complexityScore` to `null`.
- If `complexity` is invalid, set `complexityScore` to `null` and log the task ID.
- Do **not** remove legacy `complexity` in Phase 1; optional cleanup later.

### 2) embedded `externalLinks` → `external_links`

**Steps:**

1. For each task with `externalLinks[]`, create `external_links` rows:
   - `companyId`: task.companyId
   - `taskId`: task.\_id
   - `type`, `url`, `identifier`: copied from legacy link
   - `title`: required. If missing, set to the URL hostname or identifier and
     add `metadata: { migratedTitle: true }`
2. If the task is soft-deleted, set `external_links.deletedAt` to the same
   timestamp for consistency.
3. Leave legacy `externalLinks` in place (read-only); optional cleanup later.

### 3) freeform `tags: string[]` → `tagIds`

**Steps:**

1. Build a per-company map of `tagName -> tagId`:
   - Normalize with `trim()`
   - Drop empty strings
   - Keep case-sensitive names (MVP behavior)
2. Create missing tags in the `tags` table.
3. Replace each task’s `tags` array with `tagIds` (unique, stable order).
4. Leave legacy `tags` in place (read-only); optional cleanup later.

## Idempotency + Safety

- Migration must be idempotent (safe to re-run).
- Never hard-delete legacy data; only soft-delete or remove legacy fields.
- Prefer logging task IDs when data is malformed (for manual review).

## Suggested Execution (One-off Convex Action)

```ts
// Pseudocode: run once, batched by company, with pagination.
for company in companies:
  tasks = query tasks by companyId (include deleted)
  for task in tasks:
    if legacy complexity:
      patch complexityScore + remove complexity
    if legacy externalLinks:
      insert external_links (idempotent)
      remove externalLinks
    if legacy tags:
      ensure tags exist
      patch tagIds + remove tags
```

## Post-Migration Validation

- [ ] No tasks contain legacy fields (`complexity`, `externalLinks`, `tags`)
- [ ] `tagIds` arrays populated where expected
- [ ] `external_links` rows count matches legacy link count
- [ ] Spot-check at least one project task + one company task
