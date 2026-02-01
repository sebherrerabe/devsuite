---
id: '08-session-module'
title: 'Session Module'
status: 'pending'
priority: 8
assigned_pm: null
depends_on: ['04-company-module', '07-task-module']
unlocks: ['13-performance-module', '14-invoicing-module']
estimated_complexity: 'high'
---

# Session Module

## Summary

Implement the Session entity as a complete vertical slice. Sessions represent effort over time and are the primary source of truth for time tracking, performance analysis, and invoicing. A session can touch multiple tasks or none (exploratory work).

## Objective

Enable users to track work sessions with start/end times, task associations, and summaries.

## Key Deliverables

- Convex functions: startSession, endSession, updateSession, listSessions, getSession
- Session-Task junction operations
- Active session timer UI
- Session list/history view
- Session detail view with task associations
- Session creation (manual entry)
- Time distribution hints UI (optional)

## Success Criteria

- [ ] Can start a new session
- [ ] Timer shows elapsed time
- [ ] Can associate session with tasks
- [ ] Can end session with summary
- [ ] Can view session history
- [ ] Sessions support exploratory work (no tasks)

## Architecture Reference

From spec sections 2.5, 2.6:

- Session has start and end time
- Belongs to one company
- May touch multiple tasks
- Contains human summary
- Primary source of truth for time tracking, performance, invoicing
- Session-Task relationship may include per-task notes, time distribution

## Quick Links

- [Scope](./SCOPE.md)
- [Dependencies](./DEPENDENCIES.md) _(to be created by AI PM)_
- [Tasks](./TASKS.md) _(to be created by AI PM)_
- [Status](./STATUS.md) _(to be created by AI PM)_

## Notes for AI PM

When decomposing this project:

1. Active session timer is a key UI component
2. Session-Task junction needs careful design
3. Consider "quick session" flow vs detailed entry
4. Time distribution hints are optional complexity
5. This feeds into invoicing - accuracy matters
