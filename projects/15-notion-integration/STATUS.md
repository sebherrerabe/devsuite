# Status: Notion Integration

## Current State

**Status**: in-progress
**Last Updated**: 2026-02-13
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

### In Progress

- [ ] Stakeholder validation of remaining auth scope details (optional user profile capability and webhook event subset) (started: 2026-02-11)
- [ ] End-to-end QA matrix execution (webhook retries, multi-company isolation, revoked token behavior) (started: 2026-02-13)

### Pending

- [ ] Execute QA matrix and release checklist

## Blockers

| Blocker                                                                     | Waiting On                                                | Since      |
| --------------------------------------------------------------------------- | --------------------------------------------------------- | ---------- |
| Notion public integration credentials are not configured in environment yet | Client ID/secret + redirect URI registration              | 2026-02-11 |
| Notion webhook production secret is not configured yet                      | `DEVSUITE_NOTION_WEBHOOK_VERIFICATION_TOKEN` provisioning | 2026-02-13 |

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
