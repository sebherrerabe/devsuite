---
id: '06-project-module'
title: 'Project Module'
status: 'pending'
priority: 6
assigned_pm: null
depends_on: ['05-repository-module']
unlocks: ['07-task-module']
estimated_complexity: 'medium'
---

# Project Module

## Summary

Implement the Project entity as a complete vertical slice. Projects are the main organizational surface for daily work - they group tasks and sessions, belong to a company, and can be associated with repositories.

## Objective

Enable users to create and manage projects as containers for their work.

## Key Deliverables

- Convex functions: createProject, updateProject, deleteProject, listProjects, getProject
- Project list page with filtering
- Project creation form
- Project detail page (dashboard for the project)
- Project-repository association UI
- Project selector component

## Success Criteria

- [ ] Can create a project within a company
- [ ] Can associate project with repositories
- [ ] Can list and filter projects
- [ ] Project detail shows summary (tasks, sessions)
- [ ] Can soft-delete a project

## Architecture Reference

From spec section 2.3:

- Belongs to one company
- Can be associated with one or more repositories
- Contains tasks and sessions
- Main organisational surface for daily work

## Quick Links

- [Scope](./SCOPE.md) _(to be created by AI PM)_
- [Dependencies](./DEPENDENCIES.md) _(to be created by AI PM)_
- [Tasks](./TASKS.md) _(to be created by AI PM)_
- [Status](./STATUS.md) _(to be created by AI PM)_

## Notes for AI PM

When decomposing this project:

1. Project is a grouping mechanism, not deep logic
2. Consider what the project detail page should show
3. Repository association is optional (many-to-many)
4. Project selector will be used by task and session modules
