# Test Matrix: Windows Desktop App + Strict Focus Mode

## Purpose

Define the executable quality gate for TASK-17-014 and ensure install-to-first-run reliability using TDD.

## Scope

- Windows desktop app (`apps/desktop`) only.
- Installer + first-run + strict-mode critical paths.
- Web non-regression checks for shared domain behavior.

## TDD Rule

For every implementation story:

1. Write failing tests first.
2. Implement minimum code to pass.
3. Refactor with all tests green.
4. Keep test evidence linked to task completion.

## Environment Matrix

| ID     | Environment                          | Purpose                    | Required |
| ------ | ------------------------------------ | -------------------------- | -------- |
| ENV-01 | Windows 11 latest stable             | Primary dev/runtime target | Yes      |
| ENV-02 | Windows 10 latest supported build    | Backward compatibility     | Yes      |
| ENV-03 | Clean VM snapshot (no prior install) | Fresh-install validation   | Yes      |

## Data Fixtures

| Fixture ID | Description                                                    | Used By                    |
| ---------- | -------------------------------------------------------------- | -------------------------- |
| FX-IDE-01  | IDE watchlist with `Code.exe`, `Cursor.exe`, `idea64.exe`      | IDE enforcement flows      |
| FX-APP-01  | App blocklist with `WhatsApp.exe`, `Telegram.exe`              | App distractor flows       |
| FX-WEB-01  | Website blocklist with `youtube.com`, `x.com`, `instagram.com` | Website distractor flows   |
| FX-POL-01  | Strict policy `prompt_only` with 60s grace                     | Baseline policy validation |
| FX-POL-02  | Strict policy `prompt_then_close` with 30s grace               | Escalation validation      |

## Test Cases

| Case ID  | Layer          | Scenario                                          | Preconditions                    | Expected Result                                                                                    | Priority | Release Gate |
| -------- | -------------- | ------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- | -------- | ------------ |
| E2E-001  | E2E            | Fresh install and first launch                    | ENV-03, unsigned local installer | App launches successfully; no crash; settings bootstrap succeeds                                   | P0       | Blocker      |
| E2E-002  | E2E            | Login and tenant session initialization           | E2E-001 complete                 | Auth succeeds; tenant context loaded; session actions enabled                                      | P0       | Blocker      |
| E2E-003  | E2E            | Tray menu controls                                | Logged in desktop app            | `Start`, `Pause`, `Resume`, `End` work and update state consistently                               | P0       | Blocker      |
| E2E-004  | E2E            | Session widget timer continuity                   | Active session                   | Timer updates accurately across minimize/restore                                                   | P1       | Required     |
| E2E-005  | E2E            | IDE launch without active session                 | FX-IDE-01, no active session     | Prompt appears immediately with correct action options                                             | P0       | Blocker      |
| E2E-006  | E2E            | IDE escalation reminder                           | FX-IDE-01, policy FX-POL-01      | Reminder cadence follows policy timing                                                             | P0       | Blocker      |
| E2E-007  | E2E            | IDE close-after-grace policy                      | FX-IDE-01, policy FX-POL-02      | Close action executes only after grace and is logged                                               | P0       | Blocker      |
| E2E-008  | E2E            | App blocklist warn flow                           | FX-APP-01, active session        | Native warning shown; no close in warn-only policy                                                 | P0       | Blocker      |
| E2E-009  | E2E            | App blocklist warn-then-close flow                | FX-APP-01, FX-POL-02             | Close action after grace; audit entry includes process and policy reason                           | P0       | Blocker      |
| E2E-010  | E2E            | Website blocklist detection with available signal | FX-WEB-01, active session        | Warning/escalation fires for blocked domain and is audited                                         | P1       | Required     |
| E2E-011  | E2E            | Website blocklist safe fallback                   | No reliable URL signal           | No destructive action; user receives safe fallback notice; event logged                            | P0       | Blocker      |
| E2E-012  | E2E            | Remaining-task escalation reminders               | Open task backlog                | Reminders escalate and stop when threshold clears                                                  | P1       | Required     |
| E2E-013  | E2E            | Desktop settings edit and apply                   | Logged in user                   | IDE/app/site/policy updates apply without app restart                                              | P0       | Blocker      |
| E2E-014  | E2E            | Settings tenant isolation                         | Multi-company user context       | Settings and enforcement remain company-scoped                                                     | P0       | Blocker      |
| E2E-015  | E2E            | Restart resilience                                | Active strict mode + app restart | Policies restore correctly; no action duplication loop                                             | P0       | Blocker      |
| E2E-016  | E2E            | Upgrade install path                              | Existing installed version       | Upgrade preserves settings; app boots and functions                                                | P1       | Required     |
| E2E-017  | E2E            | Uninstall cleanup                                 | Installed app                    | Uninstall succeeds; no broken re-install path                                                      | P1       | Required     |
| INT-001  | Integration    | IPC contract main/preload/renderer                | Desktop app running              | Typed IPC channels behave deterministically; invalid payloads rejected                             | P0       | Blocker      |
| INT-002  | Integration    | Audit event emission                              | Any enforcement action           | Audit event includes actor, timestamp, rule, target, outcome                                       | P0       | Blocker      |
| INT-003  | Integration    | Tenant scope mismatch rejection                   | Desktop app running              | Cross-tenant IPC payloads are rejected for settings/session/policy reads and writes                | P0       | Blocker      |
| INT-004  | Integration    | Preload origin guard                              | Desktop app running              | Desktop bridge APIs are exposed only to trusted app origin(s) and widget context                   | P0       | Blocker      |
| INT-005  | Integration    | Electron navigation guard                         | Desktop app running              | Non-trusted in-app navigation/popup/webview flows are blocked or escaped safely to default browser | P0       | Blocker      |
| INT-006  | Integration    | Electron permission policy                        | Desktop app running              | Permission checks/requests are default-deny except explicit safe allowlist on trusted origins      | P0       | Blocker      |
| INT-007  | Integration    | Backend/shared contract parity                    | Desktop app running              | Desktop bridge session/task semantics stay aligned with shared/backend status contracts            | P0       | Blocker      |
| INT-008  | Integration    | Strict-policy resilience checks                   | Desktop app running              | Restart/fail-safe paths avoid duplicate destructive loops and preserve auditable recovery          | P0       | Blocker      |
| UNIT-001 | Unit           | Policy engine state transitions                   | Deterministic fixtures           | Decisions match policy for all transition paths                                                    | P0       | Blocker      |
| UNIT-002 | Unit           | Domain matching logic                             | FX-WEB-01                        | Domain normalization and matching are correct and deterministic                                    | P0       | Blocker      |
| UNIT-003 | Unit           | Settings schema validation                        | Invalid/valid payloads           | Invalid payloads rejected; defaults applied safely                                                 | P0       | Blocker      |
| PERF-001 | Performance    | Process monitor overhead budget                   | ENV-01 or ENV-02                 | Parser/diff loop stays within configured `p95` threshold budget                                    | P1       | Required     |
| WEB-001  | Web regression | Core session/task/inbox behavior in `apps/web`    | Existing web test harness        | No behavior regression from desktop feature work                                                   | P0       | Blocker      |

## Pass/Fail Rules

- All `P0` cases must pass.
- `P0` cases have zero-waiver policy.
- Security-related `P1` cases have zero-waiver policy.
- Non-security `P1` cases must pass for release candidates; any waiver requires explicit entry in `STATUS.md` with owner, rationale, and expiry date.
- Any crash, data-scope violation, or missing audit event is an automatic fail.
- Any flake above 2% in critical `P0` E2E cases is fail until stabilized.

## Execution Commands (Planned)

| Command                                                 | Purpose                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm --filter @devsuite/desktop test:unit`             | Unit tests for policy/settings helpers                                         |
| `pnpm --filter @devsuite/desktop test:int`              | IPC and enforcement integration tests                                          |
| `pnpm --filter @devsuite/desktop test:process-overhead` | Process monitor latency budget gate (`p95`)                                    |
| `pnpm --filter @devsuite/desktop test:e2e`              | WebdriverIO Electron E2E (runs on Windows hosts; non-Windows defaults to skip) |
| `pnpm --filter @devsuite/desktop test:install-smoke`    | Installer install/uninstall smoke (Windows; non-Windows defaults to skip)      |
| `pnpm lint && pnpm typecheck`                           | Workspace static gate                                                          |

Windows CI profile: `.github/workflows/desktop-windows-e2e.yml`

## Reporting Template

| Field            | Value                  |
| ---------------- | ---------------------- |
| Build ID         | `TODO`                 |
| Test Date        | `YYYY-MM-DD`           |
| Environment      | `ENV-01/ENV-02/ENV-03` |
| Total Cases      | `N`                    |
| Passed           | `N`                    |
| Failed           | `N`                    |
| Waivers          | `None or linked`       |
| Release Decision | `GO/NO-GO`             |

## Traceability

- Primary owner task: `TASK-17-014`.
- Release gate aggregation task: `TASK-17-015`.
- Compatibility dependency: `TASK-17-016`.
