# Scope: Notion Integration

## In Scope

Minimal, company-scoped Notion integration for UI pairing, task link validation, and inbox notifications.

### Entities

- Notion Connection (company-scoped credential + workspace metadata): stores OAuth status, workspace identifiers, encrypted token references, and enforces one workspace per company.
- Integration audit events: append-only audit trail for connect/disconnect and capability changes.
- Notion inbox deliveries: company-scoped `inboxItems` with `source = notion` and external reference metadata.
- Notion external links: `external_links` entries with `type = notion`, URL, identifier, and display title.

### Functionality

- UI-only pairing via Notion OAuth Authorization Code flow.
- Enforce 1:1 mapping between DevSuite company and Notion workspace.
- Connection lifecycle endpoints: start auth, callback exchange, status/introspect, disconnect/revoke.
- Refresh-token handling and token validity checks for long-lived connections.
- Notion page validation for task links (existence + title extraction when page is shared to integration).
- Notion webhook ingestion for page/comment style events relevant to inbox notifications.
- Company routing + dedupe/idempotency for inbox upsert by Notion external event/thread identifier.
- Capability contract:
  - Required: `read content`
  - Required for comment-driven notifications: `read comments`
  - Optional: `user information without email`

### UI Components (if applicable)

- Integrations settings Notion card (`Connect`, `Refresh status`, `Disconnect`).
- OAuth callback success/error handoff screen and toast feedback.
- Task external-link composer support for Notion URL validation and title preview.
- Inbox source filtering and rendering for Notion events (reusing existing inbox surfaces).

## Out of Scope

- Full Notion sync or local mirroring of page/database content.
- Bi-directional writeback to Notion pages or comments.
- Notion workspace-wide analytics or search index.
- Fine-grained per-page permission management inside DevSuite UI (selection occurs in Notion share picker).
- Cross-user shared Notion connections (each DevSuite user pairs their own account).
- Multi-workspace binding per single company.

## Boundaries

### Boundary 1

DevSuite stores only external references and minimal metadata (IDs, URLs, titles, event metadata), never complete Notion page content.

### Boundary 2

Notification collection starts at webhook ingest and ends at company-scoped inbox upsert; inbox triage workflows remain owned by `11-inbox-module`.

### Boundary 3

A company can only have one active Notion workspace binding at a time; reconnecting replaces the prior workspace binding for that company.

## Assumptions

- Pairing must happen fully on the UI and cannot require manual token entry.
- Notion integration is configured as a public OAuth integration with callback URL support.
- Users will share specific pages/databases with the integration during Notion consent/page-picker flow.
- Tenant isolation remains enforced by company + authenticated user boundaries.
- Company-to-workspace cardinality is one-to-one.

## Open Questions

- [ ] Which Notion webhook event subset should map to `notification` vs `mention` inbox types in MVP? (owner: @product)
- [ ] Should first release include manual "sync now" backfill action in addition to webhooks? (owner: @frontend)
