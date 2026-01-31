# Scope: Task Module

## In Scope

### Entities

- Task: hierarchical unit of work, company-scoped, optionally linked to a project.
- ExternalLink: normalized references from tasks to external systems (GitHub/Notion/TickTick/URL) with user-provided titles (MVP).

### Data model (Convex)

#### Tasks (`tasks`)

- **Scoping**
  - `companyId: Id<"companies">` (required; tenant boundary)
  - `projectId?: Id<"projects"> | null`
    - project task when set
    - company-level task when null/absent
- **Hierarchy**
  - `parentTaskId?: Id<"tasks"> | null`
  - **Max depth = 3** (enforced in backend and UI)
  - **No cycles** (cannot parent to self or descendant)
  - Parent/child scope constraint:
    - if child has `projectId`, parent must have same `projectId`
    - if child has no `projectId`, parent must also have no `projectId`
- **Ordering**
  - `sortKey: string` (fractional indexing / LexoRank-style)
  - Ordering is defined among siblings (same `parentTaskId`) and is persisted
- **Scheduling**
  - `dueDate: number | null` (timestamp ms; required for Today/Upcoming/Overdue)
- **Metadata**
  - `status: todo | in_progress | blocked | done | cancelled`
  - `complexityScore: number | null` (integer 1–10; enum complexity is out of scope)
  - `description?: string` (markdown-friendly text)
  - Tags (managed tag set):
    - `tagIds: Id<"tags">[]` (references a per-company managed tag set)
  - `metadata: any`
- **Docs**
  - `notesMarkdown?: string | null` (optional markdown notes)
- **Soft delete**
  - `deletedAt` (no hard delete)
  - **delete subtree**: soft-delete task + all descendants

#### External links (`external_links`)

- **Purpose**: store external references without mirroring content, but allow a human-readable title.
- **Fields (MVP)**
  - `companyId: Id<"companies">`
  - `taskId: Id<"tasks">`
  - `type: github_pr | github_issue | notion | ticktick | url`
  - `url: string`
  - `title: string` (user-provided for MVP; later can be fetched via integrations/HTTP)
  - `identifier?: string` (optional)
  - `metadata?: any` (optional; keep minimal for MVP)
- **Soft delete**: `deletedAt` (no hard delete)

### Functionality

- Task CRUD (create/update/get/list) with strict company scoping and soft delete.
- Hierarchy operations:
  - reparent sibling → child
  - reparent child → sibling
  - prevent cycles
  - enforce max depth = 3
  - enforce “no cross-project moves”
- Ordering operations:
  - reorder within same parent by updating `sortKey`
  - compute initial sortKey on create
- Due date support:
  - set/unset dueDate on tasks
  - global filtering semantics (see below)
- External link management:
  - add external link (title required)
  - remove external link (soft delete)
  - list external links for a task
- Tag set management (company-scoped):
  - create/update/soft-delete tags
  - list tags by company
  - task sheet selects tags from this set (not freeform strings)

### UI Components (Web)

- Project task tree surface (`/_app/projects/$projectId/tasks`)
  - hierarchical tree view (collapsible)
  - drag-and-drop reorder + reparent (with max depth enforcement)
  - keyboard-first flows:
    - Enter creates sibling
    - Tab indents (make child) / Shift+Tab outdents
    - Alt+↑ / Alt+↓ reorders within siblings
    - Cmd/Ctrl+K search/command (MVP: task search)
  - depth=3 affordances:
    - visible depth indicator (indent guides/level markers)
    - block invalid drops/indents with clear messaging (“Max depth (3) reached”)
  - open task in a side sheet for editing
- Task detail side sheet
  - status, due date, complexityScore slider (1–10)
  - description + notes markdown editors (MVP: textarea)
  - external links manager (title required)
  - tag multi-select sourced from company tag set
- Global tasks view (`/_app/tasks`)
  - Today / Upcoming / Overdue filters
  - quick, practical default presentation (flat list; grouping can be added later)
  - Today/Upcoming default: hide done/cancelled with a toggle (“Show completed/cancelled”)
  - empty states for each filter

### Global Tasks (“My Tasks”) semantics

All global task views are scoped to the current company.

- **Today**: dueDate is today (local timezone); includes all statuses.
- **Upcoming**: dueDate after today (local timezone); includes all statuses.
- **Overdue**: dueDate before today (local timezone); **excludes** done and cancelled.

## Out of Scope

- Moving tasks across projects (explicitly forbidden).
- Unlimited nesting (max depth is 3 for now).
- Assignees, teams, permissions beyond company ownership (single-player).
- Kanban/timeline task views.
- Full external-system sync or mirroring (references only).
- Rich markdown rendering/editor (MVP can be plain textarea; rich editor deferred).
- Advanced recurrence/scheduling rules beyond dueDate.

## Boundaries

### Boundary 1: Company/project scoping & selection

- Task module relies on existing company context and project selection surfaces.
- Ownership checks are enforced in Convex functions; UI consumes scoped APIs.

### Boundary 2: Sessions linking (08)

- Task selector component and task linking in sessions is downstream work.

## Assumptions

- Projects exist (06) and are company-scoped.
- Current app shell provides company context consistently (`CompanyProvider`).
- Soft delete is the only deletion mechanism (repo invariant).

## Open Questions

- [ ] Should company-level tasks appear inside project task tree surfaces, or only in `/_app/tasks`? (owner: @product-manager)
- [ ] Should tags be freeform or constrained to a per-company tag set? (owner: @product-manager)
