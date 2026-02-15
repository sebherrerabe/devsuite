# Status: Windows Desktop App + Strict Focus Mode

## Current State

**Status**: in-progress
**Last Updated**: 2026-02-15
**Updated By**: Cursor

## Progress

### Completed

- [x] Defined Windows-only desktop project objective and deliverables (2026-02-14)
- [x] Decomposed implementation into platform, enforcement, installer, and QA workstreams (2026-02-14)
- [x] Documented Electron Windows installer strategy with Squirrel-first recommendation and optional MSI path (2026-02-14)
- [x] Added deferred offline-features backlog section and explicit deferred task (2026-02-14)
- [x] Locked installer choice to Squirrel for MVP (2026-02-14)
- [x] Locked distribution posture to local/self-use only for MVP (2026-02-14)
- [x] Added explicit web/desktop compatibility requirements and parity tasking (2026-02-14)
- [x] Added desktop-only parameterized settings scope (IDEs, app block list, website block list) (2026-02-14)
- [x] Added TDD-first testing requirement and WebdriverIO desktop E2E tasking (2026-02-14)
- [x] Drafted initial `TASK-17-014` executable test matrix (`TEST_MATRIX.md`) with pass/fail release gates (2026-02-14)
- [x] Started implementation: scaffolded `apps/desktop` Electron workspace with TypeScript build, IPC wiring, and desktop settings store (2026-02-14)
- [x] Added initial TDD coverage for desktop focus settings contract (`test:unit` passing in `apps/desktop`) (2026-02-14)
- [x] Completed TASK-17-002 desktop scaffold acceptance criteria (workspace created, build/dev scripts, targeted lint/typecheck green) (2026-02-14)
- [x] Added tenant-scoped desktop settings bridge (`userId + companyId`) across preload IPC and desktop storage (2026-02-14)
- [x] Added profile settings UI for desktop focus parameters and backend persistence via `userSettings.desktopFocus` (2026-02-14)
- [x] Completed TASK-17-004 desktop settings contract including audit events (`desktopFocusAuditEvents`) (2026-02-14)
- [x] Added persisted Electron desktop session partition and desktop auth scope bridge (`desktopAuth`) for user/company context continuity (2026-02-14)
- [x] Wired sign-out flow to clear desktop-local auth material (`desktopAuth.clearLocalState`) before auth logout redirect (2026-02-14)
- [x] Enforced desktop scope consistency at IPC boundary (rejects cross-scope settings operations) (2026-02-14)
- [x] Routed desktop auth/session storage through Electron partition + local scope store only (no custom token persistence) (2026-02-14)
- [x] Added scoped desktop session IPC contract (`desktopSession`) with renderer command handling and scope-matched mutation execution (2026-02-14)
- [x] Added Windows tray controls for desktop session lifecycle (`Start`, `Pause`, `Resume`, `End`) without requiring visible main window (2026-02-14)
- [x] Added compact desktop session widget window backed by shared scoped session IPC state (2026-02-14)
- [x] Completed TASK-17-005 by adding real-time widget timer continuity and clear sync/error recovery states (2026-02-14)
- [x] Added native desktop notification pipeline (`desktopNotification`) with scope checks, click-routing, and throttle controls (2026-02-14)
- [x] Added session lifecycle toast notifications (start/pause/resume/end) driven by renderer session-state transitions (2026-02-14)
- [x] Completed TASK-17-006 including IDE-open-without-session notification prompt flow with action routing (2026-02-14)
- [x] Added Windows process monitor service with dynamic scoped config updates and structured event stream (`desktopProcessMonitor`) (2026-02-14)
- [x] Completed TASK-17-008 strict policy engine with deterministic transitions, grace/reminder escalation, override support, and fail-safe guardrails (2026-02-14)
- [x] Completed TASK-17-009 IDE-triggered strict-mode enforcement flow (prompt, reminders, grace-close policy, scoped audit trail) (2026-02-14)
- [x] Completed TASK-17-001 product contract decisions with security-first defaults and explicit consent posture (2026-02-14)
- [x] Completed TASK-17-010 distractor app settings UX (add/remove/toggle ergonomics) (2026-02-14)
- [x] Completed TASK-17-011 website block-list runtime enforcement for available URL signals with safe fallback audit path (2026-02-14)
- [x] Completed TASK-17-012 remaining-task reminder escalation loop with policy-driven cadence and clear-stop behavior (2026-02-14)
- [x] Started TASK-17-013 packaging baseline with Electron Forge + Squirrel maker config and make script (`make:win`) (2026-02-14)
- [x] Added TASK-17-014 WebdriverIO desktop E2E harness baseline with deterministic fixture seeding (`wdio.e2e.conf.mjs`) (2026-02-14)
- [x] Wired Windows CI execution profile for desktop E2E and installer artifact builds (`.github/workflows/desktop-windows-e2e.yml`) (2026-02-14)
- [x] Added versioned Windows installer artifact naming (`DEVSUITE_DESKTOP_BUILD_VERSION`) and installer smoke script wiring in CI (`test:install-smoke`) (2026-02-14)
- [x] Added initial web/desktop compatibility artifact (`COMPATIBILITY_MATRIX.md`) with parity rows, deviations, and rollout-gate linkage (2026-02-14)
- [x] Hardened desktop IPC scope enforcement for process-monitor and policy-audit read channels (`desktop-process-monitor:get-events`, `desktop-policy:get-audit-events`) (2026-02-14)
- [x] Hardened `desktop-session:request-action` to require explicit scope and reject cross-tenant commands at IPC boundary (2026-02-14)
- [x] Hardened `desktop-session:get-state` to require explicit scope and reject unscoped/cross-tenant session reads (2026-02-14)
- [x] Added preload origin guard so desktop IPC APIs are exposed only on trusted app origins and the internal widget window (2026-02-14)
- [x] Added Electron navigation security guards: restrict in-app navigation/popups to trusted origins, escape external URLs to system browser, and block webview attachment (2026-02-14)
- [x] Added Electron permission policy: default-deny checks/requests with minimal trusted-origin allowlist and blocked device permissions (2026-02-14)
- [x] Added deterministic process-monitor overhead benchmark harness (`test:process-overhead`) and wired it into Windows CI workflow (2026-02-14)
- [x] Expanded desktop E2E coverage with tenant-scope mismatch rejection assertions for policy/process/session IPC paths (2026-02-14)
- [x] Added desktop integration parity test suite (`test:int`) for shared session/task contract checks (2026-02-14)
- [x] Added strict-policy resilience/audit tests for restart continuity, fail-safe recovery, and close-action audit pairing (2026-02-14)
- [x] Added rollout artifacts for hardening gate execution (`ROLLOUT_CHECKLIST.md`, `TDD_EVIDENCE.md`) (2026-02-14)
- [x] Completed TASK-17-003 tenant-scope auth/session bridge hardening acceptance criteria (2026-02-14)
- [x] Completed TASK-17-016 shared backend contract parity validation criteria (2026-02-14)
- [x] Passed web static regression gate (`pnpm --filter @devsuite/web build`) and documented runtime-regression evidence gap separately (2026-02-14)

### In Progress

(none — all evidence collected)

### Recently Completed (2026-02-15)

- [x] Fixed Squirrel.Windows lifecycle handling in `main.ts` — root cause of install-smoke uninstall failures (app didn't quit during `--squirrel-uninstall`, Squirrel hook timed out) (2026-02-15)
- [x] Fixed preload script sandboxed execution — bundled with esbuild to CJS; origin guard rejects opaque `"null"` origins (2026-02-15)
- [x] Fixed WDIO E2E config — switched to `appEntryPoint`, increased CDP/Mocha timeouts (2026-02-15)
- [x] Fixed `Wait-Process` timeout detection in `install-smoke.ps1` (`HasExited` check) (2026-02-15)
- [x] Fixed E2E "clears task reminders" test (added prerequisite reminder state) (2026-02-15)
- [x] Added uninstall settle polling to install-smoke.ps1 for filesystem latency resilience (2026-02-15)
- [x] TASK-17-007 process overhead benchmark passed locally on Windows (p95=12.47ms, budget=120ms) (2026-02-15)
- [x] TASK-17-013 install/upgrade/uninstall smoke passed locally on Windows 11 (2026-02-15)
- [x] TASK-17-014 all 17 E2E tests passed locally on Windows 11 (2026-02-15)
- [x] TASK-17-015 web regression: `apps/web` build clean, no web-specific tests exist; `pnpm lint` and `pnpm typecheck` pass workspace-wide (2026-02-15)
- [x] All 46 unit tests + 3 integration tests pass locally (2026-02-15)
- [x] CI workflow fix: added shared package build step before desktop tests (2026-02-15)
- [x] Pushed fixes and manually triggered `desktop-windows-e2e` CI workflow (2026-02-15)

### Pending

- [x] Collected green CI run evidence: `desktop-windows-e2e` run #22036217569 — all steps passed (2026-02-15)
- [x] TEST_MATRIX.md reporting template filled with local + CI evidence (2026-02-15)

(no remaining pending items for MVP)

## Blockers

| Blocker                                       | Waiting On | Since |
| --------------------------------------------- | ---------- | ----- |
| None blocking MVP local/self-use distribution | —          | —     |

## Decision Log

| Date       | Decision                                                                                                                                                                                                     | Rationale                                                                                                          | Made By      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------ |
| 2026-02-14 | Scope initial rollout to Windows only.                                                                                                                                                                       | Reduces platform variance and speeds execution of enforcement features.                                            | Codex        |
| 2026-02-14 | Use Electron Forge + Squirrel Windows as default installer path.                                                                                                                                             | Matches current Electron Forge support posture and standard Setup.exe distribution flow.                           | Codex        |
| 2026-02-14 | Keep WiX MSI as optional enterprise track, not mandatory for MVP.                                                                                                                                            | Avoids unnecessary packaging complexity before customer policy requires it.                                        | Codex        |
| 2026-02-14 | Track offline support as deferred design task, not immediate implementation.                                                                                                                                 | Preserves delivery focus on enforcement and desktop runtime first.                                                 | Codex        |
| 2026-02-14 | Keep MVP distribution local/self-use with no hosted update channel.                                                                                                                                          | Removes deployment overhead while product behavior is still being validated.                                       | User + Codex |
| 2026-02-14 | Enforce explicit web non-regression and desktop parity checks as launch criteria.                                                                                                                            | Reduces risk of desktop work breaking existing web workflows.                                                      | User + Codex |
| 2026-02-14 | Desktop focus policies are parameterized in user/company settings and enforced by desktop runtime only.                                                                                                      | Supports flexible per-user configuration without coupling enforcement to web runtime.                              | User + Codex |
| 2026-02-14 | Adopt TDD-first execution with WebdriverIO + `wdio-electron-service` as desktop E2E strategy.                                                                                                                | Maximizes first-install reliability and catches regressions before release.                                        | User + Codex |
| 2026-02-14 | Use `TEST_MATRIX.md` as the executable source of truth for TASK-17-014 and release gating.                                                                                                                   | Ensures deterministic acceptance criteria and consistent go/no-go decisions.                                       | User + Codex |
| 2026-02-14 | Security-first defaults locked: `strictMode=prompt_then_close`, `appActionMode=warn_then_close`, `websiteActionMode=escalate`, `graceSeconds=45`, `reminderIntervalSeconds=120`.                             | Prioritizes enforceable focus posture while retaining bounded grace and override controls.                         | User + Codex |
| 2026-02-14 | Monitoring/consent wording locked to explicit disclosure: process and URL-signal monitoring run locally, actions are policy-driven, auditable, and user-overridable.                                         | Reduces legal/compliance ambiguity and sets clear user expectation for strict mode behavior.                       | User + Codex |
| 2026-02-14 | Website blocking MVP behavior locked to signal-aware warn/escalate only; never force-close browsers based on unreliable URL context.                                                                         | Preserves safety and avoids destructive actions when URL telemetry is partial/unavailable.                         | User + Codex |
| 2026-02-14 | Code signing timing locked: unsigned builds allowed for local/self-use only; Authenticode certificate is mandatory before any external distribution.                                                         | Keeps MVP friction low while preserving supply-chain trust requirements for broader rollout.                       | User + Codex |
| 2026-02-14 | Parity/release gate ownership locked: desktop platform owner maintains matrix, release decision requires parity report attached to TASK-17-015.                                                              | Establishes accountability for cross-runtime compatibility before release.                                         | User + Codex |
| 2026-02-14 | `TEST_MATRIX.md` waiver policy locked: P0 has zero waivers; security-related P1 has zero waivers; non-security P1 waivers require explicit entry in `STATUS.md` with owner + rationale + expiry.             | Enforces strict quality bar where risk is highest and keeps exceptions auditable/time-bounded.                     | User + Codex |
| 2026-02-14 | `test:e2e` command skips on non-Windows hosts by default and requires explicit override env to force local non-Windows attempts.                                                                             | Keeps developer workflow stable while preserving Windows-only execution for authoritative desktop E2E evidence.    | User + Codex |
| 2026-02-14 | Windows CI profile path is `.github/workflows/desktop-windows-e2e.yml` and is the authoritative runner for desktop E2E evidence.                                                                             | Aligns execution environment with Windows-only scope and avoids false confidence from non-Windows hosts.           | User + Codex |
| 2026-02-14 | Windows installer artifacts are versioned via CI-provided `DEVSUITE_DESKTOP_BUILD_VERSION` (`<package>-rc.<run_number>`) and uploaded per-run.                                                               | Ensures release-candidate artifacts are traceable and distinguishable across CI runs.                              | User + Codex |
| 2026-02-14 | Process-monitor performance gate runs in Windows CI via `test:process-overhead` with a `p95` latency threshold budget.                                                                                       | Adds deterministic overhead guardrail to reduce risk of focus-agent CPU regressions.                               | User + Codex |
| 2026-02-14 | Electron window navigation policy is default-deny for non-trusted origins; external links are opened in the system browser, and extra trusted origins require explicit `DEVSUITE_DESKTOP_NAV_ALLOW_ORIGINS`. | Reduces attack surface from in-app navigation/popup abuse while retaining controlled auth/integration flexibility. | User + Codex |
| 2026-02-14 | Electron permission policy is default-deny with explicit safe allowlist (`clipboard-sanitized-write`) gated by trusted origin checks.                                                                        | Minimizes browser-surface capability exposure while preserving low-risk clipboard workflows.                       | User + Codex |
| 2026-02-14 | Added desktop `test:int` contract suite to keep shared session/task semantics aligned between desktop bridge and backend/shared contracts.                                                                   | Detects parity drift earlier than Windows runtime execution and supports TASK-17-016 closure on Linux.             | User + Codex |

## Notes

- Enforcement actions must remain transparent, reversible by policy, and fully auditable.
- Tenant isolation and no-hard-delete rules remain mandatory for all produced artifacts and data models.
- Forced non-Windows E2E attempt (`DEVSUITE_E2E_ALLOW_NON_WINDOWS=1`) fails at Electron WebDriver bootstrap (`DevToolsActivePort`), so authoritative desktop evidence remains Windows-runner only.
- Web app production build currently passes (`pnpm --filter @devsuite/web build`); runtime user-flow regression evidence still requires explicit interactive validation.
