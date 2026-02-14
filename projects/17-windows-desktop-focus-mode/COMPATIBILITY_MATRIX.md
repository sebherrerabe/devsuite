# Web/Desktop Compatibility Matrix: Windows Desktop Focus Mode

## Purpose

Define parity expectations and intentional deviations between `apps/web` and `apps/desktop`.
This matrix is a release-gate input for `TASK-17-015`.

## Ownership

- Matrix Owner: Desktop Platform Engineer
- Gate Consumers: QA / Validation + Platform Engineer (`TASK-17-015`)
- Last Updated: 2026-02-14

## Parity Matrix

| Capability                                   | Web (`apps/web`)                                   | Desktop (`apps/desktop`)                                                   | Backend Contract Parity                                                                   | Status    | Evidence                                                                                  |
| -------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| Auth + company scope                         | Authenticated user + company context selection     | Same scope bridged via `desktopAuth` and persisted local scope             | Same company/user constraints via shared Convex APIs                                      | `partial` | `apps/web/src/lib/company-context.tsx`, `apps/desktop/src/main.ts`                        |
| Session lifecycle (`start/pause/resume/end`) | Session widget and routes trigger Convex mutations | Tray/widget and notification actions route into same session actions       | Same transitions (`IDLE/RUNNING/PAUSED`) and mutation paths                               | `partial` | `apps/web/src/lib/desktop-session-bridge.tsx`, `apps/desktop/src/session-control.ts`      |
| Session state sync                           | Web renders canonical session state                | Desktop publishes bridge state and receives commands                       | Same logical state model; desktop adds connection metadata                                | `partial` | `apps/desktop/src/preload.ts`, `apps/desktop/src/main.ts`                                 |
| Task-aware reminder behavior                 | Web shows tasks and session context                | Desktop policy evaluates `remainingTaskCount` for reminders/escalation     | Same task status semantics (`todo`, `in_progress`, `blocked`, terminal statuses excluded) | `partial` | `apps/web/src/lib/desktop-session-bridge.tsx`, `apps/desktop/src/strict-policy-engine.ts` |
| Notifications                                | Browser-level in-app/desktop integrations          | Native desktop notifications (`Notification`) + routed actions             | Same action intent (`open_sessions`, `start_session`)                                     | `partial` | `apps/desktop/src/notifications.ts`, `apps/desktop/src/main.ts`                           |
| IDE/session strict enforcement               | Not enforced                                       | Enforced by desktop process monitor + strict policy engine                 | Same tenant scope; desktop-only host enforcement                                          | `partial` | `apps/desktop/src/process-monitor.ts`, `apps/desktop/src/strict-policy-engine.ts`         |
| Distractor app enforcement                   | Not enforced                                       | Warn or warn-then-close during active session                              | Same settings schema persisted in backend                                                 | `partial` | `apps/web/src/routes/_app.settings.profile.tsx`, `convex/userSettings.ts`                 |
| Website block-list enforcement               | Not enforced                                       | Signal-aware warn/escalate only; safe fallback when URL signal unavailable | Same settings schema; enforcement desktop-only                                            | `partial` | `apps/desktop/src/main.ts`, `apps/desktop/src/strict-policy-engine.ts`                    |
| Settings management                          | User edits desktop focus settings in profile       | Same settings consumed by desktop runtime                                  | Shared schema/normalization through backend + desktop parser                              | `partial` | `convex/schema.ts`, `convex/userSettings.ts`, `apps/desktop/src/focus-settings.ts`        |

## Intentional Desktop-Only Behaviors

| Behavior                        | Why Desktop-Only                     | Web Fallback                      | Owner               | Remediation Status          |
| ------------------------------- | ------------------------------------ | --------------------------------- | ------------------- | --------------------------- |
| Process monitoring (`tasklist`) | Requires OS-level process visibility | None (display-only settings)      | Platform            | Accepted                    |
| Force-close policy actions      | Requires OS process termination      | None                              | Platform            | Accepted                    |
| Tray + widget controls          | Requires native desktop shell        | Web session widget in app shell   | Frontend + Platform | Accepted                    |
| Native toast routing            | Requires Electron notification API   | Browser notifications/in-app cues | Platform            | Accepted                    |
| URL-signal website enforcement  | Requires reliable host URL signal    | None (no enforcement)             | Platform            | Accepted with safe fallback |

## Known Deviations and Risks

| Deviation                                                                         | Risk                                                 | Mitigation                                                                       | Owner         | Status |
| --------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- | ------------- | ------ |
| Desktop E2E real install/auth evidence still pending on Windows runner            | Hidden first-run regressions                         | Run `.github/workflows/desktop-windows-e2e.yml` and attach report in `STATUS.md` | QA / Platform | Open   |
| Process monitor overhead benchmark pending on Windows hardware                    | Potential runtime overhead under heavy process lists | Execute `TASK-17-007` benchmark evidence run and set thresholds                  | Platform      | Open   |
| Tenant parity validation across multi-company contexts not fully evidenced in E2E | Scope bleed risk                                     | Add explicit multi-tenant E2E case in `TASK-17-014` Windows run                  | QA / Platform | Open   |

## Rollout Gate Usage (TASK-17-015)

`TASK-17-015` cannot be marked complete unless:

1. This matrix status is updated to `validated` for all parity rows that are in-scope for release.
2. All open deviations are either closed or have explicit time-bounded waivers in `STATUS.md`.
3. Latest Windows workflow evidence is linked in `STATUS.md`.

## Sign-Off

| Field                 | Value                   |
| --------------------- | ----------------------- |
| Matrix Version        | `v0.1`                  |
| Prepared By           | `Codex`                 |
| QA Sign-Off           | `pending`               |
| Platform Sign-Off     | `pending`               |
| Release Decision Link | `pending (TASK-17-015)` |
