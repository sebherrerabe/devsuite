---
id: '11-inbox-module'
title: 'Inbox & Notifications'
status: 'pending'
priority: 10
assigned_pm: null
depends_on: ['04-company-module']
unlocks: ['15-notion-integration']
estimated_complexity: 'medium'
---

# Inbox & Notifications Module

## Summary

Implement a unified, company-scoped inbox for actionable notifications from external systems (GitHub, Notion) and internal events. Inbox items are intentionally minimal (title + link + icons) and designed to power automation workflows (e.g., "review requested" → create task + PR review).

## Objective

Provide a single place to triage actionable notifications and a stable trigger surface for automation.

## Key Deliverables

- Inbox item conventions:
  - Items represent external **notification threads** (per provider) and are updated when new activity occurs (de-duped via idempotent upsert).
  - Items are PR-scoped for GitHub ingestion (no issue-only / repo-level noise by default).
  - Content remains minimal: title + url (+ optional externalId); UI uses provider + event kind for icons.
  - Store external references only (identifiers/links), not mirrored content.
- Convex functions:
  - upsertInboxItem (idempotent; key: companyId + source + `content.externalId` (provider thread id))
  - markAsRead / markAsUnread
  - archive / unarchive
  - listInboxItems (filters: unread, archived, source, event kind/type, repository)
  - getUnreadCount (badge)
- UI:
  - Inbox page with filtering (provider, type/event kind, repo, unread/archived)
  - Inbox item row/card component (icons + title + link + timestamp)
  - Read/archive actions (single + bulk)
  - Unread badge in the shell/header
- Integration handoffs:
  - GitHub notifications are ingested via GitHub CLI auth (no org OAuth app requirement) and gated by the company repository list.
  - Notion notifications are ingested by Notion Integration (links + notifications only).

## Success Criteria

- [ ] Inbox shows aggregated notifications
- [ ] External updates de-dupe correctly (thread-level upsert; no duplicate rows for the same thread)
- [ ] Can mark items as read/unread
- [ ] Can archive/unarchive items
- [ ] Filter by provider + type/event kind + repository
- [ ] Respects current company scope
- [ ] Badge shows unread count
- [ ] Item UI is minimal: title + link + icons

## Architecture Reference

From spec section 2.8:

- Aggregates external notifications (GitHub, Notion) and internal events
- Items can be read or archived
- Scoped by company and privacy mode

## Quick Links

- [Scope](./SCOPE.md) _(to be created by AI PM)_
- [Dependencies](./DEPENDENCIES.md) _(to be created by AI PM)_
- [Tasks](./TASKS.md) _(to be created by AI PM)_
- [Status](./STATUS.md) _(to be created by AI PM)_

## Notes for AI PM

When decomposing this project:

1. Single-user, company-scoped behavior: no per-user read state (yet)
2. Model items as **threads** with idempotent upsert semantics; use event kind as the automation trigger surface
3. GitHub ingestion is PR-scoped and gated by the company’s validated repository list
4. Keep UI minimal (title/link/icons) and avoid storing external content bodies
5. Ensure extensibility for future providers (e.g., Figma) without schema rewrite
