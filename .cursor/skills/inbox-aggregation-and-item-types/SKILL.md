---
name: inbox-aggregation-and-item-types
description: Implement DevSuite's unified inbox that aggregates notifications from external systems (GitHub, Notion) and internal events. Handle multiple item types, company scoping, read/archive actions, and privacy mode filtering. Use when implementing inbox functionality, notification aggregation, or multi-source notification systems.
---

# Inbox Aggregation and Item Types

## Intent
This skill guides implementation of DevSuite's unified inbox system that aggregates notifications from multiple sources (GitHub, Notion, internal events) into a single, company-scoped interface with read/archive capabilities and privacy mode support.

## Non-Goals
- Implementing external integrations (use `notion-integration-minimal`, `github-cli-integration` for that)
- Creating notification sources (this skill consumes them)
- Building notification delivery mechanisms (assumes sources exist)

## Inputs to Read First
- Repo: `projects/11-inbox-module/PROJECT.md` (inbox requirements)
- Repo: `projects/_conventions.md` (spec standards)
- Repo: `/dev_suite_conceptual_architecture_business_vs_tech.md` (section 2.8)
- Repo: `projects/04-company-module/PROJECT.md` (company scoping)
- Repo: `projects/12-github-integration/PROJECT.md` (GitHub notifications)
- Repo: `projects/15-notion-integration/PROJECT.md` (Notion notifications)

## Workflow

### 1) Design the Inbox Item Data Model
- Inbox items are polymorphic—they represent different notification types
- Schema in `convex/schema.ts`:

```typescript
inboxItems: defineTable({
  companyId: v.id("companies"),
  type: v.union(
    v.literal("github_pr"),
    v.literal("github_issue"),
    v.literal("notion_page_update"),
    v.literal("internal_pr_review_ready"),
    v.literal("internal_task_blocked"),
    // ... other types
  ),
  source: v.string(), // "github", "notion", "internal"
  externalId: v.optional(v.string()), // ID from external system
  title: v.string(),
  body: v.optional(v.string()), // Markdown or plain text
  linkUrl: v.optional(v.string()), // Link back to source
  metadata: v.optional(v.any()), // Type-specific data (flexible)
  readAt: v.optional(v.number()), // Timestamp when read
  archivedAt: v.optional(v.number()), // Timestamp when archived
  createdAt: v.number(),
  deletedAt: v.optional(v.number()), // Soft delete
})
  .index("by_company", ["companyId"])
  .index("by_company_unread", ["companyId", "readAt"])
  .index("by_company_type", ["companyId", "type"])
```

### 2) Implement Convex Functions

**Queries**:
- `list`: Get inbox items for company (filter unarchived, respect privacy mode)
- `listUnread`: Get unread items only
- `listByType`: Filter by item type
- `get`: Get single item

**Mutations**:
- `create`: Create inbox item (called by integration modules)
- `markAsRead`: Set `readAt` timestamp
- `markAsUnread`: Clear `readAt`
- `archive`: Set `archivedAt` timestamp
- `unarchive`: Clear `archivedAt`

**Privacy mode handling**:
- If user is in "private global mode", show items across all companies
- If user is in "company-scoped mode", filter by current company only
- Implement via query parameter or context

### 3) Define Item Type Schemas
Create type definitions for each item type in `packages/shared/src/types.ts`:

```typescript
export type InboxItemType =
  | "github_pr"
  | "github_issue"
  | "notion_page_update"
  | "internal_pr_review_ready"
  | "internal_task_blocked";

export interface GitHubPRItem {
  type: "github_pr";
  source: "github";
  externalId: string; // PR number
  title: string;
  body?: string;
  linkUrl: string; // GitHub PR URL
  metadata: {
    repository: string;
    author: string;
    state: "open" | "closed" | "merged";
  };
}

export interface NotionPageUpdateItem {
  type: "notion_page_update";
  source: "notion";
  externalId: string; // Notion page ID
  title: string;
  body?: string;
  linkUrl: string; // Notion page URL
  metadata: {
    pageId: string;
    updatedBy: string;
  };
}

// ... other types
```

### 4) Build Inbox UI Components

**Inbox List Page** (`apps/web/src/routes/inbox/index.tsx`):
- Show unread count badge
- Filter by type (dropdown/tabs)
- Filter by read/unread status
- Group by date (today, yesterday, this week)
- Each item shows: icon (type-specific), title, preview, timestamp, actions

**Inbox Item Component**:
- Type-specific rendering:
  - GitHub PR: Show repo name, PR number, author, state badge
  - Notion update: Show page title, updated by
  - Internal events: Show internal icon, description
- Click to mark as read / navigate to detail
- Archive button
- Link to external source (if applicable)

**Inbox Detail View** (optional):
- Full item content
- Metadata display
- Actions (read, archive, link to source)

### 5) Integration Points

**From GitHub Integration** (`projects/12-github-integration`):
- When PR created/updated: call `inboxItems.create` with type `github_pr`
- When issue created/updated: call `inboxItems.create` with type `github_issue`
- Include repository, PR/issue number, author, state

**From Notion Integration** (`projects/15-notion-integration`):
- When page updated: call `inboxItems.create` with type `notion_page_update`
- Include page ID, title, updated by user

**From Internal Modules**:
- PR Review ready: `internal_pr_review_ready` type
- Task blocked: `internal_task_blocked` type
- Other internal events as needed

### 6) Notification Badge
- Add badge to main navigation showing unread count
- Update in realtime via Convex subscription
- Click badge to navigate to inbox

### 7) Bulk Actions
- "Mark all as read" button
- "Archive all read" button
- Filter + bulk archive

### 8) Privacy Mode Support
- Read current privacy mode from context/state
- If "private global mode": query across all companies
- If "company-scoped mode": filter by current company
- Update queries accordingly

## Deliverables Checklist
- [ ] Inbox item schema defined with type union
- [ ] Convex queries implemented (list, listUnread, listByType)
- [ ] Convex mutations implemented (create, markAsRead, archive)
- [ ] Item type definitions in shared types
- [ ] Inbox list page with filtering
- [ ] Inbox item components (type-specific rendering)
- [ ] Integration points from GitHub/Notion/internal modules
- [ ] Notification badge in navigation
- [ ] Privacy mode filtering implemented
- [ ] Bulk actions (mark all read, archive all read)
- [ ] Company scoping enforced

## Item Type Implementation Guide

### GitHub PR Item
- Icon: GitBranch or PullRequest icon
- Display: `[repo] #123: Title` format
- Badge: PR state (open/closed/merged)
- Link: Opens GitHub PR in new tab

### GitHub Issue Item
- Icon: AlertCircle icon
- Display: `[repo] #456: Title` format
- Badge: Issue state (open/closed)
- Link: Opens GitHub issue in new tab

### Notion Page Update Item
- Icon: FileText icon
- Display: Page title with "Updated by X"
- Link: Opens Notion page in new tab

### Internal PR Review Ready
- Icon: CheckCircle icon
- Display: "PR review ready for [repo] #123"
- Link: Navigate to PR review detail page

### Internal Task Blocked
- Icon: AlertTriangle icon
- Display: "Task '[name]' is blocked"
- Link: Navigate to task detail page

## References
- `projects/11-inbox-module/PROJECT.md` - Inbox requirements
- `projects/_conventions.md` - Spec standards
- `/dev_suite_conceptual_architecture_business_vs_tech.md` - Section 2.8
- `vertical-slice-module-implementation` skill - General module patterns
