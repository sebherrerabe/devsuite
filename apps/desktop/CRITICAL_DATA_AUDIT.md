# Desktop Critical Data Audit

Date: 2026-03-14
Scope: `apps/desktop`
Focus: critical data leaks and critical memory/storage handling defects

## Result

One critical issue was confirmed and fixed. No other critical leak or unbounded memory/storage issue was identified in the audited desktop code paths.

## Critical Finding

### 1. Sign-out left tenant-scoped artifacts on disk

Severity: Critical

Affected paths:

- `apps/desktop/src/main.ts`
- `apps/desktop/src/settings-store.ts`
- `apps/desktop/src/runtime-logger.ts`

Impact:

- The desktop sign-out path called `window.desktopAuth.clearLocalState()`, but the Electron handler only cleared Chromium session storage and the persisted session scope file.
- Per-user and per-company focus settings remained in `desktop-focus-settings.json`, including scoped keys of the form `userId::companyId` and the user's website/app block lists.
- Runtime logs also remained on disk and could contain prior company IDs, session IDs, notification routes, blocked domains, and session activity transitions.
- On a shared machine, the next local user could recover prior tenant context after sign-out from the same desktop profile.

Evidence:

- `desktop-auth:clear-local-state` previously cleared `desktop-session-scope.json`, browser storage, and cache only.
- Scoped settings persistence and runtime logging used separate on-disk files that were not removed by that flow.

Fix:

- Added `clearDesktopScopedSettings()` to remove all persisted company-scoped settings while preserving non-sensitive machine preferences.
- Added `RuntimeLogger.clearPersistedLogs()` to remove current and rotated runtime logs.
- Updated the `desktop-auth:clear-local-state` IPC handler to invoke both cleanup steps during desktop sign-out.

Validation:

- Added unit coverage in `apps/desktop/test/unit/settings-store.test.ts`.
- Added unit coverage in `apps/desktop/test/unit/runtime-logger.test.ts`.
- Verified with `pnpm --filter @devsuite/desktop test:unit`.
