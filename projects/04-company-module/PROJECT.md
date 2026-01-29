---
id: '04-company-module'
title: 'Company Module'
status: 'pending'
priority: 4
assigned_pm: null
depends_on: ['02-convex-foundation', '03-frontend-foundation']
unlocks:
  [
    '05-repository-module',
    '08-session-module',
    '11-inbox-module',
    '14-invoicing-module',
  ]
estimated_complexity: 'medium'
---

# Company Module

## Summary

Implement the Company entity as a complete vertical slice: Convex functions (CRUD, queries), React UI (list, create, edit, settings), and all related business logic. Companies are the root organizational boundary in DevSuite - all other entities belong to a company.

## Objective

Enable users to create, manage, and switch between companies with full CRUD operations and a polished UI.

## Key Deliverables

- Convex functions: createCompany, updateCompany, deleteCompany (soft), listCompanies, getCompany
- Company list page
- Company creation modal/form
- Company settings page
- Company switching integration with shell

## Success Criteria

- [ ] Can create a new company
- [ ] Can edit company details
- [ ] Can soft-delete a company
- [ ] Company switcher shows all companies
- [ ] Deleting a company doesn't delete related data (soft delete cascade rules)

## Architecture Reference

From spec section 2.1:

- Represents a legal or organisational boundary
- All work belongs to exactly one company
- Used for privacy isolation, billing, reporting
- User can switch between company-scoped and private global mode

## Quick Links

- [Scope](./SCOPE.md) _(to be created by AI PM)_
- [Dependencies](./DEPENDENCIES.md) _(to be created by AI PM)_
- [Tasks](./TASKS.md) _(to be created by AI PM)_
- [Status](./STATUS.md) _(to be created by AI PM)_

## Notes for AI PM

When decomposing this project:

1. Split into Backend (Convex) and Frontend tasks
2. Design UI before implementing
3. Consider company switcher integration with 03-frontend-foundation
4. Define validation rules for company data
