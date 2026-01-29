---
id: "07-task-module"
title: "Task Module"
status: "pending"
priority: 7
assigned_pm: null
depends_on: ["06-project-module"]
unlocks: ["08-session-module", "13-performance-module", "16-ticktick-integration"]
estimated_complexity: "high"
---

# Task Module

## Summary
Implement the Task entity as a complete vertical slice. Tasks represent intent or outcome (not time) and are hierarchical. They support external links to GitHub issues/PRs, Notion pages, TickTick tasks, and arbitrary URLs.

## Objective
Enable users to manage hierarchical tasks with rich metadata and external system links.

## Key Deliverables
- Convex functions: full CRUD, hierarchy operations, status changes
- Task list view with hierarchy visualization
- Task creation/edit form
- Task detail view
- External link management UI
- Task tree component (recursive)
- Task selector component (for sessions)
- Status management (todo, in_progress, blocked, done, cancelled)

## Success Criteria
- [ ] Can create tasks with parent-child relationships
- [ ] Can set complexity score (1-10)
- [ ] Can add/remove external links
- [ ] Task tree renders correctly
- [ ] Can change task status
- [ ] Tasks are never hard-deleted

## Architecture Reference

From spec section 2.4:
- Tasks are hierarchical (may have children)
- Belongs to exactly one project
- May link to external systems (Notion, GitHub, TickTick, URL)
- Has status, optional complexity score, optional tags
- Tasks are never deleted — they represent historical intent

## Quick Links
- [Scope](./SCOPE.md) _(to be created by AI PM)_
- [Dependencies](./DEPENDENCIES.md) _(to be created by AI PM)_
- [Tasks](./TASKS.md) _(to be created by AI PM)_
- [Status](./STATUS.md) _(to be created by AI PM)_

## Notes for AI PM
When decomposing this project:
1. Hierarchical data is complex - design tree operations carefully
2. External links are typed - design for extensibility
3. Task tree UI is a significant component - may need separate design task
4. Consider drag-and-drop for hierarchy management
5. Status workflow may have rules (e.g., can't go from done to todo)
