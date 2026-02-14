# Dependencies: Windows Desktop App + Strict Focus Mode

## Required Inputs

### From 08-session-module

- [ ] Session lifecycle APIs/actions (`start`, `pause`, `resume`, `end`) are stable.
- [ ] Session state model supports real-time status for desktop widget rendering.
- [ ] Session-level metadata supports reminder calculations and escalation windows.

### From 07-task-module

- [ ] Task query interfaces can provide "remaining tasks" counts filtered by company/user/project.
- [ ] Task status transitions are available for reminder suppression when backlog clears.

### From 04-company-module / user settings foundation

- [ ] Company-scoped and user-scoped settings persistence pattern is available.
- [ ] Settings mutation/audit conventions exist for policy configuration changes.

### From 03-frontend-foundation

- [ ] Existing web runtime patterns remain stable for non-regression parity validation.
- [ ] Shared UI/state abstractions can be reused without introducing Electron coupling in web paths.

### From 11-inbox-module (optional integration path)

- [ ] Existing notification semantics can be reused for desktop feed parity.
- [ ] Source metadata contract can include desktop enforcement events if inbox bridging is enabled.

### From platform foundation

- [ ] Auth/session tokens can be securely consumed by Electron main/renderer processes.
- [ ] Shared package boundaries are respected (`@devsuite/shared` consumed by desktop app only).

## Produced Outputs

### For platform desktop capability

- [ ] Windows desktop runtime (`apps/desktop`) integrated with existing backend contracts.
- [ ] Desktop focus settings contract (IDE watch list, app block list, website block list, policy fields).
- [ ] Policy engine contract for strict mode and enforcement telemetry.
- [ ] Process monitoring + enforcement adapter abstractions for future OS expansion.

### For product operations

- [ ] Installer and release process documentation for Windows distribution.
- [ ] Audit event schema for strict mode actions and user overrides.
- [ ] Rollout and safety checklist (permissions, fallback mode, incident handling).
- [ ] Local-only distribution instructions (no hosted updates in MVP).
- [ ] Web/Desktop compatibility matrix and non-regression sign-off.
- [ ] Test strategy and CI gate for TDD + desktop E2E reliability.

## External Dependencies

- Electron runtime for desktop shell.
- Electron Forge toolchain for packaging and making Windows distributables.
- Squirrel.Windows maker for Setup.exe installer and update artifacts.
- WebdriverIO test runner for Electron desktop E2E execution.
- `wdio-electron-service` for robust Electron app automation.
- Windows code-signing certificate (required only when distributing beyond local/self-use).

## Testing Strategy Summary (Desktop)

Preferred approach:

- Test-driven development for desktop modules:
  - write failing unit/integration/E2E tests first
  - implement minimal code to pass
  - refactor with tests green
- Use WebdriverIO + `wdio-electron-service` for desktop E2E coverage of install-to-first-run flows.
- Keep pure policy logic testable outside Electron runtime (fast unit tests).
- Enforce release gate: installer smoke + critical-path E2E must pass before accepting build.

## Installer Research Summary (Electron, Windows)

Primary-source findings:

- Electron Forge handles packaging + installer generation using "makers".
- For Windows, Forge provides makers for Squirrel, WiX MSI, and AppX.
- Forge documentation notes WiX support exists but Squirrel is generally better supported and more frequently updated.

Recommended project default:

- Primary path: `@electron-forge/maker-squirrel` to generate Setup.exe-based installer artifacts.
- Secondary optional path: `@electron-forge/maker-wix` for MSI if enterprise deployment policy requires it in future.

Baseline execution recipe (for implementation tasking):

1. Install and initialize Forge in `apps/desktop`.
2. Add Squirrel maker dependency (`@electron-forge/maker-squirrel`).
3. Configure `makers` in Forge config with app metadata and setup icon.
4. Run Windows make command to generate installer artifacts.
5. For local/self-use builds, run unsigned. Add code signing in CI before broader distribution.

Reference command flow:

- `pnpm --filter @devsuite/desktop exec electron-forge import`
- `pnpm --filter @devsuite/desktop add -D @electron-forge/maker-squirrel`
- `pnpm --filter @devsuite/desktop exec electron-forge make --platform win32`

Implementation notes for execution tasks:

- Ensure deterministic app identity (`name`, `author`, `appId`) before signing/release.
- Add signing configuration in CI for production builds.
- Validate install/upgrade/uninstall and auto-update behavior on clean Windows VMs.

References:

- https://www.electronforge.io/config/makers/squirrel.windows
- https://www.electronforge.io/config/makers/wix-msi
- https://www.electronforge.io/config/makers/appx

## Blocking Issues

- None for local/self-use installer generation with Squirrel.
- Code-signing certificate procurement and CI secret handling are deferred until external distribution.
- Update artifact hosting path and retention policy are deferred until deployment phase.
