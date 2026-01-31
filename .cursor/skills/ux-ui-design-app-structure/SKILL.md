---
name: ux-ui-design-app-structure
description: Produces UX/UI deliverables that convert user needs and app modules into a coherent information architecture, navigation model, wireframe-level page specs, and a distinctive visual direction. Use when defining app structure, layouts, link placement, user flows, IA/sitemaps, wireframes, UI kits/tokens, or when the user asks for UX/UI design standards.
---

# UX/UI Design — App Structure + Standards

## Intent

Help the user **organize modules and user needs into a handcrafted app structure** (pages, layout regions, navigation, and link placement) and then shape a **unique, aesthetic UI direction** while meeting baseline UX/UI standards (accessibility, hierarchy, consistency, responsiveness).

Default bias: **desktop-first**, responsive down to mobile; **sleek + modern** visual direction.

## Non-goals (hard boundaries)

- Do **not** implement code.
- Do **not** invent backend/data-model decisions.
- Do **not** violate repo invariants (see `AGENTS.md`): no hard deletes; company scoping; external refs only; no secrets.

## Inputs to read first (order)

1. `AGENTS.md` (repo invariants)
2. `projects/_conventions.md` (spec format standards)
3. The relevant module specs: `projects/XX-*/PROJECT.md` (+ `SCOPE.md`/`TASKS.md` if present)
4. Frontend UI conventions: `.cursor/skills/frontend-ui-patterns-shadcn-tailwind/SKILL.md`
5. Frontend shell/routing conventions (if navigation/layout changes are in scope): `.cursor/skills/frontend-app-shell-and-routing/SKILL.md`

## Workflow

### 1) Convert “modules + needs” into a design brief

Capture constraints and decision drivers first; keep it short.

**Design brief template**

```markdown
## Design brief

### Users & goals

- Primary user: …
- Top 3 jobs to be done:
  1. …
  2. …
  3. …

### Modules in scope

- Module: purpose, key objects, key actions
- …

### Constraints

- Platform: desktop-first (responsive)
- Accessibility: WCAG AA target
- Navigation: sidebar + header (unless specified otherwise)
- Tenancy: company-scoped everywhere
- Privacy mode: respect privacy filtering where applicable

### Success criteria

- [ ] Users can complete top jobs in ≤ N clicks from the main shell
- [ ] Navigation names match domain language
- [ ] Empty/error/loading states designed for all key screens
```

### 2) Define the information architecture (IA)

**Goal**: map modules → areas → pages, with clear hierarchy.

Rules of thumb:

- Prefer **5–9 primary navigation items** max.
- Use **areas** (top-level) and **page types** (list/detail/settings) for consistency.
- Name pages by user intent (“Reviews”, “Inbox”), not implementation.

**IA deliverable**

```markdown
## Information architecture

### Areas (top-level)

| Area | Why it exists | Typical tasks | Primary objects |
| ---- | ------------- | ------------- | --------------- |
| …    | …             | …             | …               |

### Sitemap

| Path / Screen | Area | Purpose | Entry points | Primary actions |
| ------------- | ---- | ------- | ------------ | --------------- |
| …             | …    | …       | …            | …               |
```

### 3) Choose navigation model + link placement rules

Pick a default structure and justify it:

- **Global** navigation (sidebar): area switching.
- **Header**: global controls (company switcher, profile, search, privacy mode, notifications).
- **Within-area** navigation: tabs/secondary nav for page sub-sections.
- **Breadcrumbs**: only when deep hierarchies are unavoidable.

**Link placement rules (defaults)**

- Primary action: top-right of main content (or sticky footer for long forms).
- Secondary actions: overflow menu or inline near the object (contextual).
- Destructive actions: gated (dialog + clear copy), never primary.
- Cross-module links: appear as “Related” sections on detail pages (not sprinkled randomly).

Deliverable:

```markdown
## Navigation model

- Sidebar items (ordered): …
- Header controls (left→right): …
- Secondary nav pattern: tabs | sub-nav list | none (choose one)

## Link placement rules

- Primary CTA placement: …
- Object-level actions: …
- Cross-module linking: …
```

### 4) Specify core user flows (happy path + edges)

For each top job:

- 1 happy path (numbered steps)
- 2–4 edge cases (permissions, empty data, errors, privacy mode)

```markdown
## User flows

### Flow: [name]

**Goal**: …
**Entry points**: …

1. …
2. …
3. …

**Edge cases**

- Empty state: …
- Error state: …
- Permissions/role limits: …
- Privacy mode on: …
```

### 5) Produce wireframe-level page specs (layout + components)

Don’t draw; **describe layout regions and component composition** so it can be implemented consistently.

Page spec template:

```markdown
## Page spec: [Screen name]

### Purpose

…

### Layout

- Shell region: sidebar + header
- Main: [title bar] + [content grid] + [right rail?]

### Sections (top → bottom)

1. Title bar
   - Title: …
   - Primary action: …
   - Secondary actions: …
2. Filters/search row
   - …
3. Main content
   - Default: [table/list/cards], columns/fields: …
   - Row actions: …
4. Empty state
   - Message: …
   - Action: …
5. Error state
   - Message: …
   - Recovery: retry / contact / fallback

### Notes

- Keyboard/focus: …
- Loading behavior: skeleton vs spinner
```

### 6) Define a unique visual direction (token-first)

Create uniqueness via **typography + spacing rhythm + restrained accent palette + small signature details** (not novelty layouts).

**UI direction deliverables**

```markdown
## UI direction (sleek + modern)

### Typography

- Display: …
- Body: …
- Scale: …

### Color

- Background: …
- Surface: …
- Text: …
- Accent: …
- Semantic: success/warn/error tokens

### Shape + elevation

- Radius: …
- Borders: …
- Shadow/elevation rules: …

### Motion

- Default durations: …
- Easing: …
- Where motion is allowed (and where it is not): …

### Signature “unique” detail (pick 1–2)

- e.g., subtle gradient on headers, distinctive table row hover, elegant empty states, refined icon style
```

### 7) Enforce UX/UI standards (baseline checklist)

- **Accessibility**:
  - WCAG AA contrast target
  - keyboard navigation for all interactive elements
  - visible focus states (not removed)
  - semantic landmarks (`header`, `nav`, `main`)
  - dialogs: focus trap + escape to close
- **Consistency**:
  - same layout regions across areas
  - stable placement for primary actions
  - predictable naming (domain language)
- **Feedback**:
  - loading/empty/error states for every key screen
  - optimistic UI only when safe and reversible
- **Responsiveness**:
  - content-first breakpoints (avoid hiding core actions)
  - touch targets \(≥ 44×44\) on mobile
- **Content design**:
  - labels match user intent
  - microcopy clarifies consequences (esp. destructive actions)

### 8) Handoff package (what to return)

Return a compact bundle that an engineer can implement without guesswork:

```markdown
## Deliverables

- [ ] Design brief
- [ ] IA (areas + sitemap)
- [ ] Navigation model + link placement rules
- [ ] User flows (happy + edge cases)
- [ ] Page specs (wireframe-level) for: …
- [ ] UI direction (tokens + component guidance)

## Open questions

- [ ] …
```

## Notes for DevSuite-style apps

- Treat “company switching” as a **global shell concern** (header), not a per-page concern.
- Privacy mode (if present) must affect **visibility and previews**; design explicit “hidden by privacy mode” states.
- Prefer shadcn/ui + Tailwind patterns for component feasibility; define custom visuals in tokens/variants, not bespoke one-off components.
