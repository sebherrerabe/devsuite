# Dependencies: Notion Integration

## Required Inputs

### From 11-inbox-module

- [x] Company-scoped `inboxItems` schema with `source = notion`.
- [x] Inbox list/filter/read/archive UX patterns for external notifications.
- [x] Upsert model by external identifier for dedupe-friendly ingestion.

### From 07-task-module

- [x] External link model supporting `type = notion`.
- [x] Task-level external-link add/update/remove flows.

### From 12-github-integration

- [x] Integrations UI and service contract pattern (`connect/status/disconnect`).
- [x] Token-at-rest encryption approach for third-party credentials.
- [x] Notification ingest routing patterns into Convex.

## Produced Outputs

### For 11-inbox-module

- [x] Notion webhook ingestion that creates/updates inbox items per company.
- [x] Notion notification metadata contract for inbox rendering/automation.

### For 07-task-module

- [x] Notion link validation hook with resolved title and stable identifier.

### For platform integrations layer

- [ ] Reusable OAuth connection primitives for provider-based integrations.
- [x] Audit events for connect/disconnect/capability changes.

## External Dependencies

- Notion public integration credentials (`client_id`, `client_secret`) and registered `redirect_uri`.
- Notion OAuth endpoints (`/v1/oauth/authorize`, `/v1/oauth/token`, `/v1/oauth/revoke`, `/v1/oauth/introspect`).
- Notion API capabilities:
  - Required: `read content`
  - Required for comment notifications: `read comments`
  - Optional: `user information without email`
- Notion webhook endpoint setup + signing secret verification.
- Rate-limit handling (request budgets + retry/backoff strategy).

## Blocking Issues

- Public integration credentials and redirect URI are not yet declared in environment/config.
