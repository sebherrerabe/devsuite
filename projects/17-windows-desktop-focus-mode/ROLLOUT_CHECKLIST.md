# Rollout Checklist: Windows Desktop Focus Mode

## Purpose

Provide release gate checks, rollback instructions, and fallback behavior for `TASK-17-015`.

## Release Gates

### Gate A: Static + Contract Validation (Linux/Any Host)

- [x] `pnpm --filter @devsuite/desktop build` — passed 2026-02-15
- [x] `pnpm --filter @devsuite/desktop test:unit` — 46/46 passed 2026-02-15
- [x] `pnpm --filter @devsuite/desktop test:int` — 3/3 passed 2026-02-15
- [x] `pnpm --filter @devsuite/desktop test:process-overhead` — p95=12.47ms (budget=120ms), passed 2026-02-15
- [x] `pnpm lint` — passed 2026-02-15
- [x] `pnpm typecheck` — passed 2026-02-15

### Gate B: Windows Runtime Validation (Authoritative)

- [x] `pnpm --filter @devsuite/desktop make:win` — artifacts produced 2026-02-15
- [x] `pnpm --filter @devsuite/desktop test:install-smoke` — install/upgrade/uninstall all passed 2026-02-15 (root cause fix: packaged Windows installer lifecycle handling in `main.ts`)
- [x] `pnpm --filter @devsuite/desktop test:e2e` — 17/17 passed on local Windows 11, 2026-02-15 (root cause fix: esbuild preload bundling, appEntryPoint config)
- [ ] Manual smoke:
  - [ ] tray start/pause/resume/end
  - [ ] widget timer + reconnection states
  - [ ] native notifications and click routing
  - [ ] IDE launch without session strict-mode prompt

### Gate C: Parity + Audit Validation

- [x] `COMPATIBILITY_MATRIX.md` parity row validation updated (2026-02-14)
- [x] tenant isolation checks pass for IPC and bridge actions (E2E tenant-scope mismatch tests pass 2026-02-15)
- [x] strict-policy audit events verified for notify/close/escalation paths (unit + E2E policy audit tests pass 2026-02-15)

## Rollback Plan

1. Stop desktop rollout distribution immediately (freeze installer promotion).
2. Revert to last known-good desktop artifact version.
3. Disable strict close-actions in settings defaults if issue is enforcement-related:
   - set `strictMode=prompt_only`
   - set `appActionMode=warn`
4. Keep monitoring-only behavior active until hotfix is validated.
5. Re-run Gate A + Gate B before re-promoting.

## Fallback Behavior

If desktop dependencies fail at runtime:

1. Keep web app session/task flows as canonical operational path.
2. Preserve local scope/settings state; do not hard-delete runtime data.
3. Fail closed on privileged behavior:
   - reject unscoped IPC calls
   - deny non-trusted navigation/permissions
4. Fail open on user productivity where safe:
   - show prompt/notification guidance
   - avoid destructive process-close actions when guardrails are uncertain.

## Incident Response Notes

- Capture desktop logs + policy audit events from the failing scope.
- Record build version (`DEVSUITE_DESKTOP_BUILD_VERSION` in CI runs).
- Link incident summary and mitigation decision in `STATUS.md`.
