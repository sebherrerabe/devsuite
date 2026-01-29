# DevSuite — Project Spec Conventions

> Standards for all project specifications. Follow these conventions to ensure consistency and LLM parseability.

---

## File Structure Per Project

Each project folder contains:

```
XX-project-name/
  PROJECT.md      # Overview, metadata, summary (entry point)
  SCOPE.md        # Detailed scope: what's in, what's out
  DEPENDENCIES.md # Inputs required, outputs produced
  TASKS.md        # Sub-tasks for persona delegation
  STATUS.md       # Current state, blockers, decision log
```

---

## PROJECT.md Format

```markdown
---
id: "XX-project-name"
title: "Human Readable Title"
status: "pending|planning|in-progress|blocked|review|complete"
priority: 1-16
assigned_pm: "AI PM identifier or null"
depends_on: ["XX-dep1", "XX-dep2"]
unlocks: ["XX-next1", "XX-next2"]
estimated_complexity: "low|medium|high"
---

# {Title}

## Summary
2-3 sentences describing what this project delivers.

## Objective
One sentence goal statement.

## Key Deliverables
- Deliverable 1
- Deliverable 2
- Deliverable 3

## Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Quick Links
- [Scope](./SCOPE.md)
- [Dependencies](./DEPENDENCIES.md)
- [Tasks](./TASKS.md)
- [Status](./STATUS.md)
```

---

## SCOPE.md Format

```markdown
# Scope: {Project Title}

## In Scope
Explicit list of what this project covers.

### Entities
- Entity 1: description
- Entity 2: description

### Functionality
- Feature 1: description
- Feature 2: description

### UI Components (if applicable)
- Component 1: description
- Component 2: description

## Out of Scope
Explicit list of what this project does NOT cover.

- Exclusion 1 (covered by: XX-other-project)
- Exclusion 2 (deferred)
- Exclusion 3 (not planned)

## Boundaries
Clarifications on edge cases and grey areas.

### Boundary 1
Description of where this project's responsibility ends.

### Boundary 2
Description of handoff point to another project.

## Assumptions
- Assumption 1
- Assumption 2

## Open Questions
- [ ] Question 1 (owner: @persona)
- [ ] Question 2 (owner: @persona)
```

---

## DEPENDENCIES.md Format

```markdown
# Dependencies: {Project Title}

## Required Inputs

### From 00-scaffolding
- [ ] Monorepo structure exists
- [ ] Package manager configured

### From XX-other-project
- [ ] Specific artifact or capability

## Produced Outputs

### For XX-downstream-project
- [ ] Output 1: description
- [ ] Output 2: description

### For XX-another-project
- [ ] Output 3: description

## External Dependencies
- Dependency 1: version/details
- Dependency 2: version/details

## Blocking Issues
List any unresolved blockers preventing progress.
```

---

## TASKS.md Format

```markdown
# Tasks: {Project Title}

## Task Breakdown

### TASK-XX-001: Task Title
| Field | Value |
|-------|-------|
| Assigned Persona | {Persona name} |
| Status | pending/in-progress/complete |
| Depends On | TASK-XX-000 or "none" |
| Deliverable | What this task produces |

**Description**:
What needs to be done.

**Acceptance Criteria**:
- [ ] Criterion 1
- [ ] Criterion 2

**Notes**:
Additional context for the persona.

---

### TASK-XX-002: Next Task
...

## Task Dependency Graph
```
TASK-XX-001
├── TASK-XX-002
│   └── TASK-XX-004
└── TASK-XX-003
    └── TASK-XX-004
```

## Delegation Order
1. TASK-XX-001 (can start immediately)
2. TASK-XX-002, TASK-XX-003 (parallel, after 001)
3. TASK-XX-004 (after 002 and 003)
```

---

## STATUS.md Format

```markdown
# Status: {Project Title}

## Current State
**Status**: pending|planning|in-progress|blocked|review|complete
**Last Updated**: YYYY-MM-DD
**Updated By**: AI PM identifier

## Progress

### Completed
- [x] Item 1 (YYYY-MM-DD)
- [x] Item 2 (YYYY-MM-DD)

### In Progress
- [ ] Item 3 (started: YYYY-MM-DD)

### Pending
- [ ] Item 4
- [ ] Item 5

## Blockers
| Blocker | Waiting On | Since |
|---------|------------|-------|
| Description | XX-project or decision | YYYY-MM-DD |

## Decision Log
| Date | Decision | Rationale | Made By |
|------|----------|-----------|---------|
| YYYY-MM-DD | Decision 1 | Why | Who |

## Notes
Any additional context or observations.
```

---

## Naming Conventions

### Project IDs
- Format: `XX-kebab-case-name`
- XX = two-digit number (00-99)
- Use descriptive names: `04-company-module` not `04-comp`

### Task IDs
- Format: `TASK-XX-NNN`
- XX = project number
- NNN = three-digit sequence (001, 002, ...)

### File Names
- Always UPPERCASE for project docs: `PROJECT.md`, `SCOPE.md`
- Always lowercase for code files

---

## Markdown Standards

### Frontmatter
- Use YAML frontmatter for metadata
- Keep values in quotes for strings
- Use arrays for lists: `["a", "b"]`

### Tables
- Use for structured data
- Align columns with pipes
- Include header separator

### Checkboxes
- Use `- [ ]` for incomplete
- Use `- [x]` for complete
- Never use other checkbox formats

### Code Blocks
- Always specify language
- Use triple backticks
- Indent consistently

---

## LLM Optimization Tips

1. **Be Explicit**: State things directly, avoid ambiguity
2. **Use Structure**: Tables and lists over prose
3. **Frontmatter First**: Put metadata at the top
4. **Cross-Reference**: Link to other docs explicitly
5. **Atomic Sections**: Each section should be self-contained
6. **Consistent Terminology**: Use the same terms everywhere
7. **No Assumptions**: State prerequisites explicitly
