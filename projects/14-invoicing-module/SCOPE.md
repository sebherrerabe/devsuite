# Scope: Invoicing Module

## In Scope

Session-based invoicing that is **derivative** (computed from sessions/tasks), supports **company default hourly rate + per-project overrides**, supports **company rounding defaults + per-project overrides**, and produces a **snapshot** (rates, time, totals) that can be exported as CSV.

### Entities

- Company billing settings
  - Default hourly rate (money + currency)
  - Default rounding policy (e.g., minute/15-minute; exact options TBD)
- User settings
  - Timezone (used for “per-day” grouping)
- Project billing settings
  - Hourly rate override (defaults to company rate at project creation)
  - Rounding policy override (optional; defaults to company)
- Invoice (snapshot/output artifact)
  - Company-scoped
  - May include multiple projects (multi-rate invoice)
  - Date range (start/end)
  - Timezone used for day grouping (snapshot)
  - Status (draft/finalized/cancelled)
  - Totals (hours/amount)
  - Export artifact (CSV)
- Invoice day group (snapshot)
  - Date (in user timezone)
  - Day totals (hours/amount)
  - Day lines (per project; see below)
- Invoice day line (snapshot, per rate)
  - Rate + rounding policy used
  - Billed hours for that day/rate
  - Computed amount
  - Task overview text grouped by project with a project separator; task titles deduped within each project
  - Included session IDs (that contributed billable time for that day/rate)
- Invoice ↔ session linkage (to prevent double invoicing)
  - A session is considered “already invoiced” only if it is linked to at least one **non-cancelled** invoice

### Functionality

- Configure company default hourly rate
- Configure company rounding defaults (with optional per-project override)
- Configure user timezone (simple input in user settings)
- Configure per-project hourly rate override (uses company default as initial value)
- Generate invoice preview:
  - Select date range with UX-friendly shortcuts (this/last week, this/last month, etc.)
  - Include **only ended sessions**
  - Exclude sessions with no billable task time (no tasks ⇒ no effective time ⇒ not billable)
  - Exclude sessions already invoiced (linked to a non-cancelled invoice)
  - Show a preview list of included sessions before finalizing
- Invoice calculation + presentation:
  - Compute **hours per day, per rate**
  - Show task overview per day/rate (derived from tasks that contributed billable time)
  - Compute price per day/rate (`rate * rounded(hours)`) and invoice total
  - Ensure multi-task sessions do **not** double-count time:
  - Bill a single timeline
  - Allocate billable time across tasks without exceeding the session’s effective time
  - Split billable time across day boundaries (user timezone) and invoice range boundaries
- Finalize invoice:
  - Persist an immutable snapshot (timezone, rounding, rates used, day lines, included sessions, totals)
  - Store/export CSV
  - Mark included sessions as invoiced (via linkage) to prevent reuse
- Invoice history:
  - List invoices
  - View invoice detail (day lines + underlying sessions)
  - Re-download CSV export
- Cancel invoice (soft):
  - Keep record (no hard deletes)
  - Cancelled invoices do not block sessions from being invoiced again

### UI Components (Web)

- Company settings section for default hourly rate (and currency if included)
- Company settings section for rounding defaults
- User settings section for timezone (simple input)
- Project settings section for rate override
- Project settings section for rounding override
- Invoice generation page:
  - Date range picker with presets + manual override
  - Preview grouped by day with per-rate lines (multi-rate)
  - Finalize action + CSV download
- Invoice history page + invoice detail view

### UI Flow Specs

#### Invoice List Page

- Primary action: **Generate Invoice**
- Filters: date range, status (Draft/Finalized/Cancelled), search
- List columns: date range, total hours, total amount, rates count, status, created at/by
- Row actions: View, Download CSV, Cancel (finalized only)
- Default sort: newest first

#### Invoice Generation (Preview) Page

- Date range selector with presets (this/last week, this/last month) + manual override
- Summary: total hours, total amount, sessions count, timezone used
- Preview:
  - Grouped by day (user timezone)
  - Per-rate lines (hours, rate, amount)
  - Task list per line grouped by project separators; alphabetical; deduped within project
- Validation:
  - Sessions with no task intervals are excluded
  - Overlapping intervals with different rates **block finalization** and show conflicts
- Actions: Finalize, Download CSV (after finalize), Back

#### Invoice Detail Page

- Header: date range, timezone, status, total hours/amount, created by/at
- Body: day sections → per-rate lines → task list (grouped by project, alphabetical, deduped)
- Toggle: “Show included sessions” (collapsed by default)
- Actions: Download CSV, View CSV, Cancel Invoice (if finalized)

#### Sessions Page Bulk Action

- Bulk action: **Create Invoice**
- Default range = min/max of selected sessions
- Toggle: “Include other eligible sessions in this range” (off by default)
- Block creation if any selected session has:
  - No task intervals
  - Overlap across different rates

#### CSV View

- Default view is the formatted invoice UI
- CSV available in a separate tab/drawer (“View CSV”) + download

### Invoice line layout (example)

```
18 Oct 2016   5.0 hours   €25/hr   €125
Project A
Task blablabla
Task blablabla 2
Project B
hahaha

18 Oct 2016   5.0 hours   €20/hr   €100
Project C
Another task with different rate
```

Task list is grouped by project with separators, ordered alphabetically by project, and tasks are ordered alphabetically within each project; tasks are deduped within each project per day/rate line.

## Out of Scope

- Full accounting (taxes/VAT, discounts, payments, credits, multi-line adjustments)
- PDF generation / sending invoices via email
- Client/contact management (addresses, purchase orders, etc.)
- Multi-currency conversion
- Designing a full “timeline editor” beyond the session/task time allocation required for correct invoicing
- Partial invoicing of a single session (splitting a session across invoices)

## Boundaries

### Derivative data

Invoices are output artifacts derived from sessions. Sessions remain the source of truth for time tracking.

### Double counting

Sessions may touch multiple tasks (including across projects); invoices must bill a **single effective-time timeline** (no double counting) and show tasks as context.

### Day boundaries

Invoice day groups are computed in the user’s timezone. If billable time crosses midnight, it is split across the two days.

### Invoice range boundaries

If billable time partially overlaps the selected invoice range, it is split and only the overlapping portion is included.

### Rounding policy

- Rounding is applied **per day/per rate line** after computing the effective-time union.
- Supported increments: any positive integer minutes (company default; optional project override).
- Default policy: **60-minute increments, floor**.

## Task Activity Interval Model (Draft)

Effective time is derived from explicit **task activity intervals** within a session.

### Interval record (per task)

- `taskId`
- `startTime`, `endTime`
- Optional metadata (source/user/agent) as needed
- Soft-delete fields if removal is required

### Rules

- Intervals must be within the session start/end.
- A task can have multiple intervals in a session.
- Intervals may overlap (parallel work); **effective time = union of all intervals**.
- If overlapping intervals belong to tasks with **different hourly rates**, this violates the “same rate on overlapping timeline” rule and must be flagged in preview (block finalize until resolved).
- If a task is attached but has **no intervals**, it contributes **no billable time**.

### Billing + display mapping

- Split intervals across day boundaries (user timezone) and invoice range boundaries.
- Group billable time by **rate** for each day (not by project).
- Under each day/rate line, list tasks **grouped by project**, ordered alphabetically; dedupe tasks within each project for that day/rate.

## Assumptions

- All invoicing data is company-scoped.
- Tasks belong to exactly one project (per architecture spec).
- Day grouping uses the user’s configured timezone.
- Sessions with no tasks have no effective time and are not billable (excluded from invoices).
- A single session may include tasks from multiple projects (e.g., parallel agents).
- Billable/effective time is derived from task activity within the session; time not attributed to tasks is not billed.
- Effective time is the **union of task activity intervals**; overlapping tasks do not add time.
- Billable time is aggregated by **rate**, not by project.
- If tasks from different projects overlap in time, those projects must share the same hourly rate for that overlapping period, so overlap allocation does not change billing totals.

## Open Questions

- None.
