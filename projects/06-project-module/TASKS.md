# Tasks: Project Module

## Task Breakdown

### TASK-06-001: Lock acceptance criteria & edge cases (Projects)

| Field            | Value                                                      |
| ---------------- | ---------------------------------------------------------- |
| Assigned Persona | Product Manager                                            |
| Status           | complete                                                   |
| Depends On       | none                                                       |
| Deliverable      | Finalized acceptance criteria + edge-case decisions for 06 |

**Description**:
Finalize what “done” means for the Project module MVP, including archived behavior, unique naming, slug behavior, and minimal project settings.

**Acceptance Criteria**:

- [x] **Company scoping**: All Project operations (create, read, update, list, archive) are scoped to the current company; projects from other companies cannot be accessed or listed.
- [x] **No hard deletes**: Projects are never hard-deleted; “archive” is implemented as a soft delete (`deletedAt` set), and active lists exclude archived projects by default.
- [x] **Name uniqueness (per company)**: Creating a project with the exact same name as an existing active project in the same company is rejected; renaming a project to a name already used by another active project in the same company is rejected.
- [x] **Slug behavior (MVP)**:
  - [x] Slug is auto-generated on create.
  - [x] Slug is not user-editable in create or settings in MVP.
  - [x] Renaming a project does not change its slug in MVP (slug is stable once created).
- [x] **Projects list behaviors** (`/_app/projects`):
  - [x] **Pinned section** exists and surfaces pinned projects distinctly from the unpinned list.
  - [x] **Color labels**: Projects support an optional color label, and it is visible in the list presentation when set.
  - [x] **Search** filters projects by name (within the current company).
  - [x] **Repository filter** filters projects to those associated with the selected repository (within the current company).
  - [x] **Archived view** exists and shows only archived (soft-deleted) projects for the current company.
- [x] **Project notes (MVP)**: Projects support optional `notesMarkdown` as a scratchpad; editing is plain textarea in MVP and is available in Project Settings.

**Notes**:
Decisions and MVP scope are confirmed in `/home/sebherrerabe/.cursor/plans/implementation_plan_project_&_task_modules_cf2515cb.plan.md` (Projects section); acceptance criteria above is the “locked” interpretation of those decisions.

---

### TASK-06-002: UX spec for Projects surfaces

| Field            | Value                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| Assigned Persona | UX/UI Designer                                                         |
| Status           | complete                                                               |
| Depends On       | TASK-06-001                                                            |
| Deliverable      | Markdown wireframes/specs for Projects list + settings + nested routes |

**Description**:
Produce “Figma-style” markdown specs for:

- `/_app/projects` list (pinned section, filters, archived)
- project creation dialog
- `/_app/projects/$projectId/*` shell with tabs as routes (tasks/sessions/settings)
- settings page sections (repo multi-select + notes scratchpad)

**Acceptance Criteria**:

- [ ] Includes empty states, loading states, and error states.
- [ ] Defines interaction patterns for pinned/favorite toggles and archived view.
- [ ] Defines information hierarchy for list rows/cards (name, color label, repo count, etc.).

**Notes**:
Delivered in `projects/06-project-module/UX_SPEC.md`.

---

### TASK-06-003: Convex schema + functions for Projects

| Field            | Value                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| Assigned Persona | Convex Developer                                                       |
| Status           | complete                                                               |
| Depends On       | TASK-06-001                                                            |
| Deliverable      | `projects` schema updates + Convex CRUD functions with company scoping |

**Description**:
Implement or update:

- `projects` table fields (slug/color/isPinned/isFavorite/notesMarkdown)
- create/update/get/list/softDelete functions
- enforce unique project name per company
- auto-generate slug on create (stable in MVP)

**Acceptance Criteria**:

- [ ] All functions enforce company ownership and soft delete invariants.
- [ ] `listProjects` supports both active and archived views (or provides parameters to do so).
- [ ] Unique project name rule is enforced with a clear error message.

**Notes**:
Implemented in `convex/schema.ts` (table) and `convex/projects.ts` (functions).

---

### TASK-06-004: Projects UI implementation

| Field            | Value                                                       |
| ---------------- | ----------------------------------------------------------- |
| Assigned Persona | Frontend Engineer                                           |
| Status           | complete                                                    |
| Depends On       | TASK-06-002                                                 |
| Deliverable      | Working Projects list + creation + settings + nested routes |

**Description**:
Implement:

- `/_app/projects` list UI (pinned, search, repo filter, archived)
- project creation dialog
- nested routes under `/_app/projects/$projectId/*` including settings UI
- notes scratchpad editor (textarea MVP)

**Acceptance Criteria**:

- [ ] Uses consistent loading/empty/error states.
- [ ] Works within existing app shell + company context.
- [ ] Navigates via nested routes (tabs as routes).

---

### TASK-06-005: QA validation checklist for Projects

| Field            | Value                                               |
| ---------------- | --------------------------------------------------- |
| Assigned Persona | QA / Validation                                     |
| Status           | complete                                            |
| Depends On       | TASK-06-003                                         |
| Deliverable      | QA checklist covering invariants + key flows for 06 |

**Description**:
Create a focused checklist for Projects MVP:

- company scoping checks
- soft delete checks
- uniqueness + slug behavior
- list filters/archived view correctness

**Acceptance Criteria**:

- [ ] Checklist includes at least 10 high-signal test scenarios.
- [ ] Includes edge cases (duplicate name attempts, archived items visibility, empty states).

## Task Dependency Graph

```
TASK-06-001
├── TASK-06-002
│   └── TASK-06-004
└── TASK-06-003
    └── TASK-06-005
```

## Delegation Order

1. TASK-06-001 (can start immediately)
2. TASK-06-002, TASK-06-003 (parallel, after 001)
3. TASK-06-004 (after 002)
4. TASK-06-005 (after 003)
