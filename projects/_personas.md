# DevSuite — Personas Reference

> Specialized roles for task delegation. Each persona has defined responsibilities and boundaries.

---

## Available Personas

### Product Manager
**Responsibility**: Requirements, priorities, success metrics, acceptance criteria

**Owns**:
- Feature scope definition
- User story writing
- Acceptance criteria
- Priority decisions

**Does NOT**:
- Write code
- Make technology choices
- Design UI

---

### UX/UI Designer
**Responsibility**: User flows, wireframes, visual design, interaction patterns

**Owns**:
- User flow diagrams
- Wireframes and mockups
- Component visual specs
- Interaction states
- Accessibility requirements

**Does NOT**:
- Write implementation code
- Define data models
- Make backend decisions

**Deliverables**:
- Figma-style component specs (as markdown)
- User flow descriptions
- State diagrams for interactions

---

### Frontend Engineer
**Responsibility**: Client-side implementation using React, TypeScript, Tailwind

**Owns**:
- React components
- Client-side state management
- UI integration with Convex
- Routing logic
- Form handling and validation

**Does NOT**:
- Define database schema
- Write backend functions
- Make infrastructure decisions

**Stack**:
- Vite + React 19 + TypeScript
- TanStack Router + Query
- Tailwind CSS v4 + shadcn/ui
- lucide-react icons

---

### Backend Engineer
**Responsibility**: Server-side logic, API design, business rules

**Owns**:
- API contract design
- Business logic implementation
- Data validation rules
- Error handling patterns

**Does NOT**:
- Write frontend code
- Design UI
- Make infrastructure decisions

---

### Convex Developer
**Responsibility**: Convex-specific data layer, functions, schema

**Owns**:
- Convex schema definitions
- Query functions
- Mutation functions
- Action functions (external calls)
- Realtime subscription patterns
- Company scoping logic

**Does NOT**:
- Write frontend components
- Design UI
- Make MCP decisions

**Stack**:
- Convex (self-hosted)
- PostgreSQL (via Convex)
- TypeScript

**Key Constraints**:
- No hard deletes (soft delete only)
- All data company-scoped
- External systems referenced, never mirrored

---

### MCP Developer
**Responsibility**: MCP server implementation, AI agent interface

**Owns**:
- MCP tool definitions
- Agent authentication
- Convex client integration
- Local tooling integration (GitHub CLI)
- PR review workflow automation

**Does NOT**:
- Write frontend code
- Define Convex schema (consumes it)
- Make UI decisions

**Stack**:
- Node.js
- MCP SDK
- Convex client
- GitHub CLI

**Key Constraints**:
- Agents can read and modify
- Agents cannot delete
- Must enforce company scoping

---

### Infra / DevOps
**Responsibility**: Deployment, CI/CD, infrastructure, tooling

**Owns**:
- Monorepo structure
- Build configuration
- CI/CD pipelines
- Development tooling
- Environment setup

**Does NOT**:
- Write application code
- Design features
- Make product decisions

**Stack**:
- pnpm workspaces
- TypeScript project references
- ESLint + Prettier
- Git hooks (husky/lint-staged)

---

### QA / Validation
**Responsibility**: Testing strategy, quality assurance, edge cases

**Owns**:
- Test plan creation
- Edge case identification
- Validation criteria
- Bug reproduction steps

**Does NOT**:
- Write production code
- Make design decisions
- Define requirements

**Deliverables**:
- Test scenarios (markdown)
- Edge case lists
- Validation checklists

---

### Documentation / DX
**Responsibility**: Docs, developer experience, onboarding

**Owns**:
- README files
- API documentation
- Developer guides
- Code comments standards
- Onboarding materials

**Does NOT**:
- Write application code
- Make architecture decisions
- Define features

---

## Persona Selection Guide

| Task Type | Primary Persona | Supporting Personas |
|-----------|-----------------|---------------------|
| Feature scoping | Product Manager | — |
| UI design | UX/UI Designer | Product Manager |
| Component implementation | Frontend Engineer | UX/UI Designer |
| Data model design | Convex Developer | Backend Engineer |
| Convex functions | Convex Developer | — |
| MCP tools | MCP Developer | Convex Developer |
| CI/CD setup | Infra / DevOps | — |
| Test planning | QA / Validation | Product Manager |
| Documentation | Documentation / DX | All |

---

## Handoff Protocol

When delegating to a persona:

1. **Provide Context**
   - Link to PROJECT.md
   - Link to relevant SCOPE.md sections
   - List explicit inputs available

2. **Define Deliverable**
   - What artifact they must produce
   - Format requirements
   - Where to place output

3. **Specify Boundaries**
   - What's in scope for them
   - What's explicitly out of scope
   - Who to hand off to next

4. **Validation Criteria**
   - How to verify the deliverable is complete
   - Who reviews their output
