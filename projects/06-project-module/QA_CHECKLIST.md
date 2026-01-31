# QA Checklist: Project Module (06)

> Manual validation checklist for Project Module functionality, ensuring compliance with DevSuite invariants and UX specifications.

---

## Setup

**Prerequisites**:

- Run `pnpm dev` from workspace root
- Browser open to `http://localhost:5173`
- At least 2 test companies configured (for cross-company validation)
- At least 2 test repositories configured (for repo filter validation)

---

## Core Invariants (Required for All Modules)

### Soft Delete

- [ ] **No hard deletes**: Archiving a project sets `deletedAt` timestamp (verify in Convex dashboard)
- [ ] **Deleted projects excluded from default list**: Archived projects don't appear in main projects list
- [ ] **Deleted projects appear in archived view**: Toggling to "Archived" view shows soft-deleted projects
- [ ] **Restore not required for MVP**: Archived projects remain queryable but don't need UI restore (verify they stay archived)

### Company Scoping

- [ ] **Projects belong to one company**: Each project has `companyId` (verify in schema)
- [ ] **Create project uses current company**: New project automatically scoped to active company
- [ ] **Company switcher isolates projects**: Switch company → Projects list updates to show only that company's projects
- [ ] **Cross-company access blocked**: Cannot view/edit projects from other companies (try accessing project URL from different company)
- [ ] **Unique name per company enforced**: Creating two projects with same name in one company fails; same name in different companies succeeds

### Privacy Mode

- [ ] **N/A for Project Module**: Projects are always company-scoped (privacy mode doesn't apply)

### External References Only

- [ ] **Repository linking stores IDs only**: Project `repositoryIds` contains only IDs, not full repo data
- [ ] **Repository data fetched separately**: Project list/detail fetches repo metadata via join/query (not embedded)

---

## Module-Specific Functionality

### 1. Project Creation

- [ ] **Create project dialog opens**: Click "New Project" button from `/_app/projects`
- [ ] **Required fields enforced**: Name is required; form blocks submission if empty
- [ ] **Slug auto-generated**: Entering project name shows slug preview (read-only in MVP)
- [ ] **Optional fields work**: Description, color, repositories can be left empty
- [ ] **Color picker works**: Select from preset colors (6-8 tokens)
- [ ] **Repository multi-select works**: Can select zero, one, or multiple repositories
- [ ] **Optimistic UI**: Project appears in list immediately after submission
- [ ] **Keyboard shortcuts**: Enter submits form, Esc closes dialog
- [ ] **Duplicate name blocked**: Creating project with duplicate name shows error (same company)
- [ ] **Duplicate name allowed cross-company**: Same project name works in different company

### 2. Projects List (`/_app/projects`)

- [ ] **Pinned section visible**: Pinned projects appear in separate section at top
- [ ] **Pinned section hidden when empty**: No pinned section if no projects pinned
- [ ] **Color labels render**: Project color appears as dot/stripe next to name
- [ ] **Search filters list**: Typing in search filters projects by name (case-insensitive)
- [ ] **Repository filter works**: Selecting repository shows only projects linked to that repo
- [ ] **Clear filters works**: Clearing search/repo filter restores full list
- [ ] **Archived view toggle**: "Archived" toggle shows only soft-deleted projects
- [ ] **Active/Archived toggle switches**: Toggling between views updates list correctly
- [ ] **Row actions visible on hover**: Pin/Unpin, Settings link, Archive appear on hover
- [ ] **Pin/Unpin updates immediately**: Clicking pin moves project to/from pinned section
- [ ] **Empty state shown**: When no projects exist, "No projects found" + CTA appears
- [ ] **Empty state after filter**: When filter yields no results, appropriate empty state shows

### 3. Project Detail Shell (`/_app/projects/$projectId`)

- [ ] **Breadcrumbs render**: "Projects / Project Name" appears in header
- [ ] **Project name displayed**: Large title shows project name
- [ ] **Archived badge appears**: If project is archived, status badge shows "Archived"
- [ ] **Tabs navigation visible**: Tasks, Sessions, Settings tabs appear below header
- [ ] **Default tab is Tasks**: `/tasks` route loads by default
- [ ] **Tab switching works**: Clicking tabs updates URL and content
- [ ] **Direct URL navigation works**: Navigating directly to `/settings` or `/sessions` loads correct tab
- [ ] **404 for non-existent project**: Invalid project ID shows error page
- [ ] **Cross-company 404**: Accessing project from different company returns 404/error

### 4. Project Settings (`/_app/projects/$projectId/settings`)

- [ ] **Name field pre-filled**: Current project name appears in input
- [ ] **Description field pre-filled**: Current description (or empty) appears
- [ ] **Color picker shows current**: Current project color is selected
- [ ] **Repositories list shows current**: Linked repositories appear in list
- [ ] **Update name works**: Changing name + save updates project (verify in list)
- [ ] **Update description works**: Changing description + save persists
- [ ] **Change color works**: Selecting new color updates immediately (or on save)
- [ ] **Pin project toggle works**: "Pin Project" checkbox updates pinned status
- [ ] **Favorite toggle works**: "Favorite" checkbox updates favorite status (if implemented)
- [ ] **Link repository works**: "Link Repository" opens modal, selecting repo adds to list
- [ ] **Unlink repository works**: Removing repo from list removes association
- [ ] **Notes scratchpad saves**: Typing in notes markdown textarea + save persists content
- [ ] **Notes auto-save works (if implemented)**: Changes save after debounce delay
- [ ] **Archive project works**: "Archive Project" button soft-deletes project
- [ ] **Archive confirmation shown**: Confirmation dialog appears before archiving
- [ ] **Post-archive redirect**: After archiving, redirects to projects list
- [ ] **Archived project read-only (optional)**: Archived project settings may be read-only

### 5. Repository Filter

- [ ] **Filter dropdown populated**: Repository filter shows all company repositories
- [ ] **Select repository filters list**: Selecting repo shows only projects with that repo
- [ ] **Multiple repos OR logic**: Projects linked to ANY selected repo appear (if multi-select)
- [ ] **Clear filter restores list**: Clearing repo filter shows all projects
- [ ] **Filter persists during search**: Repo filter + search work together

### 6. Notes Scratchpad

- [ ] **Markdown textarea renders**: Plain textarea appears in settings
- [ ] **Save button visible**: Explicit "Save" button (or auto-save indicator) present
- [ ] **Content persists**: Notes saved and reloaded on page refresh
- [ ] **Large notes supported**: Can save notes with 1000+ characters
- [ ] **No rich rendering required**: MVP treats as plain text/scratchpad (not rendered HTML)

---

## UI/UX Validation

### Loading States

- [ ] **Projects list shows skeleton**: Loading state with skeleton rows appears initially
- [ ] **Project detail shows skeleton**: Loading project settings shows skeleton panel
- [ ] **No flash of empty content**: Loading indicators prevent empty state flash

### Empty States

- [ ] **No projects empty state**: "No projects found" with "Create Project" CTA
- [ ] **No pinned projects**: Pinned section hidden when no pinned projects
- [ ] **Search no results**: "No projects match your search" when search empty
- [ ] **Filter no results**: "No projects linked to this repository" when filter empty
- [ ] **Archived no results**: "No archived projects" when archived view empty

### Error States

- [ ] **Duplicate name error**: Clear error message when duplicate name attempted
- [ ] **Network error handling**: Failed save shows error toast with retry option
- [ ] **Validation errors inline**: Required field errors shown near inputs
- [ ] **404 page for invalid project**: Non-existent project ID shows helpful 404

### Realtime Updates

- [ ] **New project appears immediately**: Creating project in another tab updates list (Convex subscription)
- [ ] **Archive updates immediately**: Archiving project in another tab removes from list
- [ ] **Settings updates reflect**: Changing name in another tab updates list view
- [ ] **Multi-device sync**: Changes on one device appear on another (Convex realtime)

---

## Edge Cases & Guardrails

### Project Naming

- [ ] **Very long names handled**: Project name with 200+ characters (enforces limit or truncates)
- [ ] **Special characters allowed**: Names with emoji, unicode, punctuation work
- [ ] **Slug collision handled**: Two similar names generate unique slugs
- [ ] **Empty name blocked**: Cannot submit form with empty name

### Repository Association

- [ ] **Zero repositories allowed**: Can create project without linking repos
- [ ] **Many repositories allowed**: Can link 10+ repositories to one project
- [ ] **Soft-deleted repo handled**: Linking archived repo shows warning or filters out
- [ ] **Repository from other company blocked**: Cannot link repo from different company

### Archiving

- [ ] **Cannot archive twice**: Archiving archived project shows error or is no-op
- [ ] **Archived project tasks accessible**: Tasks tab still works for archived project (read-only?)
- [ ] **Restore not implemented**: No "Restore" button in MVP (verify archived projects stay archived)

### Performance

- [ ] **List with 100+ projects loads**: Large project list renders without lag
- [ ] **Search with 100+ projects responsive**: Search filters quickly
- [ ] **Repository filter with 50+ repos**: Filter dropdown usable with many repos

### Company Switching

- [ ] **Switch company mid-edit**: Switching companies while editing project redirects safely
- [ ] **Switch company clears state**: Project detail state clears when switching companies
- [ ] **Return to original company**: Switching back shows original projects correctly

---

## Validation Commands

```bash
# Start dev server
pnpm dev

# Run linter (after code changes)
pnpm lint

# Run type checking
pnpm typecheck

# Verify schema in Convex dashboard
# https://dashboard.convex.dev/t/[your-deployment]/functions
# Check `projects` table for `deletedAt`, `companyId`, `repositoryIds`
```

---

## Test Data Setup

### Minimal Test Data

1. Company A with 5 projects (2 pinned, 1 archived)
2. Company B with 3 projects (0 pinned, 1 archived)
3. Repository 1 linked to 2 projects in Company A
4. Repository 2 linked to 1 project in Company A, 1 in Company B

### Commands to Create Test Data (via UI)

1. Create Company A
2. Create 5 projects with varied names/colors
3. Pin 2 projects
4. Archive 1 project
5. Link Repository 1 to 2 projects
6. Switch to Company B
7. Create 3 projects
8. Archive 1 project

---

## Issue Severity Guide

- **HIGH**: Blocks core functionality, data loss risk, security issue
- **MEDIUM**: Degrades UX, workaround exists, affects subset of users
- **LOW**: Cosmetic, minor inconvenience, edge case

---

## Notes Section (for QA session findings)

**Date**: ******\_\_\_******  
**Validator**: ******\_\_\_******  
**Environment**: ******\_\_\_******

### Issues Found

| #   | Description | Severity | Status |
| --- | ----------- | -------- | ------ |
| 1   |             |          |        |
| 2   |             |          |        |
| 3   |             |          |        |

### Recommendations

1.
2.
3.

---

## References

- `projects/06-project-module/PROJECT.md` - Module overview
- `projects/06-project-module/SCOPE.md` - Scope boundaries
- `projects/06-project-module/UX_SPEC.md` - UX specifications
- `AGENTS.md` - Repository invariants
