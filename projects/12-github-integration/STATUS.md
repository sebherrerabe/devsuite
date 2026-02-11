# Status: GitHub Integration

## Current State

**Status**: in-progress
**Last Updated**: 2026-02-11
**Updated By**: Codex

## Progress

### Completed

- [x] Decommissioned local bridge architecture and removed implementation traces (2026-02-05)
- [x] Reset project docs to server-side GitHub integration direction (2026-02-05)
- [x] Defined phased execution plan for new architecture (2026-02-05)
- [x] Scaffolded `apps/gh-service` with health/readiness and protected route contract (2026-02-05)
- [x] Implemented backend device-flow endpoints with per-user isolated GH config directories (2026-02-05)
- [x] Added encrypted-at-rest token handling in `gh-service` connection pipeline (2026-02-05)
- [x] Implemented allowlisted backend PR discovery endpoint (`/github/pr/discover`) (2026-02-05)
- [x] Added Convex service routes for company org routing + notification ingestion (2026-02-05)
- [x] Implemented gh-service notification polling worker with org-filtered ingest (2026-02-05)
- [x] Added company metadata support for GitHub org login mapping (2026-02-05)
- [x] Added backend notification env contract + Convex token guard (2026-02-05)
- [x] Wired integrations UI to gh-service connect/status/disconnect flow (2026-02-05)
- [x] Migrated MCP PR tools from local GitHub CLI calls to gh-service APIs (2026-02-11)

### In Progress

- [ ] TASK-12-001: Freeze architecture and security contract (started: 2026-02-05)
- [ ] TASK-12-003: Implement browser-first GitHub connect flow (started: 2026-02-05)
- [ ] TASK-12-005: Implement user-isolated `gh` runner (started: 2026-02-05)
- [ ] TASK-12-006: Company org mapping settings (started: 2026-02-05)
- [ ] TASK-12-007: Notification polling and routing (started: 2026-02-05)
- [ ] TASK-12-009: Integrations UI implementation (started: 2026-02-05)

### Pending

- [ ] Persist and expose per-user notification sync telemetry in Convex
- [ ] Complete hardening, QA, and rollout docs

## Blockers

| Blocker | Waiting On | Since |
| ------- | ---------- | ----- |
| None    | —          | —     |

## Decision Log

| Date       | Decision                                                     | Rationale                                                     | Made By |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------- | ------- |
| 2026-02-05 | Remove local bridge and local pairing model                  | UX target is browser-first connect with no local daemon setup | Codex   |
| 2026-02-05 | Use dedicated Node service for GitHub integration workloads  | Convex runtime should not host per-user CLI orchestration     | Codex   |
| 2026-02-05 | Keep integration auth user-scoped and routing company-scoped | One user can access multiple orgs and multiple companies      | Codex   |
| 2026-02-05 | Route notifications by company org-login mapping             | Deterministic company targeting for multi-org user accounts   | Codex   |

## Notes

Immediate build sequence: TASK-12-001 then TASK-12-002 and TASK-12-003. Company org mapping (TASK-12-006) should run in parallel with connect flow so polling can start right after `gh` runner is ready.
