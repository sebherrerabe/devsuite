# Status: Invoicing Module

## Current State

- Status: `review`
- Last updated: 2026-02-05
- Implementation landed for invoice generation (backend + UI) including manual session selection; lint/typecheck pass.

## Decisions (Confirmed)

- Invoices are **snapshots** (immutable output artifacts) derived from sessions.
- Company has a default hourly rate; projects inherit that as default and can override.
- Invoices may include **multiple projects**, with per-project rates producing multi-rate day lines.
- Only **ended sessions** are eligible for invoicing.
- Sessions with **no tasks** have no effective time and are **not billable** (excluded).
- Effective time is the **union of task activity intervals** within the session; overlapping tasks do not add time.
- Invoicing bills a **single effective-time timeline** (no double counting), even if multiple tasks run in parallel.
- A single session may include tasks from multiple projects (e.g., parallel agents).
- If tasks from different projects overlap in time, those projects must share the same hourly rate for that overlap; billing is driven by the task timeline, not project allocation.
- Task activity intervals are explicit slices (`startTime`/`endTime`) and can repeat per task within a session.
- Day grouping uses the **user’s configured timezone** (stored in user settings).
- Billable time is split across midnight and invoice range boundaries (user timezone).
- Invoice generation supports a date range with UX-friendly shortcuts + a preview of included sessions.
- Rounding is configured per company and can be overridden per project.
- Invoice presentation includes hours per day **per rate**, a task overview, per-day/rate amount, and total.
- Task overview list is grouped by project with separators, ordered alphabetically by project and task, and deduped within each project per day/rate line.
- Rates, rounding, time totals, and included sessions are snapshotted at invoice finalization.
- Sessions are excluded from new invoices only if linked to a **non-cancelled** invoice (cancelled invoices do not block re-invoicing).
- Rounding applies **per day/per rate line**, supports any positive minute increment, defaulting to **60-minute floor**.

## Open Questions

- None.

## Next Actions

- Review and accept the module.
