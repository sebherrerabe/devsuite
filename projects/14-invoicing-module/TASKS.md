# Tasks: Invoicing Module

## Task Breakdown

### TASK-14-001: Finalize Scope Decisions

| Field            | Value                       |
| ---------------- | --------------------------- |
| Assigned Persona | Product Manager             |
| Status           | in-progress                 |
| Depends On       | none                        |
| Deliverable      | Confirmed scope + decisions |

**Description**:
Resolve the open questions required to implement a consistent invoice model and UX.

**Acceptance Criteria**:

- [x] Confirm invoices can include multiple projects (multi-rate day lines)
- [x] Confirm rate timing: snapshot rates/totals at invoice finalization
- [x] Confirm day grouping uses the user timezone (stored in user settings)
- [x] Confirm sessions crossing midnight/range boundaries are split (user timezone)
- [x] Confirm sessions with no tasks are not billable (excluded from invoices)
- [x] Confirm effective time is computed from the timeline (union of task activity intervals; overlaps do not add time)
- [x] Confirm task activity intervals are explicit slices (start/end) and can occur multiple times per task
- [x] Confirm overlapping tasks across projects require the same hourly rate (overlap allocation does not affect totals)
- [x] Confirm rounding is configured per company and can be overridden per project
- [ ] Decide supported rounding increments and where rounding is applied (per line/day vs totals)
- [ ] Decide whether preview allows excluding sessions before finalizing
- [x] Confirm cancelling an invoice preserves audit history and does not block sessions from being invoiced again

**Notes**:
Open questions are listed in `projects/14-invoicing-module/SCOPE.md`.

---

### TASK-14-002: Design Invoice Generation UX

| Field            | Value              |
| ---------------- | ------------------ |
| Assigned Persona | UX/UI Designer     |
| Status           | pending            |
| Depends On       | TASK-14-001        |
| Deliverable      | UX spec (markdown) |

**Description**:
Design the invoice generation flow including date range presets, sessions preview, and invoice detail layout (hours per day + task overview + totals).

**Acceptance Criteria**:

- [ ] Define date range picker UX with presets (this/last week, this/last month, etc.)
- [ ] Define preview layout (group by day, per-rate lines, grouped tasks)
- [ ] Define invoice line format: date + hours + rate + amount, with tasks grouped by project (project separator), ordered alphabetically by project and task, and deduped within each project
- [ ] Define empty/loading/error states (no sessions found, rate-conflict overlaps, etc.)
- [ ] Define invoice history list layout + filters + row actions
- [ ] Define invoice detail layout including “Show included sessions” toggle (collapsed by default)
- [ ] Define CSV view + download interaction (CSV in tab/drawer)
- [ ] Define Sessions page bulk action “Create Invoice” flow and validation rules

---

### TASK-14-003: Define Billing + Invoice Data Model

| Field            | Value                        |
| ---------------- | ---------------------------- |
| Assigned Persona | Convex Developer             |
| Status           | pending                      |
| Depends On       | TASK-14-001                  |
| Deliverable      | Convex schema + shared types |

**Description**:
Define the Convex schema and shared TypeScript/Zod types for company/project rates and invoice snapshots, enforcing company scoping and soft delete patterns.

**Acceptance Criteria**:

- [ ] Company default hourly rate stored (money + currency) with tenant isolation
- [ ] Company default rounding policy stored
- [ ] Project hourly rate override stored (inherits from company at creation; override possible)
- [ ] Project rounding policy override stored (optional)
- [ ] User timezone stored in user settings (used for invoice day grouping)
- [ ] Invoice snapshot schema defined (status, date range, totals, day lines, CSV artifact metadata)
- [ ] Link sessions to invoices to prevent double invoicing
- [ ] Soft delete/cancel patterns defined (no hard deletes)

---

### TASK-14-004: Implement Invoice Preview + Finalize Logic (Backend)

| Field            | Value                      |
| ---------------- | -------------------------- |
| Assigned Persona | Convex Developer           |
| Status           | pending                    |
| Depends On       | TASK-14-003                |
| Deliverable      | Convex queries + mutations |

**Description**:
Implement invoice preview computation (ended sessions, not invoiced, in range) and invoice finalization (snapshot + linkage).

**Acceptance Criteria**:

- [ ] Preview query returns computed per-day **per-rate** breakdown + totals
- [ ] Preview excludes non-ended sessions, sessions already invoiced, and sessions with no billable task time
- [ ] Preview splits billable time across midnight and invoice range boundaries (user timezone)
- [ ] Preview computation follows the defined effective-time/overlap allocation rules (no double counting)
- [ ] Finalize mutation is atomic and prevents double invoicing in concurrent requests
- [ ] Finalized invoice stores immutable snapshot (timezone, rates used, rounding used, day lines, included sessions, totals)
- [ ] CSV export content is reproducible from stored snapshot (or stored directly as artifact)

---

### TASK-14-005: Rate Settings UI (Company + Project)

| Field            | Value                 |
| ---------------- | --------------------- |
| Assigned Persona | Frontend Engineer     |
| Status           | pending               |
| Depends On       | TASK-14-003           |
| Deliverable      | Rate settings screens |

**Description**:
Implement UI to view/update the company default hourly rate and project override rate.

**Acceptance Criteria**:

- [ ] Company settings includes default hourly rate controls
- [ ] Company settings includes rounding defaults controls
- [ ] Project settings includes hourly rate override controls
- [ ] Project settings includes rounding override controls
- [ ] User settings includes timezone input (simple placeholder) and persists it
- [ ] Input validation (non-negative, currency constraints if applicable)
- [ ] Uses shared schemas/types

---

### TASK-14-006: Invoice Generator UI (Preview + Finalize)

| Field            | Value                   |
| ---------------- | ----------------------- |
| Assigned Persona | Frontend Engineer       |
| Status           | pending                 |
| Depends On       | TASK-14-004             |
| Deliverable      | Invoice generation page |

**Description**:
Implement invoice generation UI: date range selection with presets, sessions preview, and finalize flow.

**Acceptance Criteria**:

- [ ] Date range presets + manual override supported
- [ ] Preview shows day groups with per-rate lines (hours/day/rate, task overview, rate, amount)
- [ ] Preview shows day totals + invoice total
- [ ] Finalize creates invoice snapshot and navigates to invoice detail
- [ ] CSV export available after finalization

---

### TASK-14-007: Invoice History UI

| Field            | Value                       |
| ---------------- | --------------------------- |
| Assigned Persona | Frontend Engineer           |
| Status           | pending                     |
| Depends On       | TASK-14-004                 |
| Deliverable      | Invoice history + detail UI |

**Description**:
Implement invoice history list and invoice detail view for previously finalized invoices.

**Acceptance Criteria**:

- [ ] Invoice list filtered by company
- [ ] Invoice detail renders per-day groups with per-rate lines and included sessions
- [ ] CSV download works for historical invoices
- [ ] Cancel invoice action supported (if in scope) with clear UI state

---

### TASK-14-008: Validation Plan (Edge Cases)

| Field            | Value                     |
| ---------------- | ------------------------- |
| Assigned Persona | QA / Validation           |
| Status           | pending                   |
| Depends On       | TASK-14-001               |
| Deliverable      | Test scenarios (markdown) |

**Description**:
Produce a validation checklist focusing on billing correctness and data integrity.

**Acceptance Criteria**:

- [ ] Scenarios for sessions crossing midnight / range boundaries
- [ ] Scenarios for overlapping sessions (if allowed) and impact on invoicing
- [ ] Scenarios for tasks overlapping in time across multiple projects (overlap allocation / conflict handling)
- [ ] Scenarios for rate changes between session date and invoice finalization
- [ ] Scenarios for sessions with no tasks (excluded from billing)
- [ ] Scenarios for double invoicing prevention (concurrency)
- [ ] Scenarios for cancelled invoice behavior

---

## Task Dependency Graph

```
TASK-14-001
├── TASK-14-002
├── TASK-14-003
│   └── TASK-14-004
│       ├── TASK-14-006
│       └── TASK-14-007
└── TASK-14-008
```
