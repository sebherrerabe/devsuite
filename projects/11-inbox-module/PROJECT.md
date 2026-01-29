---
id: "11-inbox-module"
title: "Inbox & Notifications"
status: "pending"
priority: 10
assigned_pm: null
depends_on: ["04-company-module"]
unlocks: ["15-notion-integration"]
estimated_complexity: "medium"
---

# Inbox & Notifications Module

## Summary
Implement the unified inbox that aggregates notifications from external systems (GitHub, Notion) and internal events. Inbox items are company-scoped and respect privacy mode.

## Objective
Provide a single place for users to see all notifications and action items.

## Key Deliverables
- Convex functions: createInboxItem, markAsRead, archive, listInboxItems
- Inbox page with filtering
- Inbox item components (various types)
- Read/archive actions
- Notification badges
- Company scoping for inbox

## Success Criteria
- [ ] Inbox shows aggregated notifications
- [ ] Can mark items as read
- [ ] Can archive items
- [ ] Filter by type/source
- [ ] Respects current company scope
- [ ] Badge shows unread count

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
1. Inbox items come from multiple sources - design extensibly
2. Different item types may need different UI treatments
3. Privacy mode affects visibility
4. Consider notification grouping/batching
