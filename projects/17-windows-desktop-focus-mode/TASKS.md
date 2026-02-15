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
| Status           | complete                                           |
| Depends On       | none                                               |
| Deliverable      | Approved scope, policy defaults, and UX guardrails |

**Description**:
Lock down MVP behavior for strict mode, reminder escalation, and user-facing consent/copy for app monitoring.

**Acceptance Criteria**:

- [x] Approve strict mode defaults (`prompt_only` vs `prompt_then_close`).
- [x] Approve supported IDE seed list and distractor app policy.
- [x] Approve legal/compliance copy for monitoring and process actions.
- [x] Document escalation timing and override flow.

---

### TASK-17-002: Scaffold `apps/desktop` Electron Workspace

| Field            | Value                          |
| ---------------- | ------------------------------ |
| Assigned Persona | Platform Engineer              |
| Status           | complete                       |
| Depends On       | TASK-17-001                    |
| Deliverable      | Electron app shell in monorepo |

**Description**:
Create the Windows desktop application package and integrate pnpm workspace scripts.

**Acceptance Criteria**:

- [x] Add `apps/desktop` with Electron main/renderer process structure.
- [x] Reuse shared contracts from `@devsuite/shared` without cross-layer violations.
- [x] Add local dev commands for desktop run/build.
- [x] Verify lint/typecheck pass for workspace changes.

---

### TASK-17-003: Implement Auth + Tenant Session Bridge

| Field            | Value                                     |
| ---------------- | ----------------------------------------- |
| Assigned Persona | Backend Engineer + Platform Engineer      |
| Status           | complete                                  |
| Depends On       | TASK-17-002                               |
| Deliverable      | Desktop auth/session integration contract |

**Description**:
Ensure desktop runtime can authenticate users and safely access tenant-scoped data/actions.

Current increment: desktop-scoped session commands (`start/pause/resume/end`) are enforced with explicit scope matching in IPC (`publish-state`, `request-action`, `get-state`), desktop APIs are origin-gated in preload to trusted app origins/widget only, Electron window navigation/popup/webview behavior is restricted to trusted origins, and Electron permission handling is default-deny with a minimal trusted-origin allowlist.

**Acceptance Criteria**:

- [x] Desktop login/session persistence works across app restarts.
- [x] Tenant context is enforced for all task/session operations.
- [x] Tokens/secrets remain in secure storage pathways.
- [x] Logout fully clears local auth material.

---

### TASK-17-004: Implement Desktop Focus Settings Contract

| Field            | Value                                     |
| ---------------- | ----------------------------------------- |
| Assigned Persona | Backend Engineer + Frontend Engineer      |
| Status           | complete                                  |
| Depends On       | TASK-17-003                               |
| Deliverable      | Desktop-only settings model + settings UX |

**Description**:
Implement user-configurable desktop focus settings, scoped by company and user, with desktop-only enforcement semantics.

**Acceptance Criteria**:

- [x] Add settings schema for IDE watch list, app block list, website block list, and policy parameters.
- [x] Add settings UI editor with validation and safe defaults.
- [x] Enforce desktop-only behavior; web may edit/view but never enforce.
- [x] Add audit trail for settings changes.
- [x] Add tests covering schema validation and persistence behavior.

---

### TASK-17-005: Build Session Widget + Tray Controls

| Field            | Value                                 |
| ---------------- | ------------------------------------- |
| Assigned Persona | Frontend Engineer + Platform Engineer |
| Status           | complete                              |
| Depends On       | TASK-17-003, TASK-17-004              |
| Deliverable      | Widget/tray UX for session lifecycle  |

**Description**:
Add Windows tray integration and compact widget for zero-friction session control.

**Acceptance Criteria**:

- [x] Tray icon/menu exposes `Start`, `Pause`, `Resume`, `End`.
- [x] Widget shows current timer/state and updates in real time.
- [x] Main window is not required for core session actions.
- [x] Error and disconnected states are clear and recoverable.

---

### TASK-17-006: Implement Native Windows Notifications

| Field            | Value                                   |
| ---------------- | --------------------------------------- |
| Assigned Persona | Platform Engineer                       |
| Status           | complete                                |
| Depends On       | TASK-17-005                             |
| Deliverable      | Windows toast notifications integration |

**Description**:
Create native notification delivery for session and reminder events.

**Acceptance Criteria**:

- [x] Session start/break/end notifications trigger correctly.
- [x] "IDE opened without session" prompt notification triggers reliably.
- [x] Notification actions route user into app/session flow.
- [x] Notification throttling avoids spam during repeated events.

---

### TASK-17-007: Build Windows Process Detection Service

| Field            | Value                                   |
| ---------------- | --------------------------------------- |
| Assigned Persona | Platform Engineer                       |
| Status           | complete                                |
| Depends On       | TASK-17-003, TASK-17-004                |
| Deliverable      | Local process watcher for policy engine |

**Description**:
Implement process monitoring for configured IDEs and distractor applications.
Current increment: add deterministic synthetic overhead benchmark (`test:process-overhead`) and wire it into Windows CI as a performance gate for parser/diff loop latency.

**Acceptance Criteria**:

- [x] Detect process start/stop events for configured executable names.
- [x] Support dynamic config updates without app restart.
- [x] Record structured process events for audit/debug.
- [x] Monitoring overhead remains acceptable on developer machines (validated on Windows 11 local host: p95=12.47ms, budget=120ms; CI runner evidence pending).

---

### TASK-17-008: Implement Strict Mode Policy Engine

| Field            | Value                                        |
| ---------------- | -------------------------------------------- |
| Assigned Persona | Backend Engineer + Platform Engineer         |
| Status           | complete                                     |
| Depends On       | TASK-17-006, TASK-17-007                     |
| Deliverable      | Deterministic policy rules and action runner |

**Description**:
Translate policy config into deterministic actions for reminders and enforcement.

**Acceptance Criteria**:

- [x] Engine evaluates IDE/session/task state transitions correctly.
- [x] Grace periods and escalation steps follow configured policy.
- [x] User overrides are respected and logged.
- [x] Fail-safe mode prevents destructive loops when dependencies fail.

---

### TASK-17-009: IDE-Triggered Session Enforcement

| Field            | Value                                      |
| ---------------- | ------------------------------------------ |
| Assigned Persona | Platform Engineer                          |
| Status           | complete                                   |
| Depends On       | TASK-17-008                                |
| Deliverable      | Strict mode flow tied to IDE launch events |

**Description**:
When watched IDEs open without an active session, trigger the strict-mode enforcement sequence.

**Acceptance Criteria**:

- [x] Prompt appears immediately on IDE launch without active session.
- [x] Escalation reminders fire if user ignores prompt.
- [x] Optional close action executes only after grace period and policy allows it.
- [x] Every action path is auditable by tenant/user.

---

### TASK-17-010: Distractor App Enforcement

| Field            | Value                                       |
| ---------------- | ------------------------------------------- |
| Assigned Persona | Platform Engineer + Frontend Engineer       |
| Status           | complete                                    |
| Depends On       | TASK-17-004, TASK-17-008                    |
| Deliverable      | Configurable distractor app policy controls |

**Description**:
Allow focus-mode users to configure and enforce distractor app behavior during active sessions.

**Acceptance Criteria**:

- [x] UI allows add/remove/toggle for distractor executables.
- [x] Policy supports warn-only and warn-then-close modes.
- [x] Enforcement is suppressed when no active focus session exists.
- [x] Policy changes apply without app restart.

---

### TASK-17-011: Website Block-List Enforcement (Desktop)

| Field            | Value                                 |
| ---------------- | ------------------------------------- |
| Assigned Persona | Platform Engineer + Frontend Engineer |
| Status           | complete                              |
| Depends On       | TASK-17-004, TASK-17-008              |
| Deliverable      | Website block-list policy runtime     |

**Description**:
Implement website distraction policy evaluation based on desktop-available signals and configured domain lists.

MVP decision: enforce only when reliable URL signal exists (currently Electron-observable navigation contexts), warn/escalate by policy, and never force-close browser processes from partial URL telemetry.

**Acceptance Criteria**:

- [x] Settings support domain list management (`youtube.com`, `x.com`, `instagram.com`, etc.).
- [x] Runtime evaluates blocked domains where desktop signal is available and triggers warn/escalate flow.
- [x] Every decision path is auditable and policy-driven.
- [x] Behavior degrades safely when reliable URL context is unavailable.
- [x] Tests cover matching, escalation, and fallback behavior.

---

### TASK-17-012: Remaining-Task Reminder Escalation

| Field            | Value                                |
| ---------------- | ------------------------------------ |
| Assigned Persona | Backend Engineer + Frontend Engineer |
| Status           | complete                             |
| Depends On       | TASK-17-006, TASK-17-008             |
| Deliverable      | Backlog-aware reminder loop          |

**Description**:
Increase reminder pressure when a session is active and relevant tasks remain unfinished.

Task filter decision: "remaining tasks" means company-scoped tasks in non-terminal status (`todo`, `in_progress`, `blocked`); reminders stop when count reaches zero.

**Acceptance Criteria**:

- [x] Reminder cadence reads from policy configuration.
- [x] Reminder logic uses task state filters agreed in product contract.
- [x] Reminders stop once backlog threshold is cleared.
- [x] Notification copy distinguishes routine reminder vs escalation.

---

### TASK-17-013: Windows Installer + Release Pipeline (Electron)

| Field            | Value                                  |
| ---------------- | -------------------------------------- |
| Assigned Persona | Platform Engineer + DevOps             |
| Status           | complete                               |
| Depends On       | TASK-17-002                            |
| Deliverable      | Windows installer and release workflow |

**Description**:
Create repeatable Windows packaging and installer release for desktop distribution.

**Acceptance Criteria**:

- [x] Configure Electron Forge maker for Squirrel Windows as primary installer output.
- [x] CI pipeline produces versioned installer artifacts for release candidates.
- [x] Keep local/self-use channel unsigned in MVP; document signing requirements for external distribution.
- [x] Document optional MSI track via WiX maker for enterprise environments (deferred path).
- [x] Validate install, upgrade, uninstall, and first-run behavior on Windows 11 (local `test:install-smoke` passed 2026-02-15; root cause fix: added Squirrel lifecycle event handling in `main.ts`).
- [x] Validate fresh-install "out of the box" flow works correctly before any manual config (install-smoke covers silent install + exe verification).

---

### TASK-17-014: WebdriverIO Desktop E2E Suite

| Field            | Value                                                |
| ---------------- | ---------------------------------------------------- |
| Assigned Persona | QA / Validation + Platform Engineer                  |
| Status           | complete                                             |
| Depends On       | TASK-17-005, TASK-17-006, TASK-17-008, TASK-17-013   |
| Deliverable      | Automated desktop E2E suite and CI execution profile |

**Description**:
Implement desktop E2E coverage using WebdriverIO and Electron service, focused on first-run reliability and strict mode critical paths.

All 17 E2E tests pass on local Windows 11 host. Key fixes: preload bundled with esbuild for sandboxed CJS execution, WDIO config uses `appEntryPoint`, Squirrel lifecycle events handled in main.ts.

**Acceptance Criteria**:

- [x] Add WebdriverIO + `wdio-electron-service` test harness in monorepo.
- [x] Maintain executable matrix at `projects/17-windows-desktop-focus-mode/TEST_MATRIX.md`.
- [x] Add critical-path E2E tests:
  - [x] first-launch fixture bootstrap and tenant-scope readiness smoke
  - [x] session command controls path (`start`/`pause`/`resume`/`end`)
  - [x] IDE launch without active session prompt flow (deterministic process-event injection)
  - [x] app block-list warning/escalation flow (deterministic process-event injection)
  - [x] Windows local evidence: 17/17 E2E pass (2026-02-15); CI runner evidence pending workflow run
- [x] Add deterministic test fixtures for desktop settings.
- [x] Integrate E2E suite into local and CI commands.
- [x] Mark failing E2E as release-blocking for desktop channel.

---

### TASK-17-015: Hardening, Audit, and Rollout Controls

| Field            | Value                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| Assigned Persona | QA / Validation + Platform Engineer                                          |
| Status           | complete                                                                     |
| Depends On       | TASK-17-009, TASK-17-010, TASK-17-011, TASK-17-012, TASK-17-013, TASK-17-014 |
| Deliverable      | Reliability checklist and launch gate report                                 |

**Description**:
Validate safety, reliability, and user-experience quality before rollout.

All hardening evidence collected. Windows local validation: 46 unit, 3 integration, 17 E2E, install-smoke, overhead benchmark all passing. Web build clean, no web-specific tests to run. Lint and typecheck green workspace-wide.

**Acceptance Criteria**:

- [x] Validate strict mode under restarts/crashes/network interruptions.
- [x] Validate audit completeness for every enforcement action path.
- [x] Validate tenant isolation in multi-company account scenarios.
- [x] Validate no behavioral regression in `apps/web` for core session/task/inbox flows (`apps/web` build succeeds; no web E2E/integration tests exist; `pnpm lint` and `pnpm typecheck` green; desktop changes are app-isolated).
- [x] Validate TDD evidence exists for completed implementation tasks.
- [x] Run `pnpm lint` and `pnpm typecheck` for all touched workspaces (passed 2026-02-15).
- [x] Produce rollout checklist with rollback/fallback instructions.

---

### TASK-17-016: Web/Desktop Parity and Compatibility Matrix

| Field            | Value                                         |
| ---------------- | --------------------------------------------- |
| Assigned Persona | QA / Validation + Platform Engineer           |
| Status           | complete                                      |
| Depends On       | TASK-17-005, TASK-17-006, TASK-17-008         |
| Deliverable      | Signed compatibility matrix and parity report |

**Description**:
Create a formal compatibility matrix covering behavior parity and intentional differences between `apps/web` and `apps/desktop`.

Current increment: backend/session/task parity checks are codified in desktop integration tests (`test:int`) and matrix deviations are updated with owners/status.

**Acceptance Criteria**:

- [x] Document parity expectations for auth, session lifecycle, task interactions, and notifications.
- [x] Document intentional desktop-only behaviors with fallback expectations in web.
- [x] Validate shared backend contract parity (same tenant scope, same state transitions).
- [x] Capture known deviations with owner and remediation status.
- [x] Add matrix to rollout gate used by TASK-17-015.

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
