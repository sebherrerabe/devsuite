---
id: "03-frontend-foundation"
title: "Frontend Foundation"
status: "pending"
priority: 3
assigned_pm: null
depends_on: ["00-scaffolding", "01-shared-types"]
unlocks: ["04-company-module", "05-repository-module", "06-project-module", "07-task-module", "08-session-module", "10-pr-review-module", "11-inbox-module", "13-performance-module", "14-invoicing-module"]
estimated_complexity: "high"
---

# Frontend Foundation

## Summary
Set up the React frontend application with all core infrastructure: Vite bundler, TanStack Router, TanStack Query, Tailwind CSS v4, shadcn/ui components, and the application shell (layout, navigation, company switcher). This creates the UI foundation that all feature modules build upon.

## Objective
Establish a modern, type-safe React application with beautiful UI defaults and clear patterns for feature development.

## Key Deliverables
- Vite + React 19 + TypeScript setup
- TanStack Router with file-based routing
- TanStack Query integration (for non-Convex data)
- Convex React client integration
- Tailwind CSS v4 + shadcn/ui component library
- Application shell (layout, sidebar, header)
- Company context and switcher
- Privacy mode toggle
- Theme system (light/dark)
- Base UI patterns and components

## Success Criteria
- [ ] `pnpm dev` starts Vite dev server
- [ ] Router works with type-safe routes
- [ ] Convex realtime subscriptions work
- [ ] shadcn/ui components render correctly
- [ ] Company switcher changes context
- [ ] Privacy mode toggles visibility
- [ ] Responsive layout works on desktop

## Architecture Reference

From `/dev_suite_conceptual_architecture_business_vs_tech.md`:

**Frontend Stack**:
- Vite
- React 19
- TypeScript
- TanStack Router
- TanStack Query
- Tailwind CSS v4
- shadcn/ui
- lucide-react (icons)

**Characteristics**:
- No server components
- No framework-imposed data fetching
- Fully client-controlled rendering

## Quick Links
- [Scope](./SCOPE.md)
- [Dependencies](./DEPENDENCIES.md)
- [Tasks](./TASKS.md)
- [Status](./STATUS.md)
