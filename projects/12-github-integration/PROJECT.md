---
id: "12-github-integration"
title: "GitHub Integration"
status: "pending"
priority: 9
assigned_pm: null
depends_on: ["05-repository-module", "09-mcp-server"]
unlocks: []
estimated_complexity: "medium"
---

# GitHub Integration

## Summary
Implement GitHub integration for PR discovery, review history, and notifications. Uses GitHub CLI for local authentication - no organization OAuth required. This is read-only integration focused on surfacing GitHub activity in DevSuite.

## Objective
Connect DevSuite to GitHub for PR awareness and notifications without complex OAuth setup.

## Key Deliverables
- GitHub CLI wrapper in MCP server
- PR discovery (open PRs for linked repos)
- GitHub notification sync to inbox
- PR metadata fetching for reviews
- Link generation to GitHub web

## Success Criteria
- [ ] Can list open PRs for a repository
- [ ] GitHub notifications appear in inbox
- [ ] PR links open correct GitHub page
- [ ] Works with gh CLI authentication
- [ ] Handles rate limiting gracefully

## Architecture Reference

From spec section 6:
- Read-only integration
- Via GitHub CLI (no OAuth)
- Used for PR discovery, review history, notifications

## Quick Links
- [Scope](./SCOPE.md) _(to be created by AI PM)_
- [Dependencies](./DEPENDENCIES.md) _(to be created by AI PM)_
- [Tasks](./TASKS.md) _(to be created by AI PM)_
- [Status](./STATUS.md) _(to be created by AI PM)_

## Notes for AI PM
When decomposing this project:
1. GitHub CLI must be installed and authenticated
2. Focus on read operations only
3. Rate limiting is a real concern
4. Notification sync can be polling-based initially
