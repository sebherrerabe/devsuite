# Scope: GitHub Integration

## In Scope

### Entities

- User-scoped GitHub connection state
- Encrypted user GitHub credential records
- Company integration settings for GitHub org logins (one company can map multiple orgs)
- Company-scoped inbox notification references
- PR discovery references for MCP consumption

### Functionality

- Dedicated Node.js service for GitHub integration workloads
- Browser-first connect flow:
- `POST /github/connect/start`
- `GET /github/connect/status`
- `POST /github/disconnect`
- Server-side per-user `gh` execution isolation
- Notification polling worker with retry/backoff
- Notification routing by repository owner org login to company mapping
- PR discovery endpoints for MCP tools (on demand)
- Audit logging and operational health endpoints

### UI Components

- Settings Integrations page:
- Connect GitHub
- Connection state + authenticated GitHub user
- Disconnect/Reconnect actions
- Last sync/status surface
- Company settings:
- GitHub org login mappings for notification routing

## Out of Scope

- Local bridge app and local bridge token pairing
- Browser calling local CLI directly
- GitHub write operations in MVP (approve/comment/merge)
- Webhook ingestion in MVP (polling first)
- Full GitHub payload mirroring in DevSuite database

## Boundaries

### Runtime Boundary

Convex remains source-of-truth app backend and storage. A separate Node service executes GitHub integration workflows and writes normalized records through backend APIs.

### Identity Boundary

GitHub integration is user-scoped. A user can connect one GitHub account and use it across multiple companies they can access in DevSuite.

### Routing Boundary

Notification routing is company-scoped via configured org-login mapping. If no match exists, notification is ignored (no blind ingest).

### Security Boundary

Tokens are encrypted at rest, decrypted only inside the service process, never returned to UI, and never logged.

## Assumptions

- Node service can be deployed where `gh` is installed
- Better Auth user identity can be verified by the service
- Users may belong to multiple GitHub orgs and multiple DevSuite companies
- Company org mapping is maintained from company settings UI

## Open Questions

- [x] Confirm default polling cadence (`60s` dev, `5m` prod) (owner: backend)
- [x] Confirm encryption key management strategy (env key in v1; KMS deferred) (owner: backend)
- [x] Confirm fail policy for unknown org notifications (drop/ignore in v1) (owner: PM)
