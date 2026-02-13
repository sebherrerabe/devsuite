# Tasks: Performance Signals

## Task Breakdown

### TASK-13-001: Performance API Foundation

| Field            | Value                        |
| ---------------- | ---------------------------- |
| Assigned Persona | Backend Engineer             |
| Status           | complete                     |
| Depends On       | none                         |
| Deliverable      | Convex performance endpoints |

**Description**:  
Implement signal ingestion/listing and initial dashboard metrics query.

**Acceptance Criteria**:

- [x] Add mutation to create company-scoped performance signals
- [x] Add query to list raw performance signals with filters
- [x] Add query to derive dashboard metrics from sessions/tasks/reviews

---

### TASK-13-002: Performance Dashboard UI

| Field            | Value                             |
| ---------------- | --------------------------------- |
| Assigned Persona | Frontend Engineer                 |
| Status           | complete                          |
| Depends On       | TASK-13-001                       |
| Deliverable      | `/performance` route + navigation |

**Description**:  
Expose derived metrics in the app with date/project filters and daily breakdown.

**Acceptance Criteria**:

- [x] Add `/performance` route page
- [x] Add date range filters
- [x] Add project filter
- [x] Show summary cards and daily table
- [x] Wire sidebar navigation

---

### TASK-13-003: Metrics Correctness Hardening

| Field            | Value                                    |
| ---------------- | ---------------------------------------- |
| Assigned Persona | Backend Engineer / QA                    |
| Status           | complete                                 |
| Depends On       | TASK-13-001                              |
| Deliverable      | Validation checklist + query refinements |

**Description**:  
Tighten edge-case semantics and add verification scenarios.

**Acceptance Criteria**:

- [x] Validate context-switch counting expectations
- [x] Validate focus-time/project-allocation assumptions
- [x] Add targeted test coverage for date-range and filtering logic

---

### TASK-13-004: Performance Views Expansion

| Field            | Value                         |
| ---------------- | ----------------------------- |
| Assigned Persona | Frontend Engineer             |
| Status           | complete                      |
| Depends On       | TASK-13-001                   |
| Deliverable      | Complexity/review/trend views |

**Description**:  
Add richer views on top of the dashboard baseline for interpretation without judgement labels.

**Acceptance Criteria**:

- [x] Add daily trend visualization section
- [x] Add weekly/monthly trend aggregation view
- [x] Add complexity-vs-effort section
- [x] Add review-load section with repository distribution

---

### TASK-13-005: QA and Review Gate

| Field            | Value                                     |
| ---------------- | ----------------------------------------- |
| Assigned Persona | QA / Validation                           |
| Status           | complete                                  |
| Depends On       | TASK-13-003, TASK-13-004                  |
| Deliverable      | Validation report + status move to review |

**Description**:  
Close out the module with automated checks and manual validation.

**Acceptance Criteria**:

- [x] Test range boundaries and filter combinations
- [x] Validate derived metrics against known scenario fixtures
- [x] Confirm dashboard behavior in empty/loading/error states
- [x] Move status to `review` after sign-off

---

### TASK-13-006: Visual-First Performance UX Redesign

| Field            | Value                                   |
| ---------------- | --------------------------------------- |
| Assigned Persona | Product Designer + Frontend Engineer    |
| Status           | complete                                |
| Depends On       | TASK-13-005                             |
| Deliverable      | Redesigned visual performance dashboard |

**Description**:  
Redesign the Performance page to be chart-first and insight-first while preserving auditable raw data.

**Acceptance Criteria**:

- [x] Validate visual analysis with stakeholder (`UX_VISUAL_ANALYSIS.md`)
- [x] Implement chart-first information hierarchy (overview -> diagnosis -> detail)
- [x] Add chart visuals per section (trend, project share, complexity vs effort, review load)
- [x] Keep raw data table in collapsible drilldown/details area
- [x] Ensure keyboard accessibility and responsive behavior for all chart sections
- [x] Run `pnpm lint`, `pnpm typecheck`, and module QA checks
