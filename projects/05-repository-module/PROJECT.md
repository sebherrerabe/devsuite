---
id: "05-repository-module"
title: "Repository Module"
status: "pending"
priority: 5
assigned_pm: null
depends_on: ["04-company-module"]
unlocks: ["06-project-module", "10-pr-review-module", "12-github-integration"]
estimated_complexity: "medium"
---

# Repository Module

## Summary
Implement the Repository entity as a complete vertical slice: Convex functions, React UI, and integration patterns. Repositories represent external source-code repositories (GitHub, etc.) and are used to contextualize work like PRs, branches, and reviews.

## Objective
Enable users to link external repositories to companies and use them as context for work tracking.

## Key Deliverables
- Convex functions: createRepository, updateRepository, deleteRepository, listRepositories, getRepository
- Repository list page (per company)
- Repository creation form (link external repo)
- Repository detail/settings page
- Repository selector component (for use in other modules)

## Success Criteria
- [ ] Can link a GitHub repository to a company
- [ ] Can list repositories for current company
- [ ] Can edit repository details
- [ ] Can soft-delete a repository
- [ ] Repository appears in selectors for projects/PRs

## Architecture Reference

From spec section 2.2:
- Belongs to a company
- Is an external reference (GitHub, etc.)
- Used to contextualise work (PRs, branches, reviews)
- DevSuite never mirrors repository content — only identifiers and links

## Quick Links
- [Scope](./SCOPE.md) _(to be created by AI PM)_
- [Dependencies](./DEPENDENCIES.md) _(to be created by AI PM)_
- [Tasks](./TASKS.md) _(to be created by AI PM)_
- [Status](./STATUS.md) _(to be created by AI PM)_

## Notes for AI PM
When decomposing this project:
1. Repository is a reference, not a mirror - store URL/identifier only
2. Consider GitHub-specific fields (owner, repo name) vs generic fields
3. Design for future support of GitLab, Bitbucket, etc.
4. Create reusable repository selector component
