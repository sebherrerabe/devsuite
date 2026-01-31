# Scope: Project Module

## In Scope

### Entities

- Project: company-scoped container for work (tasks + sessions), optionally linked to repositories.

### Data model (Convex)

- **Projects (`projects`)**:
  - **Scoping**: belongs to one company (`companyId`)
  - **Core fields**: `name`, `description?`
  - **Repository association**: `repositoryIds: Id<"repositories">[]`
  - **UX fields**:
    - `slug?`
    - `color?`
    - `isFavorite?`
    - `isPinned?`
  - **Docs**:
    - `notesMarkdown?: string | null` (optional markdown notes)
  - **Soft delete**:
    - `deletedAt` (no hard delete)
  - **Timestamps**:
    - `createdAt`, `updatedAt`

### Functionality

- Create a project within a company.
- Enforce unique project name per company.
- Auto-generate `slug` on project creation (not user-editable in MVP).
- Update project fields (name, description, repositoryIds, pinned/favorite, color, notesMarkdown).
- List projects by company:
  - default list excludes deleted
  - include an archived view (deletedAt != null) in the UI
- Get a project by id (company-scoped authorization enforced).
- Soft-delete a project (no hard delete).

### UI Components (Web)

- Projects list page (`/_app/projects`)
  - pinned section
  - color labels
  - search
  - filter by repository
  - archived view
- Project creation dialog
- Project detail area with nested routes (tabs as routes):
  - `/_app/projects/$projectId/tasks` (task tree for the project; implemented in Project surface, but owned by Task module)
  - `/_app/projects/$projectId/sessions` (stub surface for now)
  - `/_app/projects/$projectId/settings`
    - repository multi-select
    - project notes editor (markdown textarea MVP; treated as scratchpad, not rich docs)

## Out of Scope

- Kanban/timeline project views (deferred).
- Multi-user/project membership/roles (single-player).
- Project analytics dashboards beyond basic “summary placeholders”.
- Repository mirroring (DevSuite stores references only).
- Project hard deletes or destructive bulk deletes.

## Boundaries

### Boundary 1: Tasks are owned by Task Module (07)

- Project module provides project shell/surface and selection.
- Task creation/edit/tree behavior and data rules are implemented in 07.

### Boundary 2: Sessions are owned by Session Module (08)

- Project module provides navigation surface only.
- Session CRUD, linking tasks to sessions, and session views are implemented in 08.

## Assumptions

- A company context exists in the app shell and is required for all project operations.
- Repositories module (05) exists and provides repository IDs for association.

## Open Questions

- [ ] Do we enforce unique project names per company, or allow duplicates? (owner: @product-manager)
- [ ] Do we generate `slug` automatically or let user edit it? (owner: @product-manager)
