# DevSuite — Business / Domain Specification (Tech-Agnostic)

> This document describes **what DevSuite is and does**, independent of any technology, framework, or implementation choice.

---

## 1. Purpose

DevSuite is a **personal, local-first developer operating system**.

Its goal is to help a single developer:
- Understand *how they work*
- Measure *effort, complexity, and outcomes*
- Separate work by **company / project** with strict privacy boundaries
- Produce **time-based reports and invoices** from real work
- Act as a **source of truth** for both the human developer and AI agents

DevSuite is not a task manager replacement; it is a **work telemetry system**.

---

## 2. Core Concepts

### 2.1 Company
Represents a legal or organisational boundary.

- All work belongs to exactly one company
- Companies are used for:
  - Privacy isolation
  - Billing
  - Reporting

A user can switch between **company-scoped mode** (office-safe) and **private global mode**.

---

### 2.2 Repository
Represents a source-code repository.

- Belongs to a company
- Is an external reference (GitHub, etc.)
- Used to contextualise work (PRs, branches, reviews)

DevSuite never mirrors repository content — only identifiers and links.

---

### 2.3 Project
Represents a logical unit of work.

- Belongs to one company
- Can be associated with one or more repositories
- Contains tasks and sessions

Projects are the main organisational surface for daily work.

---

### 2.4 Task
Represents an **intent or outcome**, not time.

Key properties:
- Tasks are **hierarchical** (a task may have children)
- A task belongs to exactly one project
- A task may link to external systems (Notion page, GitHub issue/PR, TickTick task)
- A task has:
  - Status
  - Optional complexity score (1–10)
  - Optional stack/technology tags

Tasks are *never deleted* — they represent historical intent.

---

### 2.5 Session
Represents **effort over time**.

Key properties:
- A session has a start and end time
- A session belongs to one company
- A session may touch **multiple tasks**
- A session contains a human summary (what happened)

Sessions are the primary source of truth for:
- Time tracking
- Performance analysis
- Invoicing

---

### 2.6 Session–Task Relationship

A session may:
- Touch one task
- Touch many tasks
- Touch no specific task (exploratory, support, meetings)

This relationship may optionally include:
- Per-task notes
- Time distribution hints

---

### 2.7 External Links

Tasks may reference external systems by **identifier only**:
- GitHub PR / Issue
- Notion page
- TickTick task
- Arbitrary URL

DevSuite does **not** store external content — only links.

---

### 2.8 Inbox / Notifications

DevSuite provides a **unified inbox** that aggregates:
- External notifications (GitHub, Notion)
- Internal events (PR review ready, task blocked, etc.)

Inbox items can be:
- Read
- Archived

They are scoped by company and privacy mode.

---

## 2.9 PR Reviews

### Purpose

DevSuite mirrors and extends the functionality of the existing **pr-review MCP tool** by providing:
- Persistent storage of review outputs
- A dedicated UI to explore past reviews
- Long-term visibility into review workload and patterns

PR reviews are treated as **durable artifacts**, not transient CLI output.

---

### Data Model (Conceptual)

- PR reviews reference:
  - Repository
  - Pull request identifier
- Review content is stored as:
  - Structured or semi-structured data (typically Markdown)
  - Generated primarily by AI agents

The **MCP server is responsible for producing review data**, including:
- The analysis process
- Extracted signals (risk areas, red flags, etc.)
- Review formatting

DevSuite does not attempt to reinterpret or regenerate reviews.

---

### UI Responsibilities

The frontend provides:
- A PR review history view
- Filters by company, repository, date
- Direct links back to GitHub
- Correlation with sessions and workload metrics

---

### Backend Responsibilities

- Persist review reports received from MCP
- Enforce company scoping
- Prevent deletion or mutation of historical reviews

---

### 2.9 PR Reviews

DevSuite tracks **all pull request reviews performed by the user**, with a strong focus on reviews executed **with the help of AI agents**.

PR reviews are treated as **first-class work artifacts**, not ephemeral actions.

Key principles:
- A PR review represents *analysis and decision-making effort*
- Reviews are attributable to a company and repository
- Reviews may or may not be linked to a task or session

For each PR review, DevSuite stores:
- A reference to the repository and PR (identifier / URL only)
- The generated review report (usually produced by an AI agent)
- Metadata such as date, reviewer (human / agent), and outcome signals

The **exact structure and richness of review data is delegated to the MCP server**, which is considered the source of truth for:
- How PRs are analysed
- What signals are extracted
- How review reports are generated

DevSuite’s role is to:
- Persist review outputs
- Provide a UI to browse, search, and revisit past reviews
- Correlate reviews with time, load, and projects

---

### 2.10 Performance Signals


### 2.9 Performance Signals

DevSuite collects raw signals but avoids premature judgement.

Examples of signals:
- Time per task
- Time per project
- Complexity vs actual effort
- Context switching frequency
- Review load

Interpretation is left to the user (and later, AI assistance).

---

### 2.10 PR Reviews & Review History

DevSuite includes a dedicated PR review system that mirrors the workflow of the existing **pr-review MCP tool**.

Goals:
- Track **all PR reviews performed**, especially those produced with AI agents
- Persist the generated review output as part of a searchable history
- Provide a UI to browse reviews by company/project/repo and time period

DevSuite stores review artifacts (e.g., markdown reports) and only minimal external references (PR URL/ID). It does not attempt to clone or mirror GitHub content.

> Note: richer PR metadata (diff stats, review context, branch state, etc.) should be obtained from the **MCP server itself**, since it is the component running the local GitHub CLI workflow.

---

### 2.11 Invoicing

Invoicing is **derivative**, not primary.

- Based on sessions
- Grouped by time period (typically monthly)
- Uses configurable hourly rate cards
- Produces simple, auditable outputs (CSV)

DevSuite does not attempt to be an accounting system.

---

### 2.11 AI / Agent Interaction

DevSuite is designed to be operated by:
- A human via UI
- AI agents via a controlled API

Agents may:
- Create projects and tasks
- Start and stop sessions
- Attach reviews and summaries

Agents may **never delete data**.

---

### 2.12 Data Integrity Rules

Non-negotiable rules:
- No hard deletes
- All work is attributable to a company
- External systems are referenced, never mirrored
- Human override always exists

---

## 3. Mental Model Summary

- **Task = What**
- **Session = Effort**
- **Project = Context**
- **Company = Boundary**
- **Links = References, not data**

DevSuite exists to answer:
> “What did I actually do, for whom, and at what cost?”

---

# DevSuite — Technical Architecture & Stack

> This document describes **how DevSuite is implemented**, and may evolve over time.

---

## 1. Architectural Principles

- Local-first
- Realtime by default
- Client-first (no server components)
- Explicit over magic
- AI-agent compatible

---

## 2. Frontend Stack

### Core
- Vite
- React 19
- TypeScript

### Routing & Data
- TanStack Router
- TanStack Query

### UI
- Tailwind CSS v4
- shadcn/ui
- lucide-react (icons)

### Characteristics
- No server components
- No framework-imposed data fetching
- Fully client-controlled rendering

---

## 3. Backend Stack

### Core Platform
- Convex (self-hosted)

### Database
- PostgreSQL (via Convex)

### Responsibilities
- Data storage
- Realtime subscriptions
- Business rule enforcement
- Company scoping & privacy

Convex functions act as the **only write boundary**.

---

## 4. Realtime Model

- UI subscribes to Convex queries
- Updates propagate automatically
- No manual websocket management in the frontend

Realtime is used for:
- Task trees
- Timers
- Inbox updates

---

## 5. MCP Server

### Role
A separate Node.js process acting as an AI-facing control plane.

### Responsibilities
- Expose DevSuite operations as MCP tools
- Authenticate agents via static token
- Call Convex functions
- Run local tooling (e.g. GitHub CLI)

### PR review source of truth
PR review automation is executed here (via your existing PR-review workflow). The MCP server is responsible for:
- Fetching PR context using the local GitHub CLI
- Generating review reports with agents
- Returning richer PR metadata when needed

DevSuite stores the resulting artifacts (reports) and references (PR IDs/URLs). The MCP server remains the place to obtain deeper runtime details.

### Guarantees
- Agents can read and modify
- Agents cannot delete

---

## 6. Integrations

### GitHub
- Read-only
- Via GitHub CLI
- No organisation OAuth

Used for:
- PR discovery
- Review history (stored reports)
- Notifications

---

### Notion
- Minimal API usage
- Links and notifications only
- Company-specific behaviour via plugins/adapters

### TickTick
- Optional Open API integration
- Explicit linking only
- No full task mirroring

---

## 7. Data Ownership & Privacy

- All data stored locally
- External data referenced, not copied
- Company scope enforced at query level
- "Private global view" is an explicit user mode

---

## 8. Monorepo Structure (Current)

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

---

## 9. Evolution Strategy

- Start minimal
- Optimise for correctness and trust
- Add automation only after observing real usage
- Treat AI as a collaborator, not an authority

---

## 10. Final Note

DevSuite is intentionally boring in technology and strict in rules.

Its value comes from:
- Consistency over time
- Honest measurement
- Reduced cognitive load

Everything else is optional.

