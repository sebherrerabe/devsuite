# Rollout Checklist: Windows Desktop Focus Mode

## Purpose

Provide release gate checks, rollback instructions, and fallback behavior for `TASK-17-015`.

## Release Gates

### Gate A: Static + Contract Validation (Linux/Any Host)

- [ ] `pnpm --filter @devsuite/desktop build`
- [ ] `pnpm --filter @devsuite/desktop test:unit`
- [ ] `pnpm --filter @devsuite/desktop test:int`
- [ ] `pnpm --filter @devsuite/desktop test:process-overhead`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`

### Gate B: Windows Runtime Validation (Authoritative)

- [ ] `pnpm --filter @devsuite/desktop make:win`
- [ ] `pnpm --filter @devsuite/desktop test:install-smoke`
- [ ] `pnpm --filter @devsuite/desktop test:e2e`
- [ ] Manual smoke:
  - [ ] tray start/pause/resume/end
  - [ ] widget timer + reconnection states
  - [ ] native notifications and click routing
  - [ ] IDE launch without session strict-mode prompt

### Gate C: Parity + Audit Validation

- [ ] `COMPATIBILITY_MATRIX.md` parity row validation updated
- [ ] tenant isolation checks pass for IPC and bridge actions
- [ ] strict-policy audit events verified for notify/close/escalation paths

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
