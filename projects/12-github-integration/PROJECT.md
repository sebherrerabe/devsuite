---
id: '12-github-integration'
title: 'GitHub Integration'
status: 'in-progress'
priority: 9
assigned_pm: null
depends_on: ['05-repository-module', '09-mcp-server']
unlocks: ['10-pr-review-module', '11-inbox-module']
estimated_complexity: 'high'
---

# GitHub Integration

## Summary

Build a dedicated Node.js GitHub integration service that runs GitHub CLI operations server-side with strict per-user isolation. Users connect GitHub from the web UI through a browser-first device flow, and DevSuite stores only secure integration state plus normalized references for notifications and PR discovery.

## Objective

Deliver a production-ready GitHub integration with zero local bridge setup, per-user secure auth, and reliable notifications plus PR discovery.

## Key Deliverables

- New Node.js GitHub integration service (`apps/gh-service`)
- Browser-first connect/disconnect UX in web app
- Per-user isolated GitHub execution model on server
- Company-level org mapping for notification routing
- Notification polling pipeline with idempotent inbox ingest
- PR discovery endpoints for MCP tools
- Security, observability, and runbook docs

## Success Criteria

- [ ] No local bridge process or terminal pairing required
- [ ] User can connect GitHub from the web app and remain connected across sessions
- [ ] GitHub operations are isolated per user and cannot leak auth context
- [ ] Notifications route to the correct company using configured org mapping
- [ ] MCP PR discovery works on demand with user-scoped authorization
- [ ] Secrets/tokens are encrypted at rest and not exposed in logs or UI

## Execution Plan (Phase Order)

1. Phase 1: Contract + service skeleton + auth boundary
2. Phase 2: Browser-first GitHub connect/disconnect
3. Phase 3: User-scoped `gh` execution engine
4. Phase 4: Notification polling + company routing
5. Phase 5: MCP PR discovery + hardening + rollout

## Quick Links

- [Scope](./SCOPE.md)
- [Dependencies](./DEPENDENCIES.md)
- [Tasks](./TASKS.md)
- [Status](./STATUS.md)
