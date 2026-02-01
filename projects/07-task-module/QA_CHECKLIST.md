# QA Checklist: Task Module (07)

> Manual validation checklist for Task Module functionality, ensuring compliance with DevSuite invariants, hierarchy constraints, and UX specifications.

---

## Setup

**Prerequisites**:

- Run `pnpm dev` from workspace root
- Browser open to `http://localhost:5173`
- At least 2 test companies configured (for cross-company validation)
- At least 2 test projects configured (for project-scoped vs company-scoped tasks)
- At least 5 company tags configured in Company Settings (for tag validation)

---

## Core Invariants (Required for All Modules)

### Soft Delete

- [ ] **No hard deletes**: Deleting a task sets `deletedAt` timestamp (verify in Convex dashboard)
- [ ] **Deleted tasks excluded from queries**: Deleted tasks don't appear in tree or global views
- [ ] **Subtree soft delete**: Deleting parent task soft-deletes all descendants
- [ ] **Undo mechanism**: After delete, "Undo" toast appears (session-scoped)
- [ ] **Undo restores subtree**: Clicking "Undo" restores parent + all descendants

### Company Scoping

- [ ] **Tasks belong to one company**: Each task has `companyId` (verify in schema)
- [ ] **Create task uses current company**: New task automatically scoped to active company
- [ ] **Company switcher isolates tasks**: Switch company → Task tree updates to show only that company's tasks
- [ ] **Cross-company access blocked**: Cannot view/edit tasks from other companies (try accessing task URL from different company)
- [ ] **Global tasks filtered by company**: `/_app/tasks` shows only current company's tasks

### Privacy Mode

- [ ] **N/A for Task Module**: Tasks are always company-scoped (privacy mode doesn't apply to task tree)
- [ ] **Global tasks respect company scope**: Today/Upcoming/Overdue views show current company only

### External References Only

- [ ] **External links store URLs/IDs only**: `external_links` table contains URL + title, not full content
- [ ] **GitHub PR link stores URL + title**: No PR description, comments, or diff stored
- [ ] **Notion link stores URL + title**: No page content stored
- [ ] **TickTick link stores URL + title**: No task details stored
- [ ] **Graceful degradation**: External links work even if external system unavailable

---

## Module-Specific Functionality

### 1. Task Creation (Project Scoped)

- [ ] **Enter creates sibling task**: Press Enter on task → new task appears as sibling below
- [ ] **Focus moves to new task**: New task title input receives focus immediately
- [ ] **Empty task can be deleted**: Pressing Backspace on empty task removes it
- [ ] **Task persists after blur**: Creating task + clicking away saves task
- [ ] **Optimistic UI**: Task appears immediately before server confirmation
- [ ] **Initial sortKey computed**: New task has correct `sortKey` to maintain order

### 2. Task Tree Hierarchy (Max Depth = 3)

- [ ] **Root tasks (depth 1)**: Can create tasks at root level (no parent)
- [ ] **Child tasks (depth 2)**: Can create child of root task
- [ ] **Grandchild tasks (depth 3)**: Can create child of child task
- [ ] **Depth 3 blocks indent**: Attempting to indent depth-3 task shows error
- [ ] **Depth indicator visible**: Visual indent guides show task depth (1/2/3)
- [ ] **Max depth message clear**: "Max depth (3) reached" toast or inline message appears

### 3. Keyboard Operations (Indent/Outdent)

- [ ] **Tab indents task**: Press Tab → task becomes child of previous sibling (when valid)
- [ ] **Tab blocked at depth 3**: Pressing Tab on depth-3 task shows error
- [ ] **Tab blocked with no previous sibling**: Cannot indent first task in list
- [ ] **Shift+Tab outdents task**: Press Shift+Tab → task moves up one level
- [ ] **Shift+Tab blocked at root**: Cannot outdent root-level task
- [ ] **Focus preserved after indent/outdent**: Focus stays on moved task

### 4. Reordering (Keyboard)

- [ ] **Alt+↑ moves task up**: Press Alt+↑ → task swaps with sibling above (same parent)
- [ ] **Alt+↓ moves task down**: Press Alt+↓ → task swaps with sibling below (same parent)
- [ ] **Alt+↑ blocked at top**: Cannot move first sibling up (no-op or message)
- [ ] **Alt+↓ blocked at bottom**: Cannot move last sibling down (no-op or message)
- [ ] **sortKey updates**: Reordering updates `sortKey` field (verify in Convex)
- [ ] **Order persists after reload**: Reordering + refresh shows same order

### 5. Drag-and-Drop (DnD) Reordering

- [ ] **Drag handle visible**: 6-dot grip icon appears on left of task row
- [ ] **Drag initiates on grip**: Dragging grip starts DnD operation
- [ ] **Line indicator shows drop zone**: Dragging shows line between tasks (reorder as sibling)
- [ ] **Highlight shows reparent zone**: Dragging over task highlights it (drop as child)
- [ ] **Drop reorders sibling**: Dropping between tasks reorders within same parent
- [ ] **Drop reparents task**: Dropping on task makes dragged task a child
- [ ] **Invalid drop blocked (max depth)**: Cannot drop if result would exceed depth 3
- [ ] **Invalid drop blocked (cycle)**: Cannot drop parent onto its own descendant
- [ ] **Invalid drop shows message**: Hovering invalid drop zone shows error cursor/tooltip
- [ ] **Cross-project drop blocked**: Cannot drag task from Project A to Project B

### 6. Task Detail Sheet

- [ ] **Click task opens sheet**: Clicking task row (non-input areas) opens side sheet
- [ ] **Sheet slides in from right**: Sheet animates in, pushes content or overlays
- [ ] **Title editable**: Large title input allows editing task name
- [ ] **Status dropdown works**: Can change status (todo, in_progress, blocked, done, cancelled)
- [ ] **Due date picker works**: Can select/clear due date
- [ ] **Complexity slider works**: Slider shows 1-10 range, updates score
- [ ] **Description textarea works**: Can edit description (markdown-friendly)
- [ ] **Notes textarea works**: Can edit notes (markdown scratchpad)
- [ ] **Save persists changes**: Changes save immediately or on explicit "Save" button
- [ ] **Close button works**: Clicking "Close" or Esc closes sheet
- [ ] **Sheet shows breadcrumbs**: Parent > Child hierarchy visible in header
- [ ] **Copy link works**: "Copy Link" button copies task URL to clipboard

### 7. External Links Management

- [ ] **Add link input visible**: "Add Link" section appears in task sheet
- [ ] **URL input accepts URL**: Can paste/type URL
- [ ] **Title input required**: Cannot submit without title
- [ ] **Title prefilled (optional)**: Pasting URL may prefill title (best-effort)
- [ ] **Title editable**: User can edit prefilled or add custom title
- [ ] **Add link persists**: Clicking "Add" saves link to `external_links` table
- [ ] **Link list renders**: Added links appear in list (icon + title + URL)
- [ ] **Remove link works**: Clicking remove button soft-deletes link
- [ ] **Link types supported**: GitHub PR, GitHub Issue, Notion, TickTick, generic URL all work
- [ ] **Link opens in new tab**: Clicking link URL opens in new browser tab

### 8. Tags Management (Company Tag Set)

- [ ] **Tag multi-select visible**: Tag selector appears in task sheet
- [ ] **Tag list populated**: Shows all company tags (from `tags` table)
- [ ] **Select tag assigns to task**: Selecting tag adds to `tagIds` array
- [ ] **Deselect tag removes from task**: Deselecting tag removes from `tagIds`
- [ ] **Multiple tags allowed**: Can assign multiple tags to one task
- [ ] **Tag pills render**: Selected tags appear as pills/badges in task sheet and tree row
- [ ] **Create tag inline (optional)**: If implemented, can create new tag from task sheet
- [ ] **Archived tags hidden**: Soft-deleted tags don't appear in selector
- [ ] **Tags scoped to company**: Switching companies shows different tag set

### 9. Task Status & Completion

- [ ] **Checkbox toggles status**: Clicking checkbox marks task as done (or cycles status)
- [ ] **Strikethrough on done**: Completed tasks show strikethrough text
- [ ] **Cmd/Ctrl+Enter completes**: Keyboard shortcut marks task done
- [ ] **Status dropdown updates checkbox**: Changing status via sheet updates checkbox
- [ ] **Cancelled status supported**: Can set status to cancelled (distinct from done)

### 10. Subtree Deletion

- [ ] **Delete button visible**: "Delete" action appears in task sheet or row actions
- [ ] **Confirmation modal appears**: Deleting task with children shows "Delete X subtasks?" modal
- [ ] **Subtask count accurate**: Modal shows correct count of descendants
- [ ] **Delete with no children**: Deleting leaf task skips confirmation (or shows simple confirm)
- [ ] **Confirm deletes subtree**: Confirming soft-deletes parent + all descendants
- [ ] **Cancel aborts delete**: Clicking "Cancel" closes modal, no deletion
- [ ] **Undo toast appears**: After delete, "Task deleted. [Undo]" toast shows
- [ ] **Undo restores subtree**: Clicking "Undo" clears `deletedAt` for parent + descendants
- [ ] **Undo timeout**: Undo toast disappears after timeout (session-scoped)

### 11. Global Tasks Views (`/_app/tasks`)

- [ ] **Today view renders**: Tasks with `dueDate` = today appear
- [ ] **Today includes all statuses**: Todo, in_progress, blocked, done, cancelled all visible (default)
- [ ] **Today hide completed toggle**: Toggling "Hide completed" filters out done/cancelled
- [ ] **Upcoming view renders**: Tasks with `dueDate` > today appear
- [ ] **Upcoming grouped by date (optional)**: Tasks grouped into Tomorrow, Next Week, etc.
- [ ] **Upcoming hide completed toggle**: Toggle filters out done/cancelled
- [ ] **Overdue view renders**: Tasks with `dueDate` < today appear
- [ ] **Overdue excludes completed**: Done/cancelled never appear in Overdue (by design)
- [ ] **Overdue badge shows count**: Red badge with overdue count appears
- [ ] **Empty state per filter**: Each filter shows appropriate empty state when no tasks
- [ ] **Click task opens sheet**: Clicking task in global view opens detail sheet
- [ ] **Timezone handling**: Due dates respect user's local timezone (verify with tasks near midnight)

### 12. Cycle Prevention

- [ ] **Cannot parent to self**: Attempting to make task its own parent shows error
- [ ] **Cannot parent to descendant**: Cannot move parent task to become child of its descendant
- [ ] **DnD blocks invalid drops**: Hovering parent over its descendant shows error cursor
- [ ] **Keyboard indent blocks invalid**: Tab on task that would create cycle shows error
- [ ] **Deep nesting cycle check**: Cycle detection works with depth-3 hierarchies

### 13. Cross-Project Task Constraints

- [ ] **Project task has projectId**: Tasks created in `/_app/projects/$projectId/tasks` have `projectId` set
- [ ] **Company task has no projectId**: Tasks created in `/_app/tasks` have `projectId = null`
- [ ] **Project task parent validation**: Project task's parent must have same `projectId`
- [ ] **Company task parent validation**: Company task's parent must also be company task (no `projectId`)
- [ ] **Cannot move project task to company**: DnD from project tree to company task list blocked (if exposed)
- [ ] **Cannot move company task to project**: DnD from company task list to project tree blocked (if exposed)

### 14. Ordering Persistence

- [ ] **sortKey generated on create**: New task has `sortKey` computed from siblings
- [ ] **sortKey updates on reorder**: Dragging task updates `sortKey` in DB
- [ ] **Order persists after reload**: Refresh page → tasks appear in same order
- [ ] **Order consistent across devices**: Reorder on Device A → Device B shows same order (Convex sync)
- [ ] **Fractional indexing works**: Inserting task between two tasks computes correct `sortKey`

### 15. Task Notes Scratchpad

- [ ] **Notes textarea in sheet**: Markdown textarea appears in "Notes" section
- [ ] **Notes save on blur/explicit save**: Typing notes + blur (or "Save" button) persists content
- [ ] **Notes reload correctly**: Reopening task sheet shows saved notes
- [ ] **Large notes supported**: Can save notes with 1000+ characters
- [ ] **No rich rendering required**: MVP treats as plain text (not rendered markdown)

---

## UI/UX Validation

### Loading States

- [ ] **Task tree shows skeleton**: Loading state with skeleton rows appears initially
- [ ] **Task sheet shows skeleton**: Opening sheet shows skeleton panel while loading
- [ ] **Global tasks show skeleton**: Today/Upcoming/Overdue views show loading state

### Empty States

- [ ] **No tasks in project**: "No tasks yet. Press Enter to create one."
- [ ] **No tasks in global view**: "No tasks due today." (per filter)
- [ ] **Search no results**: "No tasks match your search." (if search implemented)
- [ ] **Filter no results**: "No tasks match your filters." (if filters exist)

### Error States

- [ ] **Network error handling**: Failed save shows error toast with retry option
- [ ] **Validation errors inline**: Required field errors shown near inputs
- [ ] **Max depth error clear**: "Max depth (3) reached" message visible
- [ ] **Cycle error clear**: "Cannot create circular dependency" message visible
- [ ] **Duplicate sortKey handled**: Backend resolves sortKey collisions gracefully

### Realtime Updates

- [ ] **New task appears immediately**: Creating task in another tab updates tree (Convex subscription)
- [ ] **Reorder updates immediately**: Reordering task in another tab updates tree
- [ ] **Status change syncs**: Marking task done in another tab updates checkbox
- [ ] **Delete syncs**: Deleting task in another tab removes from tree
- [ ] **Multi-device sync**: Changes on one device appear on another (Convex realtime)

---

## Command Palette (Cmd/Ctrl+K)

### Opening & Closing

- [ ] **Cmd/Ctrl+K opens palette**: Pressing shortcut opens centered modal
- [ ] **Esc closes palette**: Pressing Esc closes modal
- [ ] **Click outside closes**: Clicking outside modal closes it
- [ ] **Opening clears previous search**: Re-opening palette clears previous input

### Keyboard Navigation

- [ ] **Arrow keys navigate results**: ↑/↓ keys highlight items in list
- [ ] **Enter selects item**: Pressing Enter on highlighted item performs action
- [ ] **Tab navigates sections**: Tab key moves between Projects/Tasks sections (optional)
- [ ] **Type to search**: Typing filters results in real-time

### Scoping & Results

- [ ] **Projects section populated**: Shows all company projects (not archived)
- [ ] **Tasks section populated**: Shows all company tasks (project + company tasks)
- [ ] **Search filters projects**: Typing filters project list by name
- [ ] **Search filters tasks**: Typing filters task list by title
- [ ] **Recent items prioritized (optional)**: Recently accessed items appear at top
- [ ] **Results scoped to company**: Only current company's projects/tasks appear

### Navigation Actions

- [ ] **Select project navigates**: Selecting project goes to `/_app/projects/$projectId/tasks`
- [ ] **Select task opens sheet**: Selecting task opens task detail sheet
- [ ] **Navigate updates URL**: Selecting item updates browser URL
- [ ] **Back button works**: Browser back button returns from navigated page

### Edge Cases

- [ ] **Empty results handled**: "No projects found" / "No tasks found" messages
- [ ] **Very long task titles**: Long titles truncate with ellipsis in palette
- [ ] **100+ tasks**: Palette scrolls or paginates with many results
- [ ] **Search with special chars**: Searching with emoji, unicode works correctly

---

## Edge Cases & Guardrails

### Hierarchy Operations

- [ ] **Move root task to child**: Can indent root task (if prev sibling exists)
- [ ] **Move depth-3 task to root**: Can outdent depth-3 task multiple times
- [ ] **Reorder across parent boundaries**: Cannot reorder task to different parent's siblings (DnD/keyboard blocked)
- [ ] **Orphan tasks prevented**: Deleting parent doesn't orphan children (soft-deletes subtree)

### Task Complexity

- [ ] **Complexity 1-10 enforced**: Slider/input limits to 1-10 range
- [ ] **Complexity null allowed**: Can unset complexity (no value)
- [ ] **Complexity display**: Complexity score appears in task row (right side)

### Due Date Edge Cases

- [ ] **Due date at midnight**: Task due at 00:00 appears in "Today" correctly
- [ ] **Due date in past**: Past-due tasks appear in "Overdue"
- [ ] **Due date far future**: Tasks years in future appear in "Upcoming"
- [ ] **Clear due date**: Can remove due date from task (set to null)

### External Links Edge Cases

- [ ] **Very long URLs**: 500+ char URLs truncate or wrap in link list
- [ ] **Very long titles**: 200+ char titles truncate with ellipsis
- [ ] **Invalid URL format**: Adding malformed URL shows validation error
- [ ] **Duplicate URLs allowed**: Can add same URL multiple times (different titles)
- [ ] **Remove last link**: Removing only link leaves empty list (no error)

### Tags Edge Cases

- [ ] **Zero tags allowed**: Task can have no tags assigned
- [ ] **10+ tags allowed**: Can assign many tags to one task
- [ ] **Tag from other company blocked**: Cannot assign tag from different company
- [ ] **Archived tag removed**: Archiving tag removes from task's `tagIds` (or shows warning)

### Performance

- [ ] **Tree with 100+ tasks renders**: Large task tree loads without lag
- [ ] **Deep nesting (depth 3) with many siblings**: 50+ siblings at depth 3 renders correctly
- [ ] **Reorder with 100+ tasks responsive**: DnD remains responsive with large list
- [ ] **Global view with 200+ tasks**: Today/Upcoming views handle many tasks

### Company Switching

- [ ] **Switch company mid-edit**: Switching companies while editing task redirects safely
- [ ] **Switch company clears state**: Task tree state clears when switching companies
- [ ] **Return to original company**: Switching back shows original tasks correctly

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
# Check `tasks` table for:
#   - companyId, projectId (nullable), parentTaskId (nullable)
#   - sortKey, dueDate, complexityScore
#   - tagIds (array), notesMarkdown
#   - deletedAt
# Check `external_links` table for:
#   - companyId, taskId, type, url, title
#   - deletedAt
# Check `tags` table for:
#   - companyId, name
#   - deletedAt
```

---

## Test Data Setup

### Minimal Test Data

1. **Company A**:
   - Project 1 with 10 tasks (3-level hierarchy with 3 tasks at depth 3)
   - Project 2 with 5 tasks (flat list, no children)
   - 5 company-level tasks (no projectId)
   - 10 tags ("bug", "feature", "urgent", etc.)
2. **Company B**:
   - Project 1 with 8 tasks (2-level hierarchy)
   - 3 company-level tasks
   - 5 tags

### Task Due Dates for Testing

- 2 tasks due yesterday (overdue)
- 5 tasks due today (today view)
- 3 tasks due tomorrow (upcoming)
- 4 tasks due next week (upcoming)
- 3 tasks with no due date

### External Links for Testing

- Task 1: 2 GitHub PR links
- Task 2: 1 Notion link
- Task 3: 1 TickTick link + 1 generic URL
- Task 4: No links

---

## Issue Severity Guide

- **HIGH**: Blocks core functionality, data loss risk, security issue, invariant violation
- **MEDIUM**: Degrades UX, workaround exists, affects subset of users
- **LOW**: Cosmetic, minor inconvenience, edge case

---

## Notes Section (for QA session findings)

**Date**: **\*\***\_\_\_**\*\***
**Validator**: **\*\***\_\_\_**\*\***
**Environment**: **\*\***\_\_\_**\*\***

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

- `projects/07-task-module/PROJECT.md` - Module overview
- `projects/07-task-module/SCOPE.md` - Scope boundaries
- `projects/07-task-module/UX_SPEC.md` - UX specifications
- `AGENTS.md` - Repository invariants
