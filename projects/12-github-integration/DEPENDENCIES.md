# Dependencies: GitHub Integration

## Required Inputs

### From 04-company-module

- [x] Company membership and access checks
- [x] Company settings surface to store GitHub org login mappings

### From 05-repository-module

- [x] Company-scoped repository metadata (provider, owner/repo URL)

### From 09-mcp-server

- [x] MCP auth model for agent-only PR discovery tools
- [x] Tool interface contract for PR discovery payloads

### From Auth Layer

- [x] Reliable user identity/session verification in Node service
- [x] Service-to-backend auth between Node service and Convex HTTP/actions

## Produced Outputs

### For 10-pr-review-module

- [x] User-authorized PR discovery for linked repos
- [x] Stable normalized PR payload for review workflows

### For 11-inbox-module

- [x] Notification sync records with idempotent upsert semantics
- [x] Last-sync/health metadata for UI and ops

## External Dependencies

- GitHub CLI (`gh`) installed in service runtime
- GitHub OAuth device flow support
- Encryption key source for at-rest token encryption
- Scheduler/worker runtime for polling jobs

## Blocking Issues

- None
