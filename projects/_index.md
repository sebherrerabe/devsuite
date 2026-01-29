# DevSuite — Project Manifest

> Master index of all sub-projects. This file is the entry point for AI PMs and agents.

---

## Quick Reference

| ID | Project | Status | Depends On | Unlocks | Priority |
|----|---------|--------|------------|---------|----------|
| 00 | [Scaffolding](./00-scaffolding/PROJECT.md) | `pending` | — | 01, 02, 03 | 1 |
| 01 | [Shared Types & Schemas](./01-shared-types/PROJECT.md) | `pending` | 00 | 02, 03, 04+ | 2 |
| 02 | [Convex Foundation](./02-convex-foundation/PROJECT.md) | `pending` | 00, 01 | 04, 05, 06, 07, 08, 09 | 3 |
| 03 | [Frontend Foundation](./03-frontend-foundation/PROJECT.md) | `pending` | 00, 01 | 04, 05, 06, 07, 08 | 3 |
| 04 | [Company Module](./04-company-module/PROJECT.md) | `pending` | 02, 03 | 05, 06, 08, 11, 14 | 4 |
| 05 | [Repository Module](./05-repository-module/PROJECT.md) | `pending` | 04 | 06, 10, 12 | 5 |
| 06 | [Project Module](./06-project-module/PROJECT.md) | `pending` | 05 | 07 | 6 |
| 07 | [Task Module](./07-task-module/PROJECT.md) | `pending` | 06 | 08, 13, 16 | 7 |
| 08 | [Session Module](./08-session-module/PROJECT.md) | `pending` | 04, 07 | 13, 14 | 8 |
| 09 | [MCP Server Foundation](./09-mcp-server/PROJECT.md) | `pending` | 02 | 10, 12 | 5 |
| 10 | [PR Review Module](./10-pr-review-module/PROJECT.md) | `pending` | 05, 09 | 13 | 9 |
| 11 | [Inbox & Notifications](./11-inbox-module/PROJECT.md) | `pending` | 04 | 15 | 10 |
| 12 | [GitHub Integration](./12-github-integration/PROJECT.md) | `pending` | 05, 09 | 10, 11 | 9 |
| 13 | [Performance Signals](./13-performance-module/PROJECT.md) | `pending` | 08, 10 | — | 11 |
| 14 | [Invoicing Module](./14-invoicing-module/PROJECT.md) | `pending` | 04, 08 | — | 12 |
| 15 | [Notion Integration](./15-notion-integration/PROJECT.md) | `pending` | 11 | — | 13 |
| 16 | [TickTick Integration](./16-ticktick-integration/PROJECT.md) | `pending` | 07 | — | 13 |

---

## Dependency Graph

```
00-scaffolding
├── 01-shared-types
│   ├── 02-convex-foundation
│   │   ├── 04-company-module
│   │   │   ├── 05-repository-module
│   │   │   │   ├── 06-project-module
│   │   │   │   │   └── 07-task-module
│   │   │   │   │       ├── 08-session-module
│   │   │   │   │       │   ├── 13-performance-module
│   │   │   │   │       │   └── 14-invoicing-module
│   │   │   │   │       └── 16-ticktick-integration
│   │   │   │   └── 10-pr-review-module
│   │   │   └── 11-inbox-module
│   │   │       └── 15-notion-integration
│   │   └── 09-mcp-server
│   │       ├── 10-pr-review-module
│   │       └── 12-github-integration
│   └── 03-frontend-foundation
│       └── (all UI work in 04-16)
```

---

## Execution Streams

### Stream A: Critical Path (Sequential)
```
00 → 01 → 02 → 04 → 05 → 06 → 07 → 08 → 13 → 14
```

### Stream B: Frontend (Parallel after 01)
```
01 → 03 (can proceed while 02 is in progress)
```

### Stream C: MCP Server (Parallel after 02)
```
02 → 09 → 12 → 10
```

### Stream D: Secondary Features (After dependencies met)
```
04 → 11 → 15
07 → 16
```

---

## Status Legend

| Status | Meaning |
|--------|---------|
| `pending` | Not started |
| `planning` | AI PM is decomposing tasks |
| `in-progress` | Implementation underway |
| `blocked` | Waiting on dependency or decision |
| `review` | Ready for human review |
| `complete` | Done and validated |

---

## How to Use This Manifest

### For AI PMs
1. Read `_conventions.md` for spec standards
2. Read `_personas.md` for delegation targets
3. Pick a project in `pending` status where all dependencies are `complete`
4. Read the project's `PROJECT.md` and decompose into `TASKS.md`
5. Update project status to `planning`

### For Human Review
1. Check projects in `review` status
2. Validate against original architecture in `/dev_suite_conceptual_architecture_business_vs_tech.md`
3. Approve or request changes in `STATUS.md`

---

## Source of Truth

- **Business/Domain Spec**: `/dev_suite_conceptual_architecture_business_vs_tech.md`
- **This Manifest**: `/projects/_index.md`
- **Conventions**: `/projects/_conventions.md`
- **Personas**: `/projects/_personas.md`
