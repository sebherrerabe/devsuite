---
name: qa-validation-checklists
description: Create QA validation checklists for DevSuite modules focusing on invariants (soft delete, company scoping, privacy mode) and module-specific flows. Use when validating module implementations, performing QA checks, or ensuring compliance with DevSuite architectural rules.
---

# QA Validation Checklists

## Intent

This skill provides structured validation checklists for QA/testing DevSuite modules, ensuring compliance with core invariants (soft delete, company scoping, privacy mode) and verifying module-specific functionality works correctly.

## Non-Goals

- Writing unit tests (focuses on manual/integration validation)
- Performance testing (covered by `performance-module` skill)
- Security auditing (focuses on functional correctness)

## Inputs to Read First

- Repo: `projects/_conventions.md` (spec standards)
- Repo: `/dev_suite_conceptual_architecture_business_vs_tech.md` (invariants section 2.12)
- Repo: `projects/XX-module-name/PROJECT.md` (module requirements)
- Repo: `projects/XX-module-name/SCOPE.md` (module scope)

## Workflow

### 1) Core Invariant Validation (All Modules)

#### Soft Delete Invariant

- [ ] **No hard deletes exist**: Search codebase for `db.delete()` calls—should be zero
- [ ] **Soft delete implemented**: All delete operations set `deletedAt` timestamp
- [ ] **Queries filter deleted items**: All list/get queries exclude `deletedAt !== undefined`
- [ ] **Cascade behavior**: Verify soft-deleted parent entities don't break child queries
- [ ] **UI reflects soft delete**: Deleted items don't appear in lists, but may appear in "archived" views

**Test Cases**:

1. Create entity → Delete entity → Verify `deletedAt` is set (not removed from DB)
2. List entities → Verify deleted entity doesn't appear
3. Query by ID → Verify deleted entity returns null or error
4. Soft delete parent → Verify children queries still work (or handle gracefully)

#### Company Scoping Invariant

- [ ] **All entities have `companyId`**: Schema includes `companyId: v.id("companies")`
- [ ] **Queries filter by company**: All queries include company filter
- [ ] **Mutations enforce company**: Create/update operations set/verify `companyId`
- [ ] **UI respects company context**: Switching companies shows different data
- [ ] **Cross-company access blocked**: Cannot access entities from other companies

**Test Cases**:

1. Create entity in Company A → Switch to Company B → Verify entity doesn't appear
2. Try to update entity from Company A while in Company B → Should fail
3. Try to query entity by ID from different company → Should return null/error
4. Company switcher changes data immediately

#### Privacy Mode Invariant

- [ ] **Private global mode**: Shows data across all companies
- [ ] **Company-scoped mode**: Shows data only for current company
- [ ] **Mode switching works**: Toggle between modes updates UI correctly
- [ ] **Inbox respects privacy mode**: Filters notifications by mode

**Test Cases**:

1. Create entities in Company A and Company B
2. Switch to private global mode → Verify both companies' data visible
3. Switch to company-scoped mode → Verify only current company's data visible
4. Inbox shows notifications based on current mode

#### External References Only Invariant

- [ ] **No content mirroring**: External systems referenced by ID/URL only
- [ ] **No full sync**: GitHub repos, Notion pages, TickTick tasks are linked, not copied
- [ ] **Link validation**: External links can be validated but content isn't stored
- [ ] **Graceful degradation**: System works if external system unavailable

**Test Cases**:

1. Link task to GitHub PR → Verify only PR URL/ID stored, not PR content
2. Link task to Notion page → Verify only page ID stored, not page content
3. External system unavailable → Verify DevSuite still functions
4. Remove external link → Verify no orphaned data remains

### 2) Module-Specific Validation

#### Company Module (04)

- [ ] Can create company
- [ ] Can edit company details
- [ ] Can soft-delete company
- [ ] Company switcher shows all companies
- [ ] Switching companies updates context
- [ ] Deleted companies don't appear in switcher
- [ ] Company settings page works

#### Repository Module (05)

- [ ] Can link GitHub repository (URL/identifier only)
- [ ] Can list repositories for current company
- [ ] Can edit repository details
- [ ] Can soft-delete repository
- [ ] Repository appears in project selectors
- [ ] Repository link validation works
- [ ] Cross-company repository access blocked

#### Project Module (06)

- [ ] Can create project within company
- [ ] Can associate project with repositories (many-to-many)
- [ ] Can list and filter projects
- [ ] Project detail shows summary (tasks, sessions)
- [ ] Can soft-delete project
- [ ] Project selector works in other modules
- [ ] Cross-company project access blocked

#### Task Module (07)

- [ ] Can create tasks with parent-child relationships
- [ ] Task hierarchy renders correctly (tree view)
- [ ] Can set complexity score (1-10)
- [ ] Can add/remove external links (GitHub, Notion, TickTick, URL)
- [ ] Can change task status (workflow rules enforced)
- [ ] Tasks are never hard-deleted
- [ ] Task tree operations (move, reorder) work
- [ ] Cross-company task access blocked

#### Session Module (08)

- [ ] Can start new session
- [ ] Timer shows elapsed time (realtime updates)
- [ ] Can associate session with tasks (many-to-many)
- [ ] Can end session with summary
- [ ] Can view session history
- [ ] Sessions support exploratory work (no tasks)
- [ ] Session-Task junction operations work
- [ ] Time distribution hints work (if implemented)
- [ ] Cross-company session access blocked

#### Inbox Module (11)

- [ ] Inbox shows aggregated notifications
- [ ] Can mark items as read
- [ ] Can archive items
- [ ] Filter by type/source works
- [ ] Respects current company scope
- [ ] Badge shows unread count (realtime)
- [ ] Different item types render correctly
- [ ] Privacy mode affects inbox visibility
- [ ] Bulk actions work (mark all read, archive all)

#### PR Review Module (10)

- [ ] MCP can submit PR review
- [ ] Review is persisted in Convex
- [ ] UI shows review history
- [ ] Can filter by repo and date
- [ ] Review detail shows full content
- [ ] Links to GitHub work
- [ ] Reviews are never deleted (historical record)
- [ ] Cross-company review access blocked

#### Performance Module (13)

- [ ] Signals are collected automatically
- [ ] Dashboard shows key metrics
- [ ] Can filter by date range
- [ ] Can filter by project/company
- [ ] No judgement labels ("good"/"bad")
- [ ] Charts render correctly
- [ ] Data accuracy verified

#### Invoicing Module (14)

- [ ] Can configure rate cards
- [ ] Can generate invoice for date range
- [ ] Invoice shows session breakdown
- [ ] Can export to CSV
- [ ] Totals are calculated correctly
- [ ] Invoice history works
- [ ] Rate cards are company-scoped

### 3) Integration-Specific Validation

#### GitHub Integration (12)

- [ ] Can list open PRs for repository
- [ ] GitHub notifications appear in inbox
- [ ] PR links open correct GitHub page
- [ ] Works with gh CLI authentication
- [ ] Handles rate limiting gracefully
- [ ] Repository linking works

#### Notion Integration (15)

- [ ] Can link task to Notion page
- [ ] Link shows page title
- [ ] Notion updates appear in inbox
- [ ] Works with Notion API token
- [ ] Rate limiting handled
- [ ] Invalid links handled gracefully

#### TickTick Integration (16)

- [ ] Can link DevSuite task to TickTick task
- [ ] Link shows TickTick task title
- [ ] Handles auth via TickTick Open API
- [ ] Graceful degradation if TickTick unavailable
- [ ] Token refresh works

### 4) UI/UX Validation

#### Loading States

- [ ] Loading indicators shown during data fetch
- [ ] Skeleton screens for list views
- [ ] No flash of empty content

#### Empty States

- [ ] Empty state messages are helpful
- [ ] Empty states include call-to-action (if applicable)
- [ ] Empty states are company-scoped

#### Error States

- [ ] Error messages are user-friendly
- [ ] Errors include retry actions (if applicable)
- [ ] Network errors handled gracefully
- [ ] Validation errors shown inline

#### Realtime Updates

- [ ] Convex subscriptions update UI automatically
- [ ] No manual refresh needed
- [ ] Updates appear immediately

### 5) Data Integrity Validation

#### Relationships

- [ ] Foreign key relationships enforced
- [ ] Cascading soft deletes handled correctly
- [ ] Orphaned records don't exist
- [ ] Many-to-many junctions work correctly

#### Constraints

- [ ] Required fields enforced
- [ ] Unique constraints enforced (if applicable)
- [ ] Validation rules applied
- [ ] Type safety maintained

## Deliverables Checklist

- [ ] Core invariant checklist completed for module
- [ ] Module-specific checklist completed
- [ ] Integration-specific checklist completed (if applicable)
- [ ] UI/UX validation completed
- [ ] Data integrity validation completed
- [ ] All test cases pass
- [ ] Edge cases identified and handled
- [ ] Documentation updated with findings

## Validation Report Template

```markdown
# QA Validation Report: [Module Name]

## Date

[YYYY-MM-DD]

## Validator

[Name/Identifier]

## Core Invariants

- [ ] Soft delete: PASS / FAIL (notes)
- [ ] Company scoping: PASS / FAIL (notes)
- [ ] Privacy mode: PASS / FAIL (notes)
- [ ] External references only: PASS / FAIL (notes)

## Module Functionality

[List module-specific checks with PASS/FAIL]

## Issues Found

1. [Issue description] - Severity: HIGH/MEDIUM/LOW
2. [Issue description] - Severity: HIGH/MEDIUM/LOW

## Recommendations

[List recommendations for improvements]
```

## References

- `projects/_conventions.md` - Spec standards
- `/dev_suite_conceptual_architecture_business_vs_tech.md` - Invariants
- `projects/XX-module-name/PROJECT.md` - Module requirements
- `vertical-slice-module-implementation` skill - Implementation patterns
