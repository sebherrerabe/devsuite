# Scope: Shared Types & Schemas

## In Scope

### Entity Types

Define TypeScript types for all core domain entities:

- **Company**: id, name, metadata, createdAt, updatedAt, isDeleted
- **Repository**: id, companyId, name, url, provider, metadata
- **Project**: id, companyId, name, description, repositoryIds, metadata
- **Task**: id, projectId, parentTaskId, title, status, complexity, tags, externalLinks
- **Session**: id, companyId, startTime, endTime, summary, taskIds
- **SessionTask**: sessionId, taskId, notes, timeDistribution
- **ExternalLink**: type (github_pr, github_issue, notion, ticktick, url), identifier, url
- **InboxItem**: id, companyId, type, source, content, isRead, isArchived
- **PRReview**: id, repositoryId, prIdentifier, content, metadata, createdAt
- **PerformanceSignal**: type, value, entityId, timestamp
- **Invoice**: id, companyId, periodStart, periodEnd, sessions, rateCard, total

### Status Enums

- TaskStatus: todo, in_progress, blocked, done, cancelled
- InboxItemType: notification, pr_review, mention, etc.
- ExternalLinkType: github_pr, github_issue, notion, ticktick, url

### Zod Schemas

Runtime validation schemas matching each TypeScript type:

- Input schemas (for creation/mutation)
- Output schemas (for API responses)
- Partial schemas (for updates)

### Utility Types

- Branded types for IDs (CompanyId, TaskId, etc.)
- Timestamp types
- Pagination types
- Error types

### Utility Functions

- ID generation helpers
- Date/time helpers
- Validation helpers

## Out of Scope

- Database schema definitions (covered by: 02-convex-foundation)
- API route definitions (covered by: feature modules)
- UI component props (covered by: feature modules)
- MCP tool schemas (covered by: 09-mcp-server)

## Boundaries

### Types vs Implementation

This package defines data shapes only. Business logic implementation belongs in Convex functions or feature modules.

### Shared vs Feature-Specific

Only types used by 2+ packages belong here. Feature-specific types stay in their respective packages.

### Validation vs Business Rules

Zod schemas validate data shape and basic constraints (required fields, string lengths). Business rules (e.g., "task must belong to valid project") are enforced in Convex.

## Assumptions

- TypeScript strict mode is enabled
- Zod is the validation library
- IDs are strings (Convex convention)
- Timestamps are numbers (Unix milliseconds)
- Soft delete pattern: `isDeleted` boolean + `deletedAt` timestamp

## Open Questions

- [ ] Should we use branded types for all IDs? (owner: @backend-engineer)
- [ ] Zod vs Valibot for validation? (owner: @human-review)
- [ ] Include API response wrapper types here or in feature modules? (owner: @backend-engineer)
