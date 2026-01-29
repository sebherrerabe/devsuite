---
id: "00-scaffolding"
title: "Project Scaffolding"
status: "pending"
priority: 1
assigned_pm: null
depends_on: []
unlocks: ["01-shared-types", "02-convex-foundation", "03-frontend-foundation"]
estimated_complexity: "medium"
---

# Project Scaffolding

## Summary
Set up the monorepo structure, tooling, and development environment for DevSuite. This project creates the foundation that all other projects build upon, including package management, TypeScript configuration, linting, and the basic folder structure.

## Objective
Establish a working monorepo with all tooling configured so that subsequent projects can immediately begin development.

## Key Deliverables
- pnpm workspace configuration
- TypeScript project references setup
- ESLint + Prettier configuration
- Git hooks (husky + lint-staged)
- Base folder structure matching architecture spec
- Development scripts (dev, build, lint, typecheck)
- README with setup instructions

## Success Criteria
- [ ] `pnpm install` works from repo root
- [ ] `pnpm dev` starts all dev servers
- [ ] `pnpm lint` runs across all packages
- [ ] `pnpm typecheck` validates all TypeScript
- [ ] New package can be added following documented pattern
- [ ] CI-ready (scripts work in fresh clone)

## Architecture Reference

From `/dev_suite_conceptual_architecture_business_vs_tech.md`:

```
devsuite/
  apps/
    web/        # Vite frontend
    mcp/        # MCP server
  convex/       # Backend schema & functions
  packages/
    shared/     # Types, schemas, utilities
  docs/
    llm/        # Agent guardrails & conventions
```

## Quick Links
- [Scope](./SCOPE.md)
- [Dependencies](./DEPENDENCIES.md)
- [Tasks](./TASKS.md)
- [Status](./STATUS.md)
