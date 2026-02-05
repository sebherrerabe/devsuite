# Dependencies: Invoicing Module

## Required Inputs

### From 04-company-module

- Company entity + company scoping (active company context in UI and backend)
- Company settings surface (place to configure default hourly rate + rounding defaults)
- Soft-delete conventions + tenant isolation rules

### From 06-project-module (indirect via Session/Task)

- Project entity (company-scoped)
- Project settings surface (place to configure project rate override)

### From 07-task-module (indirect via Session)

- Task entity with `projectId` (tasks belong to exactly one project)
- Task display fields needed for “task overview” (e.g., title)

### From 08-session-module

- Session entity with:
  - `companyId`
  - `startTime`, `endTime` (ended session definition)
  - Optional `summary`
- Session ↔ task links (to derive task overview and attribute work to projects)
- Task activity intervals per task (explicit start/end times) used to compute effective time
- Queries/mutations to:
  - List ended sessions by date range (company-scoped)
  - List (or compute) billable time grouped by day + **rate** for invoice preview
  - Prevent or detect double invoicing (exclude sessions linked to **non-cancelled** invoices)

### From 02-convex-foundation / auth (or equivalent)

- User identity record accessible in Convex (user-scoped settings)
- Persisted user timezone setting (simple input; used for invoice day grouping)

### From 01-shared-types (and/or shared conventions)

- Money representation (currency + integer minor units recommended)
- Rounding policy representation (company default + optional project override)
- Common validation patterns (Zod schemas) for rate settings and invoice inputs

## Produced Outputs

### For users

- Invoice generation + preview UI with date range shortcuts
- Invoice snapshot records (history) derived from sessions
- CSV export of finalized invoices

### For internal reuse

- Standardized invoice data model + export format that other modules can reference (e.g., reporting)

## External Dependencies

- UI date range picker + preset shortcuts (web app)
- CSV generation (either a small utility or a library; must preserve auditability)

## Blocking Issues

- Define billable/effective time model (how tasks encode time without double-counting).
- Define handling of sessions crossing midnight / range boundaries for “hours per day”.
- Define supported rounding increments and where rounding is applied (line/day vs totals).
