# Tasks: Task Module

## Task Breakdown

### TASK-07-001: Lock acceptance criteria & edge cases (Tasks)

| Field            | Value                                                      |
| ---------------- | ---------------------------------------------------------- |
| Assigned Persona | Product Manager                                            |
| Status           | complete                                                   |
| Depends On       | none                                                       |
| Deliverable      | Final acceptance criteria + edge-case decisions for 07 MVP |

**Description**:
Finalize “done” definitions and edge-case decisions for the Task module MVP, including global views semantics, company tasks scope, tag management UX, and command palette scope.

**Acceptance Criteria**:

- [x] **Company scoping**: All Tasks, Tags, and External Links are scoped to the current company; cross-company access/listing is impossible.
- [x] **No hard deletes**: Tasks, tags, and external links are never hard-deleted; all deletions are soft deletes (`deletedAt`).
- [x] **Task scope types**:
  - [x] A task is either a **project task** (`projectId` set) or a **company task** (`projectId` absent/null), and both are company-scoped.
  - [x] Company tasks do **not** appear in any project task tree; they appear only in the global tasks surface (`/_app/tasks`).
- [x] **Move / hierarchy constraints**:
  - [x] **No cross-project moves**: a task cannot be moved between projects (cannot change `projectId` via move/reparent/reorder).
  - [x] **No project↔company moves**: a project task cannot be moved into the company-task tree, and a company task cannot be moved into a project.
  - [x] **Sibling↔child reparenting allowed** within the same scope: sibling → child (indent) and child → sibling (outdent), as long as constraints below are satisfied.
  - [x] **Cycle prevention**: reparenting is rejected if it would make a task its own ancestor/descendant (no parenting to self or any descendant).
  - [x] **Max depth = 3**: the tree supports at most 3 levels (root = depth 1; child = depth 2; grandchild = depth 3). Any operation that would create depth 4 is rejected.
- [x] **Ordering**:
  - [x] Task ordering is persisted via `sortKey` among siblings (same `parentTaskId`) and remains stable across reloads.
- [x] **Delete + undo (subtree)**:
  - [x] Deleting a task soft-deletes the entire subtree (task + all descendants).
  - [x] Delete confirmation includes the number of tasks that will be deleted (subtree count).
  - [x] Undo is available via a toast and is **session-only** (does not survive reload or a new session).
- [x] **Global tasks semantics** (`/_app/tasks`):
  - [x] **Today**: includes tasks due today (local timezone); default view hides done/cancelled with a toggle to show them.
  - [x] **Upcoming**: includes tasks due after today (local timezone); default view hides done/cancelled with a toggle to show them.
  - [x] **Overdue**: includes tasks due before today (local timezone) and **excludes** done/cancelled (always).
- [x] **External links (MVP)**:
  - [x] External links are stored as references only (no mirroring content).
  - [x] Each external link stores a `title`, and in MVP the title is user-provided (best-effort prefill is allowed but must be editable and saved).
- [x] **Complexity (MVP)**:
  - [x] Uses `complexityScore` integer 1–10 (optional); the previous enum complexity is not used.
- [x] **Notes (MVP)**:
  - [x] Tasks support optional `notesMarkdown` as a scratchpad (plain textarea MVP).
- [x] **Global command palette (MVP)**:
  - [x] Opens with Cmd/Ctrl+K.
  - [x] Scope is projects + tasks only (for the current company).
  - [x] Selecting a project navigates to it; selecting a task opens it in the task side sheet.

**Notes**:
Decisions and MVP scope are confirmed in `/home/sebherrerabe/.cursor/plans/implementation_plan_project_&_task_modules_cf2515cb.plan.md` (Tasks section); acceptance criteria above is the “locked” interpretation of those decisions.

---

### TASK-07-002: UX spec for Task tree + Task sheet + Global tasks + Command palette

| Field            | Value                                        |
| ---------------- | -------------------------------------------- |
| Assigned Persona | UX/UI Designer                               |
| Status           | complete                                     |
| Depends On       | TASK-07-001                                  |
| Deliverable      | Markdown wireframes/specs for 07 UI surfaces |

**Description**:
Produce “Figma-style” markdown specs for:

- project task tree surface (`/_app/projects/$projectId/tasks`)
  - DnD + keyboard reorder (Alt+↑/↓) + indent/outdent (Tab/Shift+Tab)
  - drop affordances (reorder vs reparent)
  - depth=3 indicators + error messaging
- task detail side sheet
  - due date picker, complexity slider (1–10), tags selector, notes scratchpad, links manager
- global tasks (`/_app/tasks`)
  - Today/Upcoming/Overdue, hide completed toggle, empty states
- global command palette (Cmd/Ctrl+K)
  - search results layout for projects + tasks, keyboard navigation, “open task sheet” behavior

**Acceptance Criteria**:

- [ ] Specifies focus rules after create/complete.
- [ ] Specifies confirm+undo UX for subtree delete (count shown).
- [ ] Includes loading/empty/error states for each surface.

**Notes**:
Delivered in `projects/07-task-module/UX_SPEC.md`.

---

### TASK-07-003: Convex schema + rules for Tasks/Links/Tags

| Field            | Value                                                       |
| ---------------- | ----------------------------------------------------------- |
| Assigned Persona | Convex Developer                                            |
| Status           | complete                                                    |
| Depends On       | TASK-07-001                                                 |
| Deliverable      | Schema updates + core Convex functions enforcing invariants |

**Description**:
Implement the data layer changes required by the merged plan:

- Tasks are company-scoped with optional `projectId`
- Persisted ordering via `sortKey`
- `dueDate` for global filters
- `complexityScore` 1–10 (drop enum)
- `notesMarkdown` scratchpad
- Replace embedded external links with `external_links` table (with `title`)
- Add managed `tags` table and `tagIds` on tasks
- Enforce: no cycles, max depth 3, no cross-project moves, subtree soft delete

**Acceptance Criteria**:

- [ ] Every function enforces company ownership + soft delete invariants.
- [ ] Reparent/reorder operations are validated server-side (cycle prevention + depth <= 3).
- [ ] Subtree delete soft-deletes descendants deterministically.
- [ ] Tags are company-scoped and soft-deletable; tasks reference tags via `tagIds`.

**Notes**:
Implemented in `convex/schema.ts` and core functions in `convex/tasks.ts`, `convex/externalLinks.ts`, `convex/tags.ts`.

---

### TASK-07-004: Backend contract review (non-Convex business logic)

| Field            | Value                                                |
| ---------------- | ---------------------------------------------------- |
| Assigned Persona | Backend Engineer                                     |
| Status           | complete                                             |
| Depends On       | TASK-07-003                                          |
| Deliverable      | API contract/rules review notes + edge-case coverage |

**Description**:
Review the Convex function contracts and ensure rules are coherent:

- uniqueness/validation patterns
- error handling consistency
- timezone semantics for global filters (documented expectations)
- undo semantics (session-only) and how UI should call “undo” (e.g., restore deletedAt)

**Acceptance Criteria**:

- [ ] Produces a short markdown note of required validations + expected error cases.
- [ ] Calls out any missing indexes needed for performance.

---

### TASK-07-005: Frontend implementation — Task tree + Task sheet

| Field            | Value                                                      |
| ---------------- | ---------------------------------------------------------- |
| Assigned Persona | Frontend Engineer                                          |
| Status           | in-progress                                                |
| Depends On       | TASK-07-002                                                |
| Deliverable      | Working project task tree + side sheet with keyboard + DnD |

**Description**:
Implement:

- task tree surface in `/_app/projects/$projectId/tasks`
- keyboard create/indent/outdent + keyboard reorder (Alt+↑/↓)
- DnD reorder/reparent with depth=3 enforcement + messaging
- task side sheet editing (due date, complexityScore, tags, notes, external links)
- confirm+undo flow for subtree delete (session-only undo)

**Acceptance Criteria**:

- [ ] Focus rules match spec.
- [ ] Invalid operations are blocked with clear feedback.
- [ ] Uses consistent loading/empty/error patterns.

---

### TASK-07-006: Frontend implementation — Global tasks view

| Field            | Value                                                |
| ---------------- | ---------------------------------------------------- |
| Assigned Persona | Frontend Engineer                                    |
| Status           | complete                                             |
| Depends On       | TASK-07-002                                          |
| Deliverable      | Working `/_app/tasks` views (Today/Upcoming/Overdue) |

**Description**:
Implement:

- global tasks page with Today/Upcoming/Overdue
- default hide done/cancelled toggle in Today/Upcoming
- empty states per filter

**Acceptance Criteria**:

- [ ] Filtering semantics match spec (including Overdue exclusions).
- [ ] Company-level tasks are included here (and not in project trees).

---

### TASK-07-007: Frontend implementation — Global command palette (Projects + Tasks only)

| Field            | Value                                                   |
| ---------------- | ------------------------------------------------------- |
| Assigned Persona | Frontend Engineer                                       |
| Status           | complete                                                |
| Depends On       | TASK-07-002                                             |
| Deliverable      | Cmd/Ctrl+K palette: search + navigate + open task sheet |

**Description**:
Implement a global command palette integrated in the app shell:

- opens with Cmd/Ctrl+K
- searches across projects and tasks (current company)
- actions: navigate to project, open task in side sheet

**Acceptance Criteria**:

- [ ] Keyboard navigation works end-to-end.
- [ ] Respects company scoping and privacy expectations (no cross-company results).

---

### TASK-07-008: QA validation checklist for Tasks/Tree/Filters

| Field            | Value                                               |
| ---------------- | --------------------------------------------------- |
| Assigned Persona | QA / Validation                                     |
| Status           | complete                                            |
| Depends On       | TASK-07-003                                         |
| Deliverable      | QA checklist covering invariants + key flows for 07 |

**Description**:
Create a test plan/checklist covering:

- scoping (company + project)
- hierarchy operations (reparent, reorder, depth=3, cycle prevention)
- subtree delete + undo (session-only)
- global views filtering (including hide completed toggle)
- external links (title requirements + list/remove)
- tag set management and tag assignment on tasks

**Acceptance Criteria**:

- [ ] Checklist includes at least 15 high-signal scenarios, including edge cases.

## Task Dependency Graph

```
TASK-07-001
├── TASK-07-002
│   ├── TASK-07-005
│   ├── TASK-07-006
│   └── TASK-07-007
└── TASK-07-003
    ├── TASK-07-004
    └── TASK-07-008
```

## Delegation Order

1. TASK-07-001 (can start immediately)
2. TASK-07-002, TASK-07-003 (parallel, after 001)
3. TASK-07-005, TASK-07-006, TASK-07-007 (after 002)
4. TASK-07-004, TASK-07-008 (after 003)
