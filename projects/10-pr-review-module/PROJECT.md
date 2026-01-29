---
id: '10-pr-review-module'
title: 'PR Review Module'
status: 'pending'
priority: 9
assigned_pm: null
depends_on: ['05-repository-module', '09-mcp-server']
unlocks: ['13-performance-module']
estimated_complexity: 'high'
---

# PR Review Module

## Summary

Implement PR review storage, history, and UI. This module integrates with the existing pr-review MCP tool workflow, storing review artifacts as durable records. The MCP server handles review generation; this module handles persistence and presentation.

## Objective

Enable users to browse, search, and revisit PR reviews with correlation to workload and projects.

## Key Deliverables

- Convex functions: storePRReview, listPRReviews, getPRReview
- MCP tool: submitPRReview (receives review from agent)
- PR review history page
- PR review detail view
- Filters by company, repository, date
- Links back to GitHub
- Review metadata display (risk areas, signals)

## Success Criteria

- [ ] MCP can submit a PR review
- [ ] Review is persisted in Convex
- [ ] UI shows review history
- [ ] Can filter by repo and date
- [ ] Review detail shows full content
- [ ] Links to GitHub work

## Architecture Reference

From spec sections 2.9, 2.10, 5:

- PR reviews are durable artifacts, not ephemeral
- Review content is typically markdown from AI agents
- MCP server is source of truth for review generation
- DevSuite persists outputs and provides UI
- Correlate reviews with sessions and workload

## Quick Links

- [Scope](./SCOPE.md) _(to be created by AI PM)_
- [Dependencies](./DEPENDENCIES.md) _(to be created by AI PM)_
- [Tasks](./TASKS.md) _(to be created by AI PM)_
- [Status](./STATUS.md) _(to be created by AI PM)_

## Notes for AI PM

When decomposing this project:

1. Review content is markdown - design for readability
2. MCP tool receives review data, doesn't generate it
3. Consider how reviews link to sessions (optional)
4. Metadata schema should be flexible (signals vary)
5. This is a showcase feature - UI polish matters
