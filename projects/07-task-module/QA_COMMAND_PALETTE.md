# QA Checklist: Command Palette (Cmd/Ctrl+K)

> Focused validation checklist for the global Command Palette functionality within the Task Module (07).

---

## Setup

**Prerequisites**:

- Run `pnpm dev` from workspace root
- Browser open to `http://localhost:5173`
- At least 2 test companies configured
- At least 3 test projects with varied names (for search testing)
- At least 10 tasks with varied titles (for search testing)
- Test data includes: project with space in name, task with emoji, task with very long title

---

## Core Functionality

### Opening & Closing

- [ ] **Cmd/Ctrl+K opens palette**: Pressing keyboard shortcut opens modal
- [ ] **Works from any page**: Shortcut works from projects list, task tree, settings, etc.
- [ ] **Modal centers on screen**: Palette appears in center of viewport
- [ ] **Backdrop appears**: Dark/blurred backdrop appears behind modal
- [ ] **Esc closes palette**: Pressing Esc closes modal
- [ ] **Click outside closes**: Clicking backdrop closes modal
- [ ] **Re-opening clears previous state**: Opening palette again clears previous search input
- [ ] **Focus moves to input**: Opening palette focuses search input immediately

### Keyboard Navigation

- [ ] **Arrow Down (↓) moves to next item**: Highlights next result in list
- [ ] **Arrow Up (↑) moves to previous item**: Highlights previous result in list
- [ ] **Down wraps to top**: Pressing ↓ on last item wraps to first item
- [ ] **Up wraps to bottom**: Pressing ↑ on first item wraps to last item
- [ ] **Enter selects highlighted item**: Pressing Enter performs action on highlighted result
- [ ] **Tab moves between sections**: Tab key cycles between Projects/Tasks sections (if sectioned)
- [ ] **Shift+Tab moves back**: Shift+Tab cycles backward between sections
- [ ] **Keyboard nav preserves highlight**: Highlight remains visible during navigation

### Mouse Navigation

- [ ] **Hover highlights item**: Hovering over result highlights it
- [ ] **Click selects item**: Clicking result performs action
- [ ] **Scroll works**: Can scroll through results with mouse wheel
- [ ] **Mouse + keyboard interop**: Using mouse after keyboard nav works correctly

---

## Scoping & Filtering

### Company Scoping

- [ ] **Results scoped to current company**: Only current company's projects/tasks appear
- [ ] **Company switcher updates results**: Switching companies + reopening palette shows new company's data
- [ ] **Cross-company items hidden**: Projects/tasks from other companies never appear

### Search Filtering

- [ ] **Type to filter projects**: Typing filters project list by name (real-time)
- [ ] **Type to filter tasks**: Typing filters task list by title (real-time)
- [ ] **Case-insensitive search**: "project" matches "Project", "PROJECT", etc.
- [ ] **Partial match works**: "proj" matches "My Project", "Project Alpha"
- [ ] **Word boundary match (optional)**: "alpha" matches "Project Alpha Beta"
- [ ] **No results shows message**: Search with no matches shows "No results found"
- [ ] **Clear input restores full list**: Deleting search text shows all items again
- [ ] **Search across both sections**: Results update in Projects AND Tasks simultaneously

### Result Prioritization (Optional/MVP)

- [ ] **Recent items at top**: Recently accessed projects/tasks appear first (if implemented)
- [ ] **Exact match prioritized**: Exact name match appears before partial match
- [ ] **Projects before tasks (or vice versa)**: Consistent ordering of sections

---

## Navigation Actions

### Project Navigation

- [ ] **Select project navigates to tasks**: Selecting project goes to `/_app/projects/$projectId/tasks`
- [ ] **URL updates correctly**: Browser URL changes to correct project route
- [ ] **Palette closes after navigation**: Modal closes after selecting project
- [ ] **Back button works**: Browser back returns from navigated project
- [ ] **Navigation preserves state**: Navigating to project loads correct task tree

### Task Actions

- [ ] **Select task opens sheet**: Selecting task opens task detail side sheet
- [ ] **Task sheet opens with correct task**: Sheet shows data for selected task
- [ ] **Palette closes after selecting task**: Modal closes after opening sheet
- [ ] **Task from any project works**: Can open task from any project via palette
- [ ] **Company-level task works**: Selecting company task (no projectId) opens sheet correctly

### Global Actions (Optional/Future)

- [ ] **"Create new project" action**: If implemented, creates project dialog
- [ ] **"Create new task" action**: If implemented, creates task in current context
- [ ] **Actions appear in results**: Action items appear in search results (distinct from data items)

---

## Result Display

### Project Results

- [ ] **Project name displayed**: Full project name appears in result
- [ ] **Project color indicator**: Color dot/stripe appears next to name
- [ ] **Project icon/avatar**: Icon appears if implemented
- [ ] **Truncation for long names**: Project names > 50 chars truncate with ellipsis
- [ ] **Archived projects excluded**: Soft-deleted projects don't appear

### Task Results

- [ ] **Task title displayed**: Full task title appears in result
- [ ] **Task status indicator**: Checkbox or status badge appears
- [ ] **Task due date (optional)**: Due date appears if set (e.g., "Due: Today")
- [ ] **Task project context**: Project name appears as subtitle/breadcrumb
- [ ] **Truncation for long titles**: Task titles > 60 chars truncate with ellipsis
- [ ] **Deleted tasks excluded**: Soft-deleted tasks don't appear
- [ ] **Completed tasks included (or filtered)**: Done/cancelled tasks appear or are filtered based on design

### Section Headers

- [ ] **"Projects" header visible**: Section header appears above project results
- [ ] **"Tasks" header visible**: Section header appears above task results
- [ ] **Result count displayed (optional)**: "Projects (3)" shows count
- [ ] **Empty section hidden (optional)**: Section with no results may be hidden

---

## Edge Cases

### Empty States

- [ ] **No projects in company**: "No projects found" message appears
- [ ] **No tasks in company**: "No tasks found" message appears
- [ ] **Search returns zero results**: "No results found" message appears
- [ ] **Empty state includes hint**: Message suggests trying different search terms

### Performance

- [ ] **100+ projects render quickly**: Large project list appears without lag
- [ ] **100+ tasks render quickly**: Large task list appears without lag
- [ ] **Search filters responsively**: Real-time filtering has no noticeable delay
- [ ] **Scroll performance**: Scrolling through 200+ results is smooth
- [ ] **Virtualization (optional)**: Long lists use virtualization for performance

### Special Characters

- [ ] **Search with spaces**: "my project" matches "My Project"
- [ ] **Search with emoji**: "🚀" matches tasks/projects with emoji in title
- [ ] **Search with unicode**: "café" matches "Café Project"
- [ ] **Search with punctuation**: "project-alpha" matches correctly
- [ ] **Search with numbers**: "2024" matches "Project 2024"

### Very Long Titles

- [ ] **Project name 100+ chars**: Displays with truncation + ellipsis
- [ ] **Task title 200+ chars**: Displays with truncation + ellipsis
- [ ] **Tooltip shows full text (optional)**: Hovering truncated text shows full title

### Context Switching

- [ ] **Open from project page**: Works correctly from `/_app/projects`
- [ ] **Open from task tree**: Works correctly from `/_app/projects/$projectId/tasks`
- [ ] **Open from global tasks**: Works correctly from `/_app/tasks`
- [ ] **Open from settings**: Works correctly from `/_app/settings/*`
- [ ] **Open with task sheet open**: Works correctly with side sheet already open
- [ ] **Open mid-edit**: Opening palette while editing task doesn't break edit state

### Multi-Device Sync

- [ ] **New project appears**: Creating project on Device A → appears in palette on Device B (Convex sync)
- [ ] **New task appears**: Creating task on Device A → appears in palette on Device B
- [ ] **Deleted project disappears**: Archiving project removes from palette results
- [ ] **Renamed project updates**: Renaming project updates palette results immediately

---

## Accessibility

### Keyboard Accessibility

- [ ] **Fully keyboard navigable**: Can open, search, navigate, select without mouse
- [ ] **Tab order logical**: Tab moves through elements in logical order
- [ ] **Focus visible**: Focused/highlighted items have visible indicator
- [ ] **Screen reader compatible (if tested)**: Announces results and actions

### Visual Accessibility

- [ ] **High contrast mode works**: Palette visible in high contrast mode
- [ ] **Focus indicators visible**: Highlight/focus states clearly visible
- [ ] **Font size legible**: Text readable at default browser zoom
- [ ] **Color not sole indicator**: Status/state not conveyed by color alone

---

## Error Handling

### Network Errors

- [ ] **Failed query handled**: If query fails, shows error message
- [ ] **Retry option provided**: Error message includes "Retry" button
- [ ] **Graceful degradation**: Palette remains usable if data fetch slow

### Invalid States

- [ ] **Invalid project ID handled**: Selecting stale project ID shows 404 page
- [ ] **Invalid task ID handled**: Selecting stale task ID shows error or closes sheet
- [ ] **Concurrent deletion handled**: Task deleted by another user while palette open shows gracefully

---

## Validation Commands

```bash
# Start dev server
pnpm dev

# Test keyboard shortcuts in browser console
# Verify event listener attached:
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    console.log('Cmd/Ctrl+K detected');
  }
});
```

---

## Test Data Setup

### Minimal Test Data

1. **Company A**:
   - 5 projects: "Alpha", "Beta Project", "🚀 Rocket", "Project with Very Long Name That Should Truncate", "Archived Project" (archived)
   - 10 tasks: varied titles including emoji, long titles, completed tasks
2. **Company B**:
   - 3 projects: "Gamma", "Delta", "Epsilon"
   - 5 tasks

### Edge Case Data

- Project name: "Project 2024 (Q4) – Planning & Execution 🎯" (100+ chars)
- Task title: "Implement authentication flow with OAuth2.0, JWT tokens, and refresh mechanism including rate limiting and security headers" (150+ chars)
- Project/task with emoji: "🚀", "✅", "🔥"
- Project/task with unicode: "Café", "Niño"

---

## Issue Severity Guide

- **HIGH**: Command palette doesn't open, keyboard nav broken, navigation fails
- **MEDIUM**: Search filtering inconsistent, scoping issues, performance lag
- **LOW**: Cosmetic issues, truncation edge cases, minor UX polish

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
- `projects/07-task-module/SCOPE.md` - Task module scope
- `projects/07-task-module/UX_SPEC.md` - UX specifications (Command Palette section)
- Implementation Plan - Command Palette section (Phase 5)
