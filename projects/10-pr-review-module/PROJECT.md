---
id: '10-pr-review-module'
title: 'PR Review Module'
status: 'pending'
priority: 9
assigned_pm: null
depends_on: ['05-repository-module']
unlocks: ['13-performance-module']
estimated_complexity: 'medium'
---

# PR Review Module

## Summary

Implement manual PR review tracking as durable, company-scoped records. A PR review is primarily a markdown document plus minimal metadata (repository, PR URL, base/head branches). This module focuses on creating, editing, browsing, and soft-deleting reviews via the web UI.

## Objective

Let users capture PR review notes in a simple markdown file, tied to a repository + PR, and revisit them later.

## Key Deliverables

- Convex schema + functions for `PRReview`:
  - createPRReview (metadata only, content optional/empty)
  - updatePRReview (metadata + markdown content)
  - listPRReviews (company-scoped; filter by repository/date; exclude deleted)
  - getPRReview (detail)
  - softDeletePRReview (always soft delete)
- UI:
  - Create PR Review form (collect metadata, then redirect to detail)
  - PR review list/history page (filter by repository/date)
  - PR review detail page with markdown editor (reuse the existing task panel editor style)
  - Edit metadata from the detail page
- No validation for `prUrl` in this module (accept any URL string)

## Success Criteria

- [ ] Can create a PR review by entering: repository, PR URL, base branch, head branch (title optional)
- [ ] Review is persisted in Convex and is company-scoped (tenant isolated)
- [ ] Detail page allows editing markdown content with the same UX as the task panel editor (plain markdown, not rich text)
- [ ] Can edit metadata after creation
- [ ] Can list/browse PR reviews and filter by repository/date
- [ ] Can soft-delete a review and it disappears from default lists

## Architecture Reference

From core principles:

- Reviews are durable artifacts, not ephemeral
- Review content is markdown
- Reviews reference external systems (PR URL), they do not mirror PR diffs/metadata
- No hard deletes: soft delete only
- All data is company-scoped

## Quick Links

- [Scope](./SCOPE.md) _(to be created by AI PM)_
- [Dependencies](./DEPENDENCIES.md) _(to be created by AI PM)_
- [Tasks](./TASKS.md) _(to be created by AI PM)_
- [Status](./STATUS.md) _(to be created by AI PM)_

## Notes for AI PM

When decomposing this project:

1. Start with manual review CRUD; do not build MCP tools in this project phase
2. Required fields: `repositoryId`, `prUrl`, `baseBranch`, `headBranch`; optional: `title`, `contentMarkdown`
3. Do not validate URLs yet; treat integrations as a later project (e.g. GitHub integration + MCP ingestion)
4. Reuse the existing task panel markdown editor component/style (currently `MDXMarkdownEditor` in `apps/web/src/components/markdown/mdx-markdown-editor`) for a “TickTick/Notion-like” writing feel (still plain markdown)
5. Keep the schema flexible to add future agent-produced metadata (signals, risk areas) without reworking the core model
