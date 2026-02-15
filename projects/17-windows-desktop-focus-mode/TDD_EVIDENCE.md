# TDD Evidence: Windows Desktop Focus Mode

## Purpose

Track concrete test evidence mapped to implementation tasks for `TASK-17-015`.

## Evidence Map

| Task          | Evidence (Primary)                                                                        | Notes                                                                         |
| ------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `TASK-17-003` | `apps/desktop/test/e2e/desktop-smoke.e2e.mjs` scope mismatch assertions                   | Tenant-scope enforcement for session/policy/process/focus paths               |
| `TASK-17-004` | `apps/desktop/test/unit/focus-settings.test.ts`                                           | Settings schema parsing/defaults/validation                                   |
| `TASK-17-005` | `apps/desktop/test/e2e/desktop-smoke.e2e.mjs` session command flow                        | Start/pause/resume/end command path                                           |
| `TASK-17-006` | `apps/desktop/test/unit/notifications.test.ts` + E2E notification routing paths           | Native notification contract + action routing                                 |
| `TASK-17-007` | `apps/desktop/test/unit/process-monitor.test.ts` + `scripts/process-monitor-overhead.mjs` | Process signal correctness + performance budget gate                          |
| `TASK-17-008` | `apps/desktop/test/unit/strict-policy-engine.test.ts`                                     | Deterministic policy transitions, fail-safe, reminders/escalation             |
| `TASK-17-009` | `apps/desktop/test/e2e/desktop-smoke.e2e.mjs` IDE prompt audit path                       | IDE-without-session enforcement path                                          |
| `TASK-17-010` | `apps/desktop/test/e2e/desktop-smoke.e2e.mjs` app warn/close audit path                   | Distractor enforcement behavior                                               |
| `TASK-17-011` | `apps/desktop/test/unit/strict-policy-engine.test.ts` website tests                       | Signal-aware website block-list behavior                                      |
| `TASK-17-012` | `apps/desktop/test/unit/strict-policy-engine.test.ts` task reminder tests                 | Remaining-task reminder cadence/escalation                                    |
| `TASK-17-013` | `apps/desktop/scripts/install-smoke.ps1`, `apps/desktop/scripts/run-install-smoke.mjs`    | Installer smoke automation (Windows authoritative execution pending evidence) |
| `TASK-17-014` | `apps/desktop/wdio.e2e.conf.mjs`, `apps/desktop/test/e2e/desktop-smoke.e2e.mjs`           | WDIO harness + deterministic desktop E2E cases                                |
| `TASK-17-016` | `apps/desktop/test/integration/backend-contract-parity.test.ts`                           | Shared backend/session/task contract parity assertions                        |

## Command Set

- `pnpm --filter @devsuite/desktop test:unit`
- `pnpm --filter @devsuite/desktop test:int`
- `pnpm --filter @devsuite/desktop test:process-overhead`
- `pnpm --filter @devsuite/desktop test:e2e` (Windows-authoritative)
- `pnpm --filter @devsuite/desktop test:install-smoke` (Windows-authoritative)
