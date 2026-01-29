# DevSuite Skills Index

> Agent skills for DevSuite development. Each skill provides specialized guidance for specific domains and workflows.

---

## Available Skills

### Core Workflow Skills

#### `project-management`
**When to use**: When the user presents a high-level idea, feature request, or project concept that needs scoping, breakdown, or team delegation.

**What it does**: Acts as project manager and technical lead. Runs structured Q&A to clarify ambiguities, decomposes ideas into vertical-slice sub-projects, and delegates to specialized personas.

**Key responsibilities**:
- Clarification Q&A (blocking phase)
- Confirmed understanding validation
- Project breakdown into executable sub-projects
- Execution order planning
- Persona handoff coordination

---

#### `monorepo-scaffolding`
**When to use**: When bootstrapping the repo, standardizing workspace tooling, or writing/refreshing AGENTS.md instructions.

**What it does**: Establishes DevSuite's monorepo foundation: pnpm workspaces, TypeScript project references, lint/format/husky tooling, base folder structure, scripts, and repo-wide conventions. Also creates and maintains nested AGENTS.md files.

**Key responsibilities**:
- Workspace structure setup (`apps/`, `packages/`, `convex/`, `docs/`)
- Tooling configuration (pnpm, TypeScript, ESLint, Prettier, husky)
- Conventions documentation
- AGENTS.md file creation and maintenance

---

### Convex Skills (Packet A)

#### `convex-data-modeling-and-rules`
**When to use**: When creating new Convex tables, modifying schemas, or establishing data integrity rules.

**What it does**: Defines Convex schemas, data modeling patterns, and enforces DevSuite invariants (company scoping, soft delete, external refs only).

**Key responsibilities**:
- Schema structure definition
- DevSuite invariant enforcement (company scoping, soft delete, external refs)
- Alignment with shared types
- Index creation for common query patterns
- Schema documentation

---

#### `convex-functions-crud-patterns`
**When to use**: When implementing Convex query/mutation/action functions, creating CRUD operations, or handling entity relationships.

**What it does**: Provides patterns and templates for implementing Convex functions following DevSuite conventions: helper utilities, query/mutation patterns, relationship handling, type safety, and error handling.

**Key responsibilities**:
- Helper utilities for common patterns
- Query function implementation
- Mutation function implementation
- Relationship and cascading handling
- Type safety with shared types
- Error handling patterns

---

#### `authz-and-company-scope`
**When to use**: When adding auth checks, implementing company context switching, or enforcing privacy boundaries.

**What it does**: Implements authorization patterns and company scoping enforcement for Convex functions. Handles authentication context, HTTP actions for token validation, company scoping in queries/mutations, and privacy mode rules.

**Key responsibilities**:
- Authentication context structure
- HTTP action for token validation
- Company scoping enforcement in queries
- Company scoping enforcement in mutations
- Company context switching support
- Privacy mode rules

---

### Frontend Skills (Packet B)

#### `frontend-app-shell-and-routing`
**When to use**: When implementing routing, layouts, navigation components, or company switcher integration.

**What it does**: Sets up TanStack Router with file-based routing, application shell (layout, navigation, sidebar), company context propagation, and type-safe navigation patterns.

**Key responsibilities**:
- TanStack Router configuration with file-based routing
- Application shell components (root layout, sidebar, header)
- Company context propagation through routes
- Type-safe navigation patterns
- Privacy mode integration with routing
- Loading and error state handling

---

#### `frontend-ui-patterns-shadcn-tailwind`
**When to use**: When building UI components, forms, or styling features.

**What it does**: Implements UI components using shadcn/ui and Tailwind CSS v4, following DevSuite conventions for loading/empty/error states, accessibility, forms, and component composition.

**Key responsibilities**:
- Tailwind CSS v4 configuration with Vite
- shadcn/ui installation and configuration
- Loading/empty/error state patterns
- Form patterns with React Hook Form + Zod
- Accessibility standards
- Component composition patterns

---

#### `frontend-convex-integration`
**When to use**: When integrating Convex data fetching in React components, implementing real-time subscriptions, or handling Convex mutations from the frontend.

**What it does**: Guides integration of Convex React client in DevSuite frontend. Sets up type-safe Convex function references, implements query/mutation patterns with hooks, integrates company scoping, and handles loading/error states.

**Key responsibilities**:
- Convex React client setup
- Type-safe Convex function references
- Query patterns with `useQuery`
- Mutation patterns with `useMutation`
- Company scoping integration
- Loading and error state handling

---

### MCP + GitHub Skills (Packet C)

#### `mcp-server-tooling`
**When to use**: When building MCP tools, setting up the server, or integrating DevSuite operations for AI agents.

**What it does**: Sets up and maintains the MCP server infrastructure in `apps/mcp/`. Implements tools, handles authentication via static token, integrates with Convex, and enforces DevSuite guardrails (no-delete, company scoping).

**Key responsibilities**:
- Server setup and structure
- Static token authentication
- Convex client integration
- Tool infrastructure with Zod schemas
- Guardrails enforcement (no-delete, company scoping)
- Error handling and logging

---

#### `mcp-tool-ux-and-docs`
**When to use**: When creating new MCP tools, improving tool usability, or documenting tool contracts for AI agents.

**What it does**: Designs MCP tools for optimal agent UX: predictable inputs/outputs, clear documentation, discoverable parameters, structured errors, and helpful descriptions.

**Key responsibilities**:
- Tool naming conventions
- Parameter design and documentation
- Input/output schema standards
- Error documentation
- Discoverability patterns
- Agent-friendly design patterns

---

#### `github-cli-integration`
**When to use**: When building GitHub-related MCP tools, handling gh CLI operations, or implementing rate limit strategies.

**What it does**: Implements GitHub integration via GitHub CLI (`gh`) in the MCP server. Handles PR discovery, metadata fetching, notification sync, rate limiting, and authentication.

**Key responsibilities**:
- GitHub CLI wrapper implementation
- Rate limiting strategy
- PR discovery and metadata fetching
- Error handling for GitHub operations
- MCP tool integration

---

#### `pr-review-artifact-persistence`
**When to use**: When building PR review history, storing review artifacts, or integrating review data from MCP tools.

**What it does**: Implements PR review storage and persistence in DevSuite. Handles MCP tool for submitting reviews, Convex functions for storage, company scoping, and UI integration.

**Key responsibilities**:
- PR review data model design
- Convex functions for storage and retrieval
- MCP tool for submitting reviews
- Company scoping enforcement
- No-delete enforcement
- Session/task correlation

---

### Product Surface Skills (Packet D)

#### `vertical-slice-module-implementation`
**When to use**: When implementing any module from projects/04-16 (Company, Repository, Project, Task, Session, Inbox, PR Review, Performance, Invoicing) following DevSuite conventions.

**What it does**: Guides implementation of DevSuite modules as complete vertical slices—from backend Convex functions through frontend React UI—ensuring consistency with architectural patterns, company scoping, soft-delete rules, and external reference-only policies.

**Key responsibilities**:
- Data model design (Convex schema)
- Convex function implementation (queries, mutations)
- Frontend route creation (TanStack Router)
- React component implementation
- Company scoping enforcement
- Soft delete implementation
- External link handling

---

#### `inbox-aggregation-and-item-types`
**When to use**: When implementing inbox functionality, notification aggregation, or multi-source notification systems.

**What it does**: Guides implementation of DevSuite's unified inbox that aggregates notifications from external systems (GitHub, Notion) and internal events into a single, company-scoped interface with read/archive capabilities and privacy mode support.

**Key responsibilities**:
- Polymorphic inbox item data model
- Multiple item type handling
- Company scoping and privacy mode
- Read/archive actions
- Integration points from external systems
- Notification badge

---

#### `notion-integration-minimal`
**When to use**: When implementing Notion integration, linking tasks to Notion pages, or syncing Notion notifications to inbox.

**What it does**: Guides implementation of minimal Notion integration for explicit task-to-Notion-page linking and notification forwarding. Read-only, company-scoped, does not mirror Notion content—only references it.

**Key responsibilities**:
- Notion API client setup
- Link validation (verify page exists, fetch title)
- Notification polling
- Rate limiting handling
- Task link UI
- Company-specific configuration

---

#### `ticktick-integration-minimal`
**When to use**: When implementing TickTick integration, linking tasks to TickTick, or displaying TickTick task metadata.

**What it does**: Guides implementation of optional TickTick integration for explicit task linking. Read-only, uses OAuth2 authentication, does not mirror TickTick content—only references it.

**Key responsibilities**:
- OAuth2 flow implementation
- Token management and refresh
- Link validation (verify task exists, fetch metadata)
- Task link UI
- Graceful degradation

---

#### `qa-validation-checklists`
**When to use**: When validating module implementations, performing QA checks, or ensuring compliance with DevSuite architectural rules.

**What it does**: Provides structured validation checklists for QA/testing DevSuite modules, ensuring compliance with core invariants (soft delete, company scoping, privacy mode) and verifying module-specific functionality.

**Key responsibilities**:
- Core invariant validation (soft delete, company scoping, privacy mode, external references)
- Module-specific validation checklists
- Integration-specific validation
- UI/UX validation
- Data integrity validation
- Validation report templates

---

#### `docs-and-dx`
**When to use**: When creating or updating documentation, establishing package boundaries, or improving developer onboarding and contribution processes.

**What it does**: Standardizes READMEs, package boundaries, contribution workflow, and developer experience documentation across DevSuite.

**Key responsibilities**:
- Root and package README structure
- Package boundaries documentation
- Contribution workflow
- Architecture documentation
- Developer onboarding guide
- Code comment standards
- Environment variables documentation
- Troubleshooting guide

---

## Skill Structure Standards

All skills follow a consistent structure:

1. **Frontmatter** (YAML)
   - `name:` - Must match folder name (kebab-case)
   - `description:` - Must include WHAT + WHEN trigger terms

2. **Content Sections**
   - `## Intent` - What the skill is responsible for
   - `## Non-Goals` - What it must not do
   - `## Inputs to Read First` - Repo files and docs to review
   - `## Workflow` - Ordered checklist of steps
   - `## Deliverables Checklist` - How to verify completion
   - `## References` - Links to relevant documentation

3. **Quality Standards**
   - Target length: < 250 lines (hard cap: < 500 lines)
   - Clear, actionable instructions
   - Progressive disclosure (heavy content in optional `references/` if needed)

---

## Consistency Status

✅ **All 18 skills verified**:
- ✅ Folder names match `name:` fields
- ✅ Descriptions include "Use when" triggers
- ✅ Required sections present (Intent, Non-Goals, Inputs, Workflow, Deliverables)
- ✅ Line counts within acceptable range (< 500 cap)
- ⚠️ 6 skills exceed 250 line target but remain under cap (acceptable for complex domains)

---

## Usage

Skills are automatically discovered by Cursor when placed in `.cursor/skills/<skill-name>/SKILL.md`. The folder name must match the `name:` field in the frontmatter.

To use a skill, reference it in conversation or let Cursor automatically suggest it based on context and the skill's description triggers.

---

## Contributing

When creating new skills:
1. Follow the structure standards above
2. Ensure folder name matches `name:` in frontmatter
3. Include WHAT + WHEN trigger terms in description
4. Keep content concise (< 250 lines target, < 500 lines cap)
5. Reference this README and existing skills for consistency
