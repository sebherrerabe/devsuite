# SKILL.md Template & Standards

> **Purpose**: This template defines the global standard for all DevSuite skills. Use this when creating or updating any skill under `.cursor/skills/`.

---

## File Location & Naming

- **Location**: `.cursor/skills/<skill-name>/SKILL.md`
- **Folder name must match** the `name:` field in frontmatter (kebab-case)
- **File name**: Always `SKILL.md` (uppercase)

---

## Standard SKILL.md Skeleton

Copy this structure when creating a new skill:

```markdown
---
name: <skill-name>
description: <what + when trigger terms>
---

# <Title>

## Intent

[2-4 sentences explaining what this skill is responsible for and its primary purpose]

## Non-Goals

[Explicit list of what this skill must NOT do or handle]

## Inputs to Read First

### Repo Files

- `projects/XX-project-name/PROJECT.md` (if applicable)
- `projects/_conventions.md` (if applicable)
- `/dev_suite_conceptual_architecture_business_vs_tech.md` (if applicable)
- Other relevant spec files

### External Documentation (Context7)

- "Library/technology documentation query"
- "API reference for X"
- Additional vendor docs as needed

### Optional Web Search

- Only if a good external example repo is needed
- "example repo pattern X"

## Workflow

### 1) [Step Name]

[Clear, actionable instructions]

### 2) [Step Name]

[Clear, actionable instructions]

[Continue with numbered steps...]

## Deliverables Checklist

- [ ] Deliverable 1: description
- [ ] Deliverable 2: description
- [ ] Deliverable 3: description

## References

- [Link to external docs]
- [Link to example repos]
```

---

## Required Elements

### 1. Frontmatter (YAML)

```yaml
---
name: <skill-name> # Must match folder name (kebab-case)
description: <what + when> # Must include trigger terms
---
```

**Description Requirements**:

- Must include **WHAT** the skill does
- Must include **WHEN** to use it (trigger conditions)
- Example: "Establish DevSuite's monorepo foundation. Use when bootstrapping the repo, standardizing workspace tooling, or writing/refreshing AGENTS.md instructions."

### 2. Intent Section

- **Purpose**: Clearly state what the skill is responsible for
- **Length**: 2-4 sentences
- **Focus**: Primary responsibilities and scope

### 3. Non-Goals Section

- **Purpose**: Explicitly exclude responsibilities that might be ambiguous
- **Format**: Bullet list
- **Why**: Prevents scope creep and clarifies boundaries

### 4. Inputs to Read First

- **Purpose**: Ensure agents have context before executing
- **Structure**: Grouped by source (Repo Files, External Docs, Optional Web Search)
- **Why**: Reduces errors from missing context

### 5. Workflow Section

- **Purpose**: Step-by-step execution guide
- **Format**: Numbered subsections (`### 1)`, `### 2)`, etc.)
- **Style**: Actionable, imperative instructions
- **Order**: Sequential (unless explicitly marked as parallel)

### 6. Deliverables Checklist

- **Purpose**: Verification that work is complete
- **Format**: Checkbox list (`- [ ]`)
- **Style**: Specific, testable outcomes

### 7. References (Optional)

- **Purpose**: Links to external documentation, examples, or related resources
- **When to include**: If referencing external docs or example repos

---

## Length Guidelines

- **Target**: < 250 lines
- **Hard cap**: < 500 lines
- **Strategy**: Use progressive disclosure
  - Put heavy content in optional `references/` subfolder or `examples.md` if needed
  - Keep main `SKILL.md` focused on workflow and essentials

---

## Acceptance Checklist

Before marking a skill as complete, verify:

### Structure & Format

- [ ] File is located at `.cursor/skills/<skill-name>/SKILL.md`
- [ ] Folder name matches `name:` in frontmatter exactly (kebab-case)
- [ ] File name is `SKILL.md` (uppercase)
- [ ] YAML frontmatter is valid and complete
- [ ] All required sections are present (Intent, Non-Goals, Inputs, Workflow, Deliverables)

### Content Quality

- [ ] Description includes **WHAT** + **WHEN** trigger terms
- [ ] Intent section clearly states primary responsibilities (2-4 sentences)
- [ ] Non-Goals section explicitly excludes ambiguous responsibilities
- [ ] Inputs section lists relevant repo files and external docs
- [ ] Workflow is actionable with numbered steps
- [ ] Deliverables checklist is specific and testable

### Length & Clarity

- [ ] Total line count < 500 (hard cap)
- [ ] Total line count < 250 (target)
- [ ] Heavy content moved to `references/` or `examples.md` if needed
- [ ] Language is clear and unambiguous
- [ ] No duplicated or conflicting rules

### DevSuite-Specific Requirements

- [ ] Skill aligns with DevSuite architecture (`dev_suite_conceptual_architecture_business_vs_tech.md`)
- [ ] Skill references relevant project specs in `projects/` if applicable
- [ ] Skill respects DevSuite invariants (soft delete, company scoping, external refs only)
- [ ] Skill follows conventions from `projects/_conventions.md` where relevant

### Consistency

- [ ] Style matches existing skills (`project-management`, `monorepo-scaffolding`)
- [ ] Terminology is consistent with other skills
- [ ] Cross-references to other skills are accurate
- [ ] No conflicts with other skills' responsibilities

---

## Examples

### Good Description Examples

✅ **Good**: "Establish DevSuite's monorepo foundation. Use when bootstrapping the repo, standardizing workspace tooling, or writing/refreshing AGENTS.md instructions."

- Includes WHAT (establish monorepo foundation)
- Includes WHEN (bootstrapping, standardizing, writing AGENTS.md)

✅ **Good**: "Act as project manager and technical lead. Use when the user presents a high-level idea, feature request, or project concept that needs scoping, breakdown, or team delegation."

- Includes WHAT (project manager and technical lead)
- Includes WHEN (high-level ideas needing scoping/delegation)

❌ **Bad**: "Monorepo setup"

- Missing WHEN triggers
- Too vague

❌ **Bad**: "Use this skill"

- Missing WHAT
- Missing WHEN

### Good Workflow Examples

✅ **Good**:

```markdown
### 1) Decide and document baseline versions

- **Node**: default to **Node.js 20+** unless repo already standardizes another version.
- **Package manager**: **pnpm** only.
- Record the decision in root documentation (README and/or `AGENTS.md`).
```

✅ **Good**:

```markdown
### 2) Create the canonical repo structure

Ensure this structure exists (add placeholders only when needed):
```

apps/
web/
mcp/
convex/
packages/
shared/
docs/
projects/

```

```

❌ **Bad**:

```markdown
### 1) Setup

Do the setup stuff.
```

- Too vague
- Not actionable

---

## Style Guide

### Headings

- Use `#` for main title (matches frontmatter title)
- Use `##` for major sections (Intent, Non-Goals, etc.)
- Use `###` for workflow steps (`### 1)`, `### 2)`, etc.)
- Use `####` sparingly for sub-steps if needed

### Lists

- Use `-` for unordered lists
- Use `- [ ]` for checkboxes in deliverables
- Use `- [x]` for completed items (in status docs, not templates)

### Code Blocks

- Always specify language: ` ```typescript`, ` ```markdown`, etc.
- Use triple backticks
- Indent consistently

### Emphasis

- Use **bold** for important terms and key concepts
- Use `backticks` for file names, code references, and technical terms
- Use _italics_ sparingly for emphasis

### Tables

- Use tables for structured data (personas, dependencies, etc.)
- Include header separator row
- Align columns with pipes

---

## Common Patterns

### Referencing Other Skills

```markdown
For project breakdown, use the `project-management` skill.
```

### Referencing Repo Files

```markdown
Read `projects/_conventions.md` for spec standards.
```

### Referencing External Docs

```markdown
See Context7: "Convex schema definition TypeScript"
```

### Conditional Instructions

```markdown
- **If** condition X: do Y
- **Otherwise**: do Z
```

### Verification Steps

```markdown
### 7) Verification loop (must pass before "done")

Run:

- `pnpm install`
- `pnpm lint`
  If any fail:
- fix config or scripts
- re-run until green
```

---

## Notes

- **Progressive Disclosure**: Keep main `SKILL.md` concise. Move detailed examples, reference implementations, or extended documentation to `references/` subfolder or `examples.md`.
- **Consistency First**: Match the style and structure of existing skills (`project-management`, `monorepo-scaffolding`).
- **Clarity Over Cleverness**: Prefer explicit, actionable instructions over clever abstractions.
- **DevSuite Context**: Always ground skills in DevSuite's architecture, conventions, and invariants.
