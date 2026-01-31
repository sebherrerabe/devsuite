# UX Spec: Project Module (06)

## Design Brief

### Users & Goals

- **Primary User**: Developer/Manager needing to organize distinct streams of work.
- **Top Jobs**:
  1.  Create and configure a new project workspace.
  2.  Switch context between projects quickly.
  3.  Manage project-level metadata (repos, notes, settings).

### Constraints

- **Platform**: Desktop-first.
- **Tenancy**: Company-scoped.
- **Visuals**: "Linear-lite" — clean, dense, minimal chrome.

---

## Information Architecture

### Sitemap

| Path                        | Screen            | Purpose                             | Key Actions                           |
| :-------------------------- | :---------------- | :---------------------------------- | :------------------------------------ |
| `/_app/projects`            | **Projects List** | Directory of all active projects.   | Create Project, Search, Archive View. |
| `/_app/projects/$projectId` | **Project Shell** | Layout wrapper for project context. | Context switching, Tabs navigation.   |
| `.../tasks`                 | **Task Tree**     | _See Task Module Spec (07)._        | Manage tasks.                         |
| `.../sessions`              | **Sessions**      | _Future Module._                    | View active work sessions.            |
| `.../settings`              | **Settings**      | Configuration & Metadata.           | Edit Name, Link Repos, Notes.         |

---

## Page Specs

### 1. Projects List (`/_app/projects`)

**Layout**:

- **Header**: Title "Projects" + Primary Action "New Project" (Button).
- **Toolbar**: Search input (icon left), Filter (Repos), View Toggle (Active/Archived).

**Content Sections**:

1.  **Pinned Projects** (Grid or distinct list)
    - _Only visible if pinned projects exist._
    - Cards: Color stripe, Name, Repo icons.
2.  **All Projects** (Table/List)
    - Columns: Name (with color dot), Key/Slug, Repository Count, Last Updated.
    - Row Actions: Pin/Unpin, Settings (Link), Archive.
3.  **Empty State**
    - "No projects found." + "Create Project" button.

### 2. Project Creation Dialog

**Trigger**: "New Project" button from List or Command Palette.

**Form Fields**:

1.  **Name** (Required, text): Auto-generates slug preview.
2.  **Description** (Optional, text area).
3.  **Repositories** (Multi-select, optional): "Link repositories...".
4.  **Color** (Radio group/Picker): 6-8 preset tokens.

**Interaction**:

- **Enter** submits form.
- **Esc** closes dialog.
- **Optimistic UI**: Immediate appearance in list.

### 3. Project Detail Shell (`/_app/projects/$projectId/*`)

**Layout**:

- **Breadcrumbs**: `Projects / Project Name`.
- **Header**:
  - Left: Title (Large), Status badge (if archived).
  - Right: "Add Task" (Global shortcut), "Share/Copy Link".
- **Tabs Navigation** (Below header, sticky):
  - `Tasks` (Default)
  - `Sessions`
  - `Settings`

### 4. Project Settings (`.../settings`)

**Layout**: Two-column or Single-column focused measure.

**Sections**:

1.  **General**:
    - Name (Input).
    - Description (Textarea).
    - Color (Picker).
    - **Actions**: "Pin Project", "Favorite".
2.  **Repositories**:
    - List of linked repos.
    - "Link Repository" button (opens selection modal).
3.  **Notes (Scratchpad)**:
    - Simple Markdown Textarea (Monospace font optional).
    - "Save" button (or auto-save debounced).
4.  **Danger Zone**:
    - "Archive Project" (Soft delete).
    - "Delete Project" (Requires confirmation, standard invariants).

---

## UI Direction

- **Colors**: Use project-specific colors for avatars/badges only; keep UI monochrome/slate.
- **Density**: High. List rows ~40px height.
- **Feedback**: Toast notifications for "Project Created", "Settings Saved".
