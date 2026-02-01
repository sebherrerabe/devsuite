# Scope: Session Module

## In Scope

### Session Concepts & Terminology

- **Session**: A time-bounded container of work activity. Source of truth for time tracking, performance, and invoicing.
- **Session Status**: `RUNNING`, `PAUSED`, `FINISHED`, `CANCELLED` (no session = `IDLE`).
- **Effective Session Time**: Time accumulated only while the session is `RUNNING`.
- **Task Activity**: Tasks can be `ACTIVE` or `INACTIVE` within a session. Time counts only when the session is `RUNNING` and the task is `ACTIVE`.
- **Unallocated Time**: Time when the session is `RUNNING` but no tasks are `ACTIVE`.
- **Parallel Task Timing (Option A)**: Overlap is allowed; if multiple tasks are active simultaneously, each receives the full overlapping time.
- **Cancel Modes**:
  - `DISCARD`: Session activity is excluded from all summaries and default queries as if it never existed (soft-deleted/hidden, not hard-deleted).
  - `KEEP_EXCLUDED`: Session retained, visible in history with `CANCELLED` status, excluded from summaries by default.

### State Machines

#### Session State Machine

States: `IDLE`, `RUNNING`, `PAUSED`, `FINISHED`, `CANCELLED`

Transitions:

- `start`: `IDLE` → `RUNNING`
- `pause`: `RUNNING` → `PAUSED`
- `resume`: `PAUSED` → `RUNNING`
- `finish`: `RUNNING|PAUSED` → `FINISHED`
- `cancel`: `RUNNING|PAUSED` → `CANCELLED`

Rules:

- Only one active session per user at a time.
- `FINISHED` and `CANCELLED` are terminal.
- `PAUSED` implies no time accrual; all task timers stop accumulating.

#### Task Activity State (per session)

States: `INACTIVE`, `ACTIVE`

Transitions:

- `activate`: `INACTIVE` → `ACTIVE`
- `deactivate`: `ACTIVE` → `INACTIVE`
- `session_pause` implicitly pauses accumulation for all active tasks.

Rules:

- Tasks can be active even if the session is paused, but time does not accrue until session resumes.
- Multiple tasks can be active simultaneously (Option A overlap).

### Event Model (Source of Truth)

**Chosen Approach**: Append-only **event log** as source of truth. Work segments are derived from events for read models and reporting.

**Justification**:

- Robust to crashes/offline; timestamps are durable, replayable.
- Supports auditability and reconciliation when events arrive late/out of order.
- Easy to extend (notes, project assignment) without schema churn.

#### Event Record (canonical fields)

- `id`
- `companyId`
- `sessionId`
- `actorId`
- `type`
- `timestamp` (server timestamp)
- `clientTimestamp` (optional, for reconciliation)
- `payload` (type-specific)
- `createdAt`

#### Required Events

- `SESSION_STARTED(timestamp, sessionId, projectIds?)`
- `SESSION_PAUSED(timestamp)`
- `SESSION_RESUMED(timestamp)`
- `SESSION_FINISHED(timestamp)`
- `SESSION_CANCELLED(timestamp, cancelMode)`

Task events:

- `TASK_ACTIVATED(timestamp, taskId)`
- `TASK_DEACTIVATED(timestamp, taskId)`
- `TASK_MARKED_DONE(timestamp, taskId)`

Optional:

- `STEP_LOGGED(timestamp, text, taskId?)`
- `PROJECT_ASSIGNED_TO_SESSION(timestamp, projectId)`
- `PROJECT_UNASSIGNED_FROM_SESSION(timestamp, projectId)`

### Data Model (logical)

- **Session**
  - `id`, `companyId`, `createdBy`, `status`, `startAt`, `endAt?`
  - `cancelMode?`, `cancelledAt?`, `discardedAt?`
  - `projectIds[]` (derived from events or stored as denormalized read model)
  - `summary?`
  - `isExcludedFromSummaries` (true for `CANCELLED` and `DISCARD`)

- **SessionEvent** (append-only)
  - Canonical fields above

- **SessionTaskSummary** (derived/read model, not source of truth)
  - `sessionId`, `taskId`, `activeDurationMs`, `wasActive`, `wasCompleted`, `firstActivatedAt`, `lastDeactivatedAt`

- **SessionProjectSummary** (derived/read model)
  - `sessionId`, `projectId`, `activeDurationMs` (sum of tasks tied to project, overlap allowed)

Notes:

- Task status changes are stored on the Task entity as usual; the session records **that a task was marked done**, but does not own task state.
- No durations are stored as primary data; all durations are computed from events.

### Duration Calculation Rules

Definitions:

- **Running intervals**: time spans between `SESSION_STARTED`/`SESSION_RESUMED` and the next `SESSION_PAUSED`/`SESSION_FINISHED`/`SESSION_CANCELLED` event.
- **Task active intervals**: time spans between `TASK_ACTIVATED` and the next `TASK_DEACTIVATED` (or session end/cancel).

Rules:

1. **Effective session duration** = sum of all running intervals.
2. **Per-task duration** = sum of overlaps between each task’s active intervals and running intervals.
3. **Parallel tasks (Option A)**: Overlaps are allowed; per-task totals may exceed session duration.
4. **Per-project duration** = sum of durations of tasks associated with that project; overlaps allowed.
5. **Unallocated time** = running intervals minus the union of all active task intervals (periods where zero tasks active).

### Widget UX (Quick Start/Pause/Finish/Cancel)

- **Compact widget** anchored in global header / sidebar with hotkey access.
- **Primary controls**: Start, Pause/Resume, Finish, Cancel (with confirm + mode select).
- **Secondary controls**: quick add project(s), activate tasks, mark task done, add step/note.
- **Keyboard-first**: single shortcut to open widget, arrow navigation, enter to toggle actions.
- **Session status chip**: shows `RUNNING`/`PAUSED` plus elapsed effective time.
- **Active tasks list**: shows currently active tasks with quick toggle; supports multiple active tasks.
- **Resume suggestions**: when starting a new session, show a “resume?” list of unfinished tasks, but do not auto-activate; time starts only after explicit activation.

### Sessions List Page (Index)

- **Layout**: Same list/filter pattern used in Project list pages (header + filter bar + list cards).
- **Filters**: date range, project, status (`FINISHED`, `CANCELLED`), tags (optional).
- **Row/Card Content**:
  - Start/end timestamps
  - Effective session duration
  - Allocated task time summary (with overlap indicator if total > session duration)
  - Linked project(s)
  - Status chip
  - Quick access to details

### Session Detail Page

- **Layout**: Reuse Project page layout patterns (header, tabs/sections, optional side panel behavior).
- **Header**: status, start/end, effective duration, linked projects.
- **Activity Timeline**: ordered event feed (pause/resume, task activated/deactivated, steps, task done).
- **Task Summary**: list of tasks touched with computed durations (Option A overlap allowed).
- **Unallocated Time Indicator**: visual + numeric display.
- **Cancellation Details**: cancelMode (`DISCARD` vs `KEEP_EXCLUDED`) and what was kept/discarded.
- **Optional Export**: copy/share summary (markdown) or “create report” hook.

### Cancellation Policy & Data Retention

- Cancellation never reverts task status changes.
- `DISCARD`:
  - Session marked as discarded/soft-deleted.
  - Excluded from summaries and default queries.
  - Events retained for audit but hidden by default.
- `KEEP_EXCLUDED`:
  - Session remains visible in history with `CANCELLED` status.
  - Excluded from summaries by default but can be filtered in.

### Edge-Case Handling Checklist

- [ ] Session paused while tasks active: effective time stops; task timers stop implicitly.
- [ ] Session cancelled with active tasks: close open task intervals at cancel timestamp.
- [ ] Task marked done during cancelled session: task completion remains; session marked cancelled.
- [ ] App crash during RUNNING: on recovery, show “resume?” and allow user to close session at last known timestamp or continue; event log remains source of truth.
- [ ] Task active when session ends without explicit deactivation: close interval at session end.
- [ ] Session running with zero active tasks: counts as unallocated time and is visible.
- [ ] Rapid task switching: no debouncing required; events are ordered and durations computed by overlap.

## Out of Scope

- Automatic time guessing for unfinished tasks across sessions.
- Enforcing that sum of task durations equals session duration.
- Auto-activation of previous tasks when a new session starts.

## Boundaries

- Session management is separate from Task management; task status changes are recorded but not owned by Sessions.
- Sessions do not force task/project time totals to reconcile.

## Assumptions

- One running session per user.
- Users can associate multiple projects per session.
- Tasks can be activated/deactivated at any time during a running session.

## Open Questions

- [ ] How should overlapping project allocations be visualized when tasks from multiple projects are active simultaneously?
- [ ] Should `DISCARD` sessions be visible anywhere beyond admin/debug views?
