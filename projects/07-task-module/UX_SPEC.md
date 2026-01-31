# UX Spec: Task Module (07)

## Design Brief

### Users & Goals

- **Primary User**: Individual Contributor capturing and executing work.
- **Top Jobs**:
  1.  Capture tasks rapidly (keyboard-only).
  2.  Organize tasks hierarchically (breakdown work).
  3.  Execute daily via global views (Today/Upcoming).

### Constraints

- **Interaction**: "Linear-lite" — heavy keyboard usage.
- **Performance**: Optimistic updates for all tree operations.
- **Data**: Max depth = 3.

---

## Information Architecture

### Sitemap

| Path                        | Screen                | Purpose                                   | Key Actions                      |
| :-------------------------- | :-------------------- | :---------------------------------------- | :------------------------------- |
| `/_app/tasks`               | **Global Tasks**      | "My Tasks" view (Today/Upcoming/Overdue). | Triage, Complete, Reschedule.    |
| `/_app/projects/$pid/tasks` | **Project Task Tree** | Main hierarchical view.                   | Create, Indent/Outdent, Reorder. |
| **Overlay**                 | **Task Side Sheet**   | Detail view for any task.                 | Edit metadata, notes, links.     |
| **Overlay**                 | **Command Palette**   | Global navigation & command runner.       | Jump to project, Search tasks.   |

---

## Page Specs

### 1. Project Task Tree (`.../tasks`)

**Layout**:

- Located within Project Shell > Tasks Tab.

**Component: The Tree**

- **Structure**: Recursive list of nodes.
- **Node Anatomy**:
  - **Grip**: 6 dots icon (drag handle).
  - **Checkbox**: Circular (unchecked) / Check+Strike (completed).
  - **Content**: Title Input (Text).
  - **Metadata** (Right aligned): Tags (Pills), Due Date (Text), Complexity (Score).
  - **Actions** (Hover): Edit (opens Sheet), Delete (Soft).

**Empty States**:

- **Project Empty**: "No tasks yet. Press Enter to create one."
- **Filter Empty**: "No tasks match your filters."

### 2. Task Side Sheet (Overlay)

**Trigger**: Click task row (non-edit areas) or "Edit" action.
**Behavior**: Slides in from right. Pushes content or overlays (Mobile: Full screen).

**Content**:

1.  **Header**:
    - Breadcrumbs (Parent > Child).
    - Actions: "Copy Link", "Delete", "Close".
2.  **Main Properties**:
    - **Title**: Large input.
    - **Status**: Dropdown (Todo, In Progress, Blocked, Done, Cancelled).
    - **Complexity**: Slider/Input (1-10).
    - **Due Date**: Date Picker.
3.  **Tags**:
    - Multi-select from Company Tags.
    - "Create Tag" inline option.
4.  **External Links**:
    - List of links (Icon + Title + URL).
    - "Add Link" input: [URL] + [Title (Pre-filled/Edit)].
5.  **Notes**:
    - Markdown Editor (Textarea).
    - Placeholder: "Add details, acceptance criteria..."

### 3. Global Tasks (`/_app/tasks`)

**Layout**:

- **Header**: "My Tasks".
- **Tabs/Sections**:
  - **Overdue**: (Red count badge). Collapsible.
  - **Today**: Default open.
  - **Upcoming**: Grouped by date (Tomorrow, Next Week).

**View Options**:

- Toggle: "Show completed/cancelled" (Default: Off).

### 4. Command Palette (Cmd/Ctrl+K)

**Layout**: Centered modal.
**Sections**:

1.  **Navigation**: "Go to Project X..."
2.  **Tasks**: "Search tasks..." (Recent/Search results).
3.  **Actions**: "Create new project", "Create task".

---

## Interaction Model

### Keyboard Shortcuts (Tree)

| Key                | Action                                       | Context                                |
| :----------------- | :------------------------------------------- | :------------------------------------- |
| **Enter**          | Create new sibling task below current.       | Focus moves to new task title.         |
| **Tab**            | Indent current task (become child of above). | Blocked if depth > 3.                  |
| **Shift+Tab**      | Outdent current task.                        |                                        |
| **Alt + ↑/↓**      | Reorder task among siblings.                 | Updates `sortKey`.                     |
| **Cmd/Ctrl+Enter** | Complete task.                               |                                        |
| **Backspace**      | Delete empty task.                           | If task has content, confirm required. |

### Drag and Drop (DnD)

- **Handles**: Explicit drag grip on left of task row.
- **Drop Zones**:
  - **Line Indicator**: Drop **between** tasks (reorder).
  - **Highlight**: Drop **on** task (reparent/make child).
- **Constraints**:
  - **Max Depth**: Prevent drop if it would exceed depth 3. Show "Max depth reached" toast/tooltip.
  - **Cycles**: Prevent dropping parent onto its own child.
  - **Scope**: Cannot drag project task to another project (if cross-project view exists).

### Subtree Deletion

- **Trigger**: Deleting a parent task.
- **Modal**: "Delete this task and X subtasks?"
- **Undo**: Toast notification "Task deleted. [Undo]" (Session-scoped).

---

## States & Validation

- **Loading**:
  - Tree: Skeleton rows (3-4 bars).
  - Sheet: Spinner/Skeleton panel.
- **Error**:
  - "Failed to save task." (Toast + Retry action).
- **Guardrails**:
  - **Depth 3**: Visual indication (indentation stops) + Toast on attempt.
  - **Cycle**: Invalid drop target styling (red outline/cursor).
