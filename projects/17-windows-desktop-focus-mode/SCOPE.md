# Scope: Windows Desktop App + Strict Focus Mode

## In Scope

Windows-only desktop runtime for DevSuite sessions and focus enforcement.

### Entities

- Desktop Installation Profile: app version, install channel, Windows device metadata.
- Focus Policy: company/user-scoped policy for strict mode, grace windows, reminder cadence.
- IDE Watch List: configured IDE process names and matching behavior.
- Distractor Block List: configured executable targets and enforcement policy (`warn`, `close_after_grace`).
- Website Block List: configured domain patterns and response policy (`warn_only`, `escalate`).
- Enforcement Event Log: append-only records for prompts, reminders, process actions, and user overrides.
- Notification Rules: mapping from session/task state to Windows native toast notifications.

### Functionality

- Electron-based Windows desktop shell with authenticated session to existing backend.
- System tray and session widget with quick actions (`Start`, `Pause`, `Resume`, `End`).
- Native Windows notifications for:
  - no-active-session while coding
  - session milestones (start/break/end)
  - reminder escalation when tasks remain open
- Windows process monitoring for IDE launch detection (`cursor`, `code`, `idea64`, and configurable additions).
- Desktop-only settings model (user + company scoped) for:
  - IDE watch list
  - app block list
  - website block list
  - policy parameters (strictness mode, grace period, reminder cadence)
- Strict mode policy engine:
  - detect IDE launch with no active session
  - prompt for immediate session start
  - escalate reminders by configured schedule
  - optional process close for non-compliant flow after grace period
- Distractor app handling during active session:
  - detect configured non-work apps
  - warn user
  - optionally close app after grace period
- Website distractor handling during active session:
  - evaluate configured blocked domains via desktop-compatible signal (active browser URL signal when available)
  - warn/escalate using native notifications
  - record policy outcomes in audit events
- Audit and observability:
  - every policy action logged with actor, timestamp, decision, and target process
  - fail-safe mode if enforcement service is unavailable

### UI Components (if applicable)

- Desktop main window shell (embedded DevSuite app + desktop-only navigation entry).
- Always-available tray menu with session and strict-mode controls.
- Compact session widget for current session timer and one-click actions.
- Strict mode settings page:
  - IDE watch list editor
  - distractor app list editor
  - website block list editor
  - reminder cadence and grace-period configuration
  - enforcement mode toggles (`prompt_only`, `prompt_then_close`)
- Activity/audit panel for enforcement event history.

## Out of Scope

- macOS or Linux desktop support.
- Kernel-level tamper-proof controls, drivers, or enterprise endpoint-management hooks.
- Network-layer blocking (DNS/firewall) of websites.
- Guaranteed forced website closure across all browsers without browser-specific integration.
- Keystroke logging, screen capture, or surveillance-style telemetry.
- Full offline-first behavior and local conflict resolution.

## Deferred Scope: Offline Features (Not in Initial Execution)

Offline capability is intentionally deferred. This project only captures requirements and a follow-up plan.

- Local queue for session events and enforcement logs when backend is unavailable.
- Read-only cached task/session snapshot for degraded mode visibility.
- Deferred sync with idempotent replay after connectivity recovery.
- Offline notification behavior with stale-data disclaimers.
- Conflict-resolution strategy for policy/task updates modified while offline.

## Boundaries

### Boundary 1

Enforcement stays at user-space process monitoring and policy-driven app control. The system does not attempt irreversible lockout mechanisms.

### Boundary 2

Desktop client consumes backend session/task APIs and does not redefine domain ownership for session/task lifecycle.

### Boundary 3

Any app termination action must be reversible in policy (disable/opt-out) and fully auditable.

### Boundary 4

Desktop-specific infrastructure (Electron main/preload, process watchers, tray controls) must remain isolated from `apps/web` runtime to prevent web regressions.

### Boundary 5

Website blocking policy is configuration-driven and desktop-enforced; hard blocking mechanisms that require OS/network controls are deferred.

## Assumptions

- Initial release targets Windows 10/11.
- Users can grant permissions required for process inspection and notifications.
- Organization policy permits local app monitoring for focus enforcement use case.
- Existing session/task models from upstream projects are stable enough for desktop consumption.
- Initial distribution is local/self-use only (no public installer hosting in this phase).
- Web app remains a first-class runtime and cannot regress because of desktop feature delivery.

## Open Questions

- [ ] Should strict mode default to `prompt_only` or `prompt_then_close` for first rollout? (owner: @product)
- [ ] What is the minimum legal/compliance copy required for app monitoring consent? (owner: @legal)
- [ ] Which task states count as "remaining tasks" for escalation reminders? (owner: @backend)
- [ ] Which existing web notifications should remain browser-native vs desktop-native in parity mode? (owner: @platform)
- [ ] What browser integration level is required for website block-list enforcement in MVP (`warn/escalate` only vs active tab intervention)? (owner: @platform)
