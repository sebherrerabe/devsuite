# Tasks: Windows Desktop App + Strict Focus Mode

## Task Breakdown

### Execution Rule: TDD First

All implementation tasks in this project follow test-driven development:

- define failing tests first (unit/integration/E2E as appropriate)
- implement minimum code to pass tests
- refactor while keeping all tests green
- no task is complete without tests that prove expected behavior

### TASK-17-001: Finalize Windows-Only Product Contract

| Field            | Value                                              |
| ---------------- | -------------------------------------------------- |
| Assigned Persona | Product Manager + Tech Lead                        |
| Status           | pending                                            |
| Depends On       | none                                               |
| Deliverable      | Approved scope, policy defaults, and UX guardrails |

**Description**:
Lock down MVP behavior for strict mode, reminder escalation, and user-facing consent/copy for app monitoring.

**Acceptance Criteria**:

- [ ] Approve strict mode defaults (`prompt_only` vs `prompt_then_close`).
- [ ] Approve supported IDE seed list and distractor app policy.
- [ ] Approve legal/compliance copy for monitoring and process actions.
- [ ] Document escalation timing and override flow.

---

### TASK-17-002: Scaffold `apps/desktop` Electron Workspace

| Field            | Value                          |
| ---------------- | ------------------------------ |
| Assigned Persona | Platform Engineer              |
| Status           | pending                        |
| Depends On       | TASK-17-001                    |
| Deliverable      | Electron app shell in monorepo |

**Description**:
Create the Windows desktop application package and integrate pnpm workspace scripts.

**Acceptance Criteria**:

- [ ] Add `apps/desktop` with Electron main/renderer process structure.
- [ ] Reuse shared contracts from `@devsuite/shared` without cross-layer violations.
- [ ] Add local dev commands for desktop run/build.
- [ ] Verify lint/typecheck pass for workspace changes.

---

### TASK-17-003: Implement Auth + Tenant Session Bridge

| Field            | Value                                     |
| ---------------- | ----------------------------------------- |
| Assigned Persona | Backend Engineer + Platform Engineer      |
| Status           | pending                                   |
| Depends On       | TASK-17-002                               |
| Deliverable      | Desktop auth/session integration contract |

**Description**:
Ensure desktop runtime can authenticate users and safely access tenant-scoped data/actions.

**Acceptance Criteria**:

- [ ] Desktop login/session persistence works across app restarts.
- [ ] Tenant context is enforced for all task/session operations.
- [ ] Tokens/secrets remain in secure storage pathways.
- [ ] Logout fully clears local auth material.

---

### TASK-17-004: Implement Desktop Focus Settings Contract

| Field            | Value                                     |
| ---------------- | ----------------------------------------- |
| Assigned Persona | Backend Engineer + Frontend Engineer      |
| Status           | pending                                   |
| Depends On       | TASK-17-003                               |
| Deliverable      | Desktop-only settings model + settings UX |

**Description**:
Implement user-configurable desktop focus settings, scoped by company and user, with desktop-only enforcement semantics.

**Acceptance Criteria**:

- [ ] Add settings schema for IDE watch list, app block list, website block list, and policy parameters.
- [ ] Add settings UI editor with validation and safe defaults.
- [ ] Enforce desktop-only behavior; web may edit/view but never enforce.
- [ ] Add audit trail for settings changes.
- [ ] Add tests covering schema validation and persistence behavior.

---

### TASK-17-005: Build Session Widget + Tray Controls

| Field            | Value                                 |
| ---------------- | ------------------------------------- |
| Assigned Persona | Frontend Engineer + Platform Engineer |
| Status           | pending                               |
| Depends On       | TASK-17-003, TASK-17-004              |
| Deliverable      | Widget/tray UX for session lifecycle  |

**Description**:
Add Windows tray integration and compact widget for zero-friction session control.

**Acceptance Criteria**:

- [ ] Tray icon/menu exposes `Start`, `Pause`, `Resume`, `End`.
- [ ] Widget shows current timer/state and updates in real time.
- [ ] Main window is not required for core session actions.
- [ ] Error and disconnected states are clear and recoverable.

---

### TASK-17-006: Implement Native Windows Notifications

| Field            | Value                                   |
| ---------------- | --------------------------------------- |
| Assigned Persona | Platform Engineer                       |
| Status           | pending                                 |
| Depends On       | TASK-17-005                             |
| Deliverable      | Windows toast notifications integration |

**Description**:
Create native notification delivery for session and reminder events.

**Acceptance Criteria**:

- [ ] Session start/break/end notifications trigger correctly.
- [ ] "IDE opened without session" prompt notification triggers reliably.
- [ ] Notification actions route user into app/session flow.
- [ ] Notification throttling avoids spam during repeated events.

---

### TASK-17-007: Build Windows Process Detection Service

| Field            | Value                                   |
| ---------------- | --------------------------------------- |
| Assigned Persona | Platform Engineer                       |
| Status           | pending                                 |
| Depends On       | TASK-17-003, TASK-17-004                |
| Deliverable      | Local process watcher for policy engine |

**Description**:
Implement process monitoring for configured IDEs and distractor applications.

**Acceptance Criteria**:

- [ ] Detect process start/stop events for configured executable names.
- [ ] Support dynamic config updates without app restart.
- [ ] Record structured process events for audit/debug.
- [ ] Monitoring overhead remains acceptable on developer machines.

---

### TASK-17-008: Implement Strict Mode Policy Engine

| Field            | Value                                        |
| ---------------- | -------------------------------------------- |
| Assigned Persona | Backend Engineer + Platform Engineer         |
| Status           | pending                                      |
| Depends On       | TASK-17-006, TASK-17-007                     |
| Deliverable      | Deterministic policy rules and action runner |

**Description**:
Translate policy config into deterministic actions for reminders and enforcement.

**Acceptance Criteria**:

- [ ] Engine evaluates IDE/session/task state transitions correctly.
- [ ] Grace periods and escalation steps follow configured policy.
- [ ] User overrides are respected and logged.
- [ ] Fail-safe mode prevents destructive loops when dependencies fail.

---

### TASK-17-009: IDE-Triggered Session Enforcement

| Field            | Value                                      |
| ---------------- | ------------------------------------------ |
| Assigned Persona | Platform Engineer                          |
| Status           | pending                                    |
| Depends On       | TASK-17-008                                |
| Deliverable      | Strict mode flow tied to IDE launch events |

**Description**:
When watched IDEs open without an active session, trigger the strict-mode enforcement sequence.

**Acceptance Criteria**:

- [ ] Prompt appears immediately on IDE launch without active session.
- [ ] Escalation reminders fire if user ignores prompt.
- [ ] Optional close action executes only after grace period and policy allows it.
- [ ] Every action path is auditable by tenant/user.

---

### TASK-17-010: Distractor App Enforcement

| Field            | Value                                       |
| ---------------- | ------------------------------------------- |
| Assigned Persona | Platform Engineer + Frontend Engineer       |
| Status           | pending                                     |
| Depends On       | TASK-17-004, TASK-17-008                    |
| Deliverable      | Configurable distractor app policy controls |

**Description**:
Allow focus-mode users to configure and enforce distractor app behavior during active sessions.

**Acceptance Criteria**:

- [ ] UI allows add/remove/toggle for distractor executables.
- [ ] Policy supports warn-only and warn-then-close modes.
- [ ] Enforcement is suppressed when no active focus session exists.
- [ ] Policy changes apply without app restart.

---

### TASK-17-011: Website Block-List Enforcement (Desktop)

| Field            | Value                                 |
| ---------------- | ------------------------------------- |
| Assigned Persona | Platform Engineer + Frontend Engineer |
| Status           | pending                               |
| Depends On       | TASK-17-004, TASK-17-008              |
| Deliverable      | Website block-list policy runtime     |

**Description**:
Implement website distraction policy evaluation based on desktop-available signals and configured domain lists.

**Acceptance Criteria**:

- [ ] Settings support domain list management (`youtube.com`, `x.com`, `instagram.com`, etc.).
- [ ] Runtime evaluates blocked domains where desktop signal is available and triggers warn/escalate flow.
- [ ] Every decision path is auditable and policy-driven.
- [ ] Behavior degrades safely when reliable URL context is unavailable.
- [ ] Tests cover matching, escalation, and fallback behavior.

---

### TASK-17-012: Remaining-Task Reminder Escalation

| Field            | Value                                |
| ---------------- | ------------------------------------ |
| Assigned Persona | Backend Engineer + Frontend Engineer |
| Status           | pending                              |
| Depends On       | TASK-17-006, TASK-17-008             |
| Deliverable      | Backlog-aware reminder loop          |

**Description**:
Increase reminder pressure when a session is active and relevant tasks remain unfinished.

**Acceptance Criteria**:

- [ ] Reminder cadence reads from policy configuration.
- [ ] Reminder logic uses task state filters agreed in product contract.
- [ ] Reminders stop once backlog threshold is cleared.
- [ ] Notification copy distinguishes routine reminder vs escalation.

---

### TASK-17-013: Windows Installer + Release Pipeline (Electron)

| Field            | Value                                  |
| ---------------- | -------------------------------------- |
| Assigned Persona | Platform Engineer + DevOps             |
| Status           | pending                                |
| Depends On       | TASK-17-002                            |
| Deliverable      | Windows installer and release workflow |

**Description**:
Create repeatable Windows packaging and installer release for desktop distribution.

**Acceptance Criteria**:

- [ ] Configure Electron Forge maker for Squirrel Windows as primary installer output.
- [ ] CI pipeline produces versioned installer artifacts for release candidates.
- [ ] Keep local/self-use channel unsigned in MVP; document signing requirements for external distribution.
- [ ] Document optional MSI track via WiX maker for enterprise environments (deferred path).
- [ ] Validate install, upgrade, uninstall, and first-run behavior on clean Windows VMs.
- [ ] Validate fresh-install "out of the box" flow works correctly before any manual config.

---

### TASK-17-014: WebdriverIO Desktop E2E Suite

| Field            | Value                                                |
| ---------------- | ---------------------------------------------------- |
| Assigned Persona | QA / Validation + Platform Engineer                  |
| Status           | pending                                              |
| Depends On       | TASK-17-005, TASK-17-006, TASK-17-008, TASK-17-013   |
| Deliverable      | Automated desktop E2E suite and CI execution profile |

**Description**:
Implement desktop E2E coverage using WebdriverIO and Electron service, focused on first-run reliability and strict mode critical paths.

**Acceptance Criteria**:

- [ ] Add WebdriverIO + `wdio-electron-service` test harness in monorepo.
- [ ] Add critical-path E2E tests:
  - fresh install -> first launch -> authenticated session ready
  - tray/widget session controls
  - IDE launch without active session prompt flow
  - app block-list warning/escalation flow
- [ ] Add deterministic test fixtures for desktop settings.
- [ ] Integrate E2E suite into local and CI commands.
- [ ] Mark failing E2E as release-blocking for desktop channel.

---

### TASK-17-015: Hardening, Audit, and Rollout Controls

| Field            | Value                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| Assigned Persona | QA / Validation + Platform Engineer                                          |
| Status           | pending                                                                      |
| Depends On       | TASK-17-009, TASK-17-010, TASK-17-011, TASK-17-012, TASK-17-013, TASK-17-014 |
| Deliverable      | Reliability checklist and launch gate report                                 |

**Description**:
Validate safety, reliability, and user-experience quality before rollout.

**Acceptance Criteria**:

- [ ] Validate strict mode under restarts/crashes/network interruptions.
- [ ] Validate audit completeness for every enforcement action path.
- [ ] Validate tenant isolation in multi-company account scenarios.
- [ ] Validate no behavioral regression in `apps/web` for core session/task/inbox flows.
- [ ] Validate TDD evidence exists for completed implementation tasks.
- [ ] Run `pnpm lint` and `pnpm typecheck` for all touched workspaces.
- [ ] Produce rollout checklist with rollback/fallback instructions.

---

### TASK-17-016: Web/Desktop Parity and Compatibility Matrix

| Field            | Value                                         |
| ---------------- | --------------------------------------------- |
| Assigned Persona | QA / Validation + Platform Engineer           |
| Status           | pending                                       |
| Depends On       | TASK-17-005, TASK-17-006, TASK-17-008         |
| Deliverable      | Signed compatibility matrix and parity report |

**Description**:
Create a formal compatibility matrix covering behavior parity and intentional differences between `apps/web` and `apps/desktop`.

**Acceptance Criteria**:

- [ ] Document parity expectations for auth, session lifecycle, task interactions, and notifications.
- [ ] Document intentional desktop-only behaviors with fallback expectations in web.
- [ ] Validate shared backend contract parity (same tenant scope, same state transitions).
- [ ] Capture known deviations with owner and remediation status.
- [ ] Add matrix to rollout gate used by TASK-17-015.

---

## Deferred Task Backlog (Not Started in Initial Execution)

### TASK-17-017: Offline Features Discovery + Design (Deferred)

| Field            | Value                                         |
| ---------------- | --------------------------------------------- |
| Assigned Persona | Platform Engineer + Backend Engineer          |
| Status           | pending                                       |
| Depends On       | TASK-17-003                                   |
| Deliverable      | Offline architecture proposal and phased plan |

**Description**:
Design offline behavior for desktop workflows without implementing it in this phase.

**Acceptance Criteria**:

- [ ] Define local cache boundaries for tasks/sessions/policies.
- [ ] Define queue/retry model for offline event capture and replay.
- [ ] Define stale-data UX copy and safety constraints.
- [ ] Define conflict-resolution rules for policy/session updates.
- [ ] Produce follow-up project proposal for implementation phase.

## Task Dependency Graph

```text
TASK-17-001
└── TASK-17-002
    ├── TASK-17-003
    │   ├── TASK-17-004
    │   │   ├── TASK-17-005
    │   │   │   └── TASK-17-006
    │   │   ├── TASK-17-007
    │   │   └── TASK-17-017 (deferred)
    │   └── TASK-17-013

TASK-17-006 + TASK-17-007
└── TASK-17-008
    ├── TASK-17-009
    ├── TASK-17-010
    ├── TASK-17-011
    └── TASK-17-012

TASK-17-005 + TASK-17-006 + TASK-17-008
└── TASK-17-016

TASK-17-005 + TASK-17-006 + TASK-17-008 + TASK-17-013
└── TASK-17-014

TASK-17-009 + TASK-17-010 + TASK-17-011 + TASK-17-012 + TASK-17-013 + TASK-17-014 + TASK-17-016
└── TASK-17-015
```

## Delegation Order

1. TASK-17-001 (can start immediately)
2. TASK-17-002 (after 001)
3. TASK-17-003 and TASK-17-013 (parallel, after 002)
4. TASK-17-004 (after 003)
5. TASK-17-005 and TASK-17-007 (parallel, after 004)
6. TASK-17-006 (after 005)
7. TASK-17-008 (after 006 and 007)
8. TASK-17-009, TASK-17-010, TASK-17-011, TASK-17-012 (parallel, after 008)
9. TASK-17-016 (after 005, 006, and 008)
10. TASK-17-014 (after 005, 006, 008, and 013)
11. TASK-17-015 (after 009, 010, 011, 012, 013, 014, and 016)
12. TASK-17-017 remains deferred and does not block MVP rollout
