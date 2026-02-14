# Status: Windows Desktop App + Strict Focus Mode

## Current State

**Status**: planning
**Last Updated**: 2026-02-14
**Updated By**: Codex

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

### In Progress

- [ ] Dependency readiness validation against upstream session/task modules (started: 2026-02-14)

### Pending

- [ ] Approve strict mode policy defaults and legal/compliance consent wording
- [ ] Confirm code-signing timing when moving beyond local/self-use distribution
- [ ] Confirm website blocking behavior level for MVP (warning/escalation vs stronger intervention)
- [ ] Approve web/desktop parity matrix template and release gate owner
- [ ] Begin implementation of `apps/desktop` scaffold and release pipeline

## Blockers

| Blocker                                       | Waiting On | Since |
| --------------------------------------------- | ---------- | ----- |
| None blocking MVP local/self-use distribution | —          | —     |

## Decision Log

| Date       | Decision                                                                                                | Rationale                                                                                | Made By      |
| ---------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------ |
| 2026-02-14 | Scope initial rollout to Windows only.                                                                  | Reduces platform variance and speeds execution of enforcement features.                  | Codex        |
| 2026-02-14 | Use Electron Forge + Squirrel Windows as default installer path.                                        | Matches current Electron Forge support posture and standard Setup.exe distribution flow. | Codex        |
| 2026-02-14 | Keep WiX MSI as optional enterprise track, not mandatory for MVP.                                       | Avoids unnecessary packaging complexity before customer policy requires it.              | Codex        |
| 2026-02-14 | Track offline support as deferred design task, not immediate implementation.                            | Preserves delivery focus on enforcement and desktop runtime first.                       | Codex        |
| 2026-02-14 | Keep MVP distribution local/self-use with no hosted update channel.                                     | Removes deployment overhead while product behavior is still being validated.             | User + Codex |
| 2026-02-14 | Enforce explicit web non-regression and desktop parity checks as launch criteria.                       | Reduces risk of desktop work breaking existing web workflows.                            | User + Codex |
| 2026-02-14 | Desktop focus policies are parameterized in user/company settings and enforced by desktop runtime only. | Supports flexible per-user configuration without coupling enforcement to web runtime.    | User + Codex |
| 2026-02-14 | Adopt TDD-first execution with WebdriverIO + `wdio-electron-service` as desktop E2E strategy.           | Maximizes first-install reliability and catches regressions before release.              | User + Codex |

## Notes

- Enforcement actions must remain transparent, reversible by policy, and fully auditable.
- Tenant isolation and no-hard-delete rules remain mandatory for all produced artifacts and data models.
