# Status: GitHub Integration

## Current State

**Status**: review
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
- [x] Added `gh-service` notification sync endpoint (`/github/notifications/sync`) for on-demand ingestion (2026-02-11)
- [x] Persisted per-user sync telemetry in Convex and surfaced it in Integrations UI (2026-02-11)
- [x] Added GitHub org mapping inputs in company settings UI (2026-02-11)
- [x] Added integration audit trail events for GitHub org mapping create/update (2026-02-11)
- [x] Added gh command audit logging (actor + command class + outcome) (2026-02-11)
- [x] Added contract/threat model/runbook documentation (`docs/github-integration-contract-runbook.md`) (2026-02-11)

### In Progress

- [ ] None

### Pending

- [ ] Human review and production rollout sign-off

## Blockers

| Blocker | Waiting On | Since |
| ------- | ---------- | ----- |
| None    | —          | —     |

## Decision Log

| Date       | Decision                                                        | Rationale                                                                       | Made By |
| ---------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------- |
| 2026-02-05 | Remove local bridge and local pairing model                     | UX target is browser-first connect with no local daemon setup                   | Codex   |
| 2026-02-05 | Use dedicated Node service for GitHub integration workloads     | Convex runtime should not host per-user CLI orchestration                       | Codex   |
| 2026-02-05 | Keep integration auth user-scoped and routing company-scoped    | One user can access multiple orgs and multiple companies                        | Codex   |
| 2026-02-05 | Route notifications by company org-login mapping                | Deterministic company targeting for multi-org user accounts                     | Codex   |
| 2026-02-11 | Notification routing merges explicit org mappings + repo owners | Reduces routing misconfiguration risk while keeping deterministic matching      | Codex   |
| 2026-02-11 | Notification ingest is insert-only by external thread id        | Prevent archived/already-ingested GitHub notifications from being re-registered | Codex   |
| 2026-02-11 | Poll cadence default: 60s dev / 5m production                   | Faster feedback in development with lower production API churn                  | Codex   |
| 2026-02-11 | Unknown-org notification policy: ignore                         | Avoids blind ingest into incorrect company scopes                               | Codex   |

## Notes

Implementation is feature-complete and moved to review. The remaining step is rollout sign-off and environment validation in target deployment.
