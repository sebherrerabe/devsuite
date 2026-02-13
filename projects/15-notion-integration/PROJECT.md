---
id: '15-notion-integration'
title: 'Notion Integration'
status: 'planning'
priority: 13
assigned_pm: null
depends_on: ['11-inbox-module']
unlocks: []
estimated_complexity: 'low'
---

# Notion Integration

## Summary

Implement minimal Notion integration for links and notifications with UI-first pairing. This is not a full Notion sync - only explicit linking, metadata validation, and notification forwarding into the inbox.

## Objective

Allow users to pair Notion from the UI, link tasks to Notion pages, and surface Notion updates in the inbox with strict tenant isolation.

## Key Deliverables

- UI-only Notion OAuth pairing flow (connect/status/disconnect)
- Notion API client + encrypted token lifecycle management
- Link validation (verify Notion page exists and fetch display title)
- Webhook ingestion for Notion events and inbox item creation
- Company-scoped routing and auditable integration settings

## Success Criteria

- [ ] User can connect and disconnect Notion from the Integrations UI without manual token copy/paste
- [ ] Each company is paired to exactly one Notion workspace
- [ ] Task can link to a Notion page and resolve page title when access is granted
- [ ] Notion updates appear as company-scoped inbox items
- [ ] Integration stores external references only (IDs/URLs/titles), not mirrored Notion content
- [ ] Requested Notion capabilities are limited to minimum viable read scopes

## Architecture Reference

From spec section 6:

- Minimal API usage
- Links and notifications only
- Company-specific behaviour via plugins/adapters

## Quick Links

- [Scope](./SCOPE.md)
- [Dependencies](./DEPENDENCIES.md)
- [Tasks](./TASKS.md)
- [Status](./STATUS.md)

## Notes for AI PM

When decomposing this project:

1. Pairing must be fully UI-driven via OAuth (no manual integration token entry).
2. Keep scope minimal - links and notifications only.
3. One company maps to one Notion org/workspace.
4. Minimum Notion capabilities: `read content`, `read comments`; `user info without email` optional.
5. Prefer webhook-first notification ingestion with idempotent delivery handling.
