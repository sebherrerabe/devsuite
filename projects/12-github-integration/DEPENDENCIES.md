# Dependencies: GitHub Integration

## Required Inputs

### From 04-company-module

- [ ] Company membership and access checks
- [ ] Company settings surface to store GitHub org login mappings

### From 05-repository-module

- [ ] Company-scoped repository metadata (provider, owner/repo URL)

### From 09-mcp-server

- [ ] MCP auth model for agent-only PR discovery tools
- [ ] Tool interface contract for PR discovery payloads

### From Auth Layer

- [ ] Reliable user identity/session verification in Node service
- [ ] Service-to-backend auth between Node service and Convex HTTP/actions

## Produced Outputs

### For 10-pr-review-module

- [ ] User-authorized PR discovery for linked repos
- [ ] Stable normalized PR payload for review workflows

### For 11-inbox-module

- [ ] Notification sync records with idempotent upsert semantics
- [ ] Last-sync/health metadata for UI and ops

## External Dependencies

- GitHub CLI (`gh`) installed in service runtime
- GitHub OAuth device flow support
- Encryption key source for at-rest token encryption
- Scheduler/worker runtime for polling jobs

## Blocking Issues

- Final choice for encryption key source
- Final policy for unmatched-org notifications
