# Status: Notion Integration

## Current State

**Status**: review
**Last Updated**: 2026-02-14
**Updated By**: Codex

## Progress

### Completed

- [x] Documented UI-first Notion pairing strategy using OAuth (2026-02-11)
- [x] Documented minimum capability contract and permission rationale (2026-02-11)
- [x] Decomposed implementation into backend, frontend, webhook, and QA tasks (2026-02-11)
- [x] Confirmed tenancy model: one company maps to one Notion workspace (2026-02-11)
- [x] Implemented Notion OAuth service endpoints (`connect/start`, `connect/callback`, `connect/status`, `disconnect`) (2026-02-13)
- [x] Implemented token encryption, token introspection, and refresh-token lifecycle checks in notion-service (2026-02-13)
- [x] Implemented Integrations UI Notion card with connect/refresh/disconnect + callback feedback flow (2026-02-13)
- [x] Implemented Notion link validation + title resolution flow for task external links (2026-02-13)
- [x] Implemented Notion webhook ingest path with signature verification and Convex inbox routing (2026-02-13)
- [x] Aligned webhook signature verification and OAuth introspection endpoint with current Notion docs (`x-notion-signature` raw-body HMAC + `/v1/oauth/introspect`) (2026-02-13)
- [x] Added assignee-scoped webhook filtering for Notion page events so only pages assigned to the connected user are emitted as inbox notifications (2026-02-13)
- [x] Added per-company assignee filter configuration (load Notion people properties from a page URL, then choose `any_people` or a specific people property) in notion-service + integrations UI (2026-02-13)
- [x] Fixed Notion owner user resolution from `/users/me` bot payload shape so assignee routing can match the authenticating user (2026-02-14)
- [x] Added comment-to-page correlation (`data.page_id`) so comment events on assigned tasks are routed and can generate inbox items (2026-02-14)
- [x] Improved Notion inbox title generation for assigned-task workflows (new assigned task, assigned task updated with changed property names, comment on assigned task) (2026-02-14)

### In Progress

- [ ] User workflow validation in real usage (started: 2026-02-14)

### Pending

- [ ] Gather follow-up requirements after workflow testing (if any)
- [ ] Execute final QA matrix/release checklist before production hardening

## Blockers

| Blocker                                                                  | Waiting On                                                | Since      |
| ------------------------------------------------------------------------ | --------------------------------------------------------- | ---------- |
| Production webhook security token and permanent endpoint are not set yet | `DEVSUITE_NOTION_WEBHOOK_VERIFICATION_TOKEN` + stable URL | 2026-02-14 |

## Decision Log

| Date       | Decision                                                                                                          | Rationale                                                                         | Made By |
| ---------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------- |
| 2026-02-11 | Pairing will be fully UI-driven via OAuth (no manual token entry).                                                | Meets product requirement and improves onboarding/security posture.               | Codex   |
| 2026-02-11 | Minimum required capabilities for MVP are `read content` and `read comments`; `user info without email` optional. | Supports link validation + notification ingestion while minimizing access scope.  | Codex   |
| 2026-02-11 | Enforce one company to one Notion workspace mapping.                                                              | Matches tenancy expectations and simplifies routing/isolation semantics.          | Codex   |
| 2026-02-11 | Notification ingestion should be webhook-first with idempotent handling.                                          | Better timeliness and reliability than polling; aligns with provider event model. | Codex   |
| 2026-02-11 | Integration remains reference-only (IDs/URLs/titles/metadata), not content mirroring.                             | Preserves core architectural invariant and limits data duplication risk.          | Codex   |

## Notes

- Existing GitHub integration flow is the implementation reference for connection UX and service contracts.
- The module remains intentionally minimal: links + inbox notifications only.
- Current phase outcome: implementation complete for dev usage; next phase is user workflow validation and feedback-driven refinement.
