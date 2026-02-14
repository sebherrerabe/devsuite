---
id: '17-windows-desktop-focus-mode'
title: 'Windows Desktop App + Strict Focus Mode'
status: 'planning'
priority: 14
assigned_pm: 'Codex'
depends_on: ['08-session-module']
unlocks: []
estimated_complexity: 'high'
---

# Windows Desktop App + Strict Focus Mode

## Summary

Create a Windows-first desktop shell for DevSuite with native notifications, a session widget, and a strict focus mode that reacts to IDE launches. The module includes policy-driven reminders and app-blocking controls for high-focus work sessions. Packaging and distribution must include a production installer path for Windows users.

## Objective

Deliver a Windows desktop experience that can enforce session-first workflows with native OS controls and auditable focus policies.

## Key Deliverables

- `apps/desktop` Electron app scaffold integrated with existing web UI and backend auth/session contracts
- Desktop-only focus settings model and UX (IDE watch list, app block list, website block list, enforcement policy)
- Windows native session widget and tray controls for start/pause/end session flows
- Native notification pipeline for reminders, escalation, and session lifecycle events
- Strict focus policy engine (IDE-triggered session enforcement + distractor app handling)
- Windows installer and release pipeline (signed installer artifacts, update-ready output)
- Automated quality gate (TDD-first workflow + Electron E2E test suite)
- Operational guardrails (audit trail, policy toggles, safe-failure behavior)

## Success Criteria

- [ ] Desktop app runs on supported Windows versions and can authenticate to the same tenant-scoped backend
- [ ] Session widget supports quick start/pause/end without opening main window
- [ ] Native Windows notifications fire for session start prompts, break reminders, and task backlog escalation
- [ ] Strict mode can detect configured IDE launches and enforce "start session first" flow
- [ ] Distractor-app policy can warn and optionally close configured executables during active focus sessions
- [ ] Desktop-only settings let users configure IDEs, blocked apps, blocked websites, and enforcement modes
- [ ] Installer pipeline generates a local distributable Windows installer via Squirrel (`Setup.exe`)
- [ ] Code-signing path is documented for future external distribution
- [ ] Test suite includes installer smoke, desktop E2E, and regression checks that pass before release
- [ ] All enforcement events are company-scoped and auditable

## Architecture Reference

Extends existing session/task architecture with a Windows desktop shell and local enforcement agent; keeps core invariants:

- tenant isolation remains mandatory
- no hard deletes
- external integrations remain reference-based

## Web/Desktop Compatibility Requirements

- Keep `apps/web` as the canonical UI/domain behavior; desktop adds host capabilities, not alternate business logic.
- Use adapter boundaries for desktop-only APIs (process monitoring, tray, native OS controls).
- Avoid importing Electron-only code into web runtime paths.
- Preserve backend API contracts so session/task/inbox semantics match between web and desktop.
- Gate desktop-only features with explicit capability flags and safe fallbacks.
- Require non-regression validation for existing web flows before desktop release.

## Desktop Settings Parameterization

- Settings are user-scoped and company-scoped, persisted in backend, and enforced only by desktop runtime.
- Required setting groups:
  - IDE watch list: executable names and detection mode
  - Distractor app block list: executable names and action mode (`warn`, `warn_then_close`)
  - Website block list: domain patterns for reminder/escalation behavior
  - Policy controls: grace duration, reminder cadence, and strictness mode
- Web app may expose read/edit UI for these settings, but enforcement remains desktop-only.

## Testing Strategy (TDD + Desktop E2E)

- Delivery model is test-driven development across desktop implementation tasks.
- Preferred desktop E2E stack: WebdriverIO with `wdio-electron-service`.
- Release quality gate requires:
  - installer fresh-install smoke on clean Windows environment
  - critical-path Electron E2E flows green
  - no-regression checks green for core `apps/web` flows

## Quick Links

- [Scope](./SCOPE.md)
- [Dependencies](./DEPENDENCIES.md)
- [Tasks](./TASKS.md)
- [Test Matrix](./TEST_MATRIX.md)
- [Status](./STATUS.md)

## Notes for AI PM

When executing this project:

1. Keep scope Windows-only for initial delivery.
2. Prioritize enforcement transparency and user override paths to avoid destructive behavior.
3. Installer choice should optimize reliability of updates and operational support.
4. Offline capabilities are tracked as deferred follow-up tasks and are not part of immediate build scope.
