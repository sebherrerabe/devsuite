# DevSuite

DevSuite is a **local-first developer operating system**.

It helps a single developer understand **what they work on**, **how long it takes**, **how complex it is**, and **for whom it was done**, while remaining private, auditable, and AI-friendly.

DevSuite is not a generic task manager.  
It is a **work telemetry and review system** designed to be used by both a human developer and AI agents.

---

## Why DevSuite exists

As a developer working across:
- multiple companies
- multiple projects and repositories
- salaried and freelance contexts
- human + AI-assisted workflows

…it becomes hard to answer simple but important questions:

- What did I actually work on this week?
- How much effort did this task really take?
- How complex was it compared to my estimate?
- How much time did I spend reviewing PRs?
- What should I invoice this month?
- Where is my attention really going?

DevSuite exists to answer those questions **honestly**, using real data generated during work.

---

## Core ideas

### Tasks are intent, not time
Tasks represent *what* you intend to achieve.
They are hierarchical and scoped to a project.

### Sessions are effort
Sessions represent *time spent*.
A single session may touch multiple tasks.

### Companies are hard boundaries
Work is strictly scoped by company.
You can switch between:
- **company mode**
- **private global view**

### External tools are referenced, not mirrored
DevSuite links to:
- GitHub (PRs, issues)
- Notion pages
- TickTick tasks

Only IDs and URLs are stored.  
No external content is duplicated.

### AI agents are first-class users
DevSuite exposes a controlled MCP server so agents can:
- create tasks
- start/stop sessions
- generate and store PR reviews
- append summaries

Agents can **never delete data**.

---

## PR reviews (first-class feature)

DevSuite includes a dedicated PR review history system.

It mirrors the workflow of an existing `pr-review` MCP tool and provides:
- persistent storage of review reports (markdown)
- a UI to browse reviews by company, project, repo, or date
- visibility into how much review work you actually do

Richer PR context (diffs, metadata, branch state) is obtained from the **MCP server**, which runs the local GitHub CLI workflow.

DevSuite stores the results — not the raw GitHub data.

---

## Invoicing

Invoicing is **derivative**, not primary.

- Based on sessions
- Hourly rate cards per company
- Monthly aggregation
- Exported as simple CSV
- Designed to be auditable and easy to send

DevSuite is not an accounting system.

---

## Architecture overview

### Frontend
- Vite
- React 19
- TanStack Router
- TanStack Query
- Tailwind CSS v4
- shadcn/ui
- lucide-react (icons)

Client-first, no server components.

### Backend
- Convex (self-hosted)
- PostgreSQL

Responsible for:
- data storage
- realtime subscriptions
- business rule enforcement
- company privacy scoping

### MCP Server
- Separate Node.js process
- Authenticated via local token
- Talks to Convex
- Runs local tooling (GitHub CLI)
- Exposes DevSuite operations to AI agents

---

## Monorepo structure

