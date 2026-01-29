# Tasks: Frontend Foundation

## Task Breakdown

### TASK-03-001: Initialize Vite + React Project

| Field            | Value                              |
| ---------------- | ---------------------------------- |
| Assigned Persona | Frontend Engineer                  |
| Status           | pending                            |
| Depends On       | 00-scaffolding complete            |
| Deliverable      | Working Vite dev server with React |

**Description**:
Set up Vite with React 19 and TypeScript in the `apps/web/` folder.

**Acceptance Criteria**:

- [ ] Vite configured for React
- [ ] TypeScript strict mode
- [ ] Path aliases work (`@/`)
- [ ] Environment variables configured
- [ ] `pnpm dev` starts dev server
- [ ] `pnpm build` produces production build

**Notes**:
Use Vite's React plugin. Configure for SPA mode.

---

### TASK-03-002: Set Up TanStack Router

| Field            | Value                    |
| ---------------- | ------------------------ |
| Assigned Persona | Frontend Engineer        |
| Status           | pending                  |
| Depends On       | TASK-03-001              |
| Deliverable      | Type-safe routing system |

**Description**:
Configure TanStack Router with file-based routing and type safety.

**Acceptance Criteria**:

- [ ] Router provider configured
- [ ] File-based route generation
- [ ] Type-safe `Link` component works
- [ ] Layout routes work
- [ ] 404 handling
- [ ] Route params are type-safe

**Notes**:
Follow TanStack Router docs for Vite setup. Enable route generation.

---

### TASK-03-003: Configure Tailwind CSS v4

| Field            | Value                   |
| ---------------- | ----------------------- |
| Assigned Persona | Frontend Engineer       |
| Status           | pending                 |
| Depends On       | TASK-03-001             |
| Deliverable      | Tailwind styling system |

**Description**:
Set up Tailwind CSS v4 with custom theme configuration.

**Acceptance Criteria**:

- [ ] Tailwind processes CSS
- [ ] Custom color palette defined
- [ ] Dark mode configured (class strategy)
- [ ] CSS custom properties for theming
- [ ] Responsive breakpoints work

**Notes**:
Tailwind v4 has new configuration approach. Follow latest docs.

---

### TASK-03-004: Install and Configure shadcn/ui

| Field            | Value                       |
| ---------------- | --------------------------- |
| Assigned Persona | Frontend Engineer           |
| Status           | pending                     |
| Depends On       | TASK-03-003                 |
| Deliverable      | shadcn/ui component library |

**Description**:
Initialize shadcn/ui and install core components needed for the application shell.

**Acceptance Criteria**:

- [ ] shadcn/ui initialized with theme
- [ ] Components installed: button, input, select, card, dialog, dropdown-menu, table, toast
- [ ] Components render correctly
- [ ] Theme customization works
- [ ] lucide-react icons work

**Notes**:
Use the CLI to add components. Customize theme to match DevSuite branding.

---

### TASK-03-005: Set Up Convex React Integration

| Field            | Value                                     |
| ---------------- | ----------------------------------------- |
| Assigned Persona | Frontend Engineer                         |
| Status           | pending                                   |
| Depends On       | TASK-03-001, 02-convex-foundation partial |
| Deliverable      | Convex provider and hooks                 |

**Description**:
Configure Convex React client and provider for realtime data access.

**Acceptance Criteria**:

- [ ] ConvexProvider wraps app
- [ ] Convex URL from environment
- [ ] `useQuery` hook works
- [ ] `useMutation` hook works
- [ ] Realtime updates work
- [ ] Type safety with Convex types

**Notes**:
May need to coordinate with 02-convex-foundation for types.

---

### TASK-03-006: Create Company Context

| Field            | Value                         |
| ---------------- | ----------------------------- |
| Assigned Persona | Frontend Engineer             |
| Status           | pending                       |
| Depends On       | TASK-03-005                   |
| Deliverable      | Company selection and context |

**Description**:
Create React context for current company selection with persistence.

**Acceptance Criteria**:

- [ ] `CompanyProvider` context
- [ ] `useCurrentCompany()` hook
- [ ] `useCompanies()` hook (list)
- [ ] Selection persists to localStorage
- [ ] Null state handling (no company selected)

**Notes**:
Company context is used by all company-scoped features.

---

### TASK-03-007: Create Privacy Mode Context

| Field            | Value                           |
| ---------------- | ------------------------------- |
| Assigned Persona | Frontend Engineer               |
| Status           | pending                         |
| Depends On       | TASK-03-001                     |
| Deliverable      | Privacy mode toggle and context |

**Description**:
Create React context for privacy mode (company view vs global view).

**Acceptance Criteria**:

- [ ] `PrivacyModeProvider` context
- [ ] `usePrivacyMode()` hook
- [ ] Toggle between 'company' and 'global' modes
- [ ] Persists to localStorage
- [ ] TypeScript enum for modes

**Notes**:
Privacy mode affects what data is shown. "Company" mode is office-safe.

---

### TASK-03-008: Design Application Shell

| Field            | Value                    |
| ---------------- | ------------------------ |
| Assigned Persona | UX/UI Designer           |
| Status           | pending                  |
| Depends On       | TASK-03-004              |
| Deliverable      | Shell layout design spec |

**Description**:
Design the application shell: sidebar, header, main content area layout.

**Acceptance Criteria**:

- [ ] Sidebar navigation design
- [ ] Header layout with company switcher
- [ ] Privacy mode indicator placement
- [ ] Main content area layout
- [ ] Responsive behavior (collapsible sidebar)
- [ ] Color scheme and spacing

**Notes**:
Keep it clean and functional. DevSuite is a productivity tool, not a marketing site.

---

### TASK-03-009: Implement Application Shell

| Field            | Value                                 |
| ---------------- | ------------------------------------- |
| Assigned Persona | Frontend Engineer                     |
| Status           | pending                               |
| Depends On       | TASK-03-008, TASK-03-006, TASK-03-007 |
| Deliverable      | Working application shell             |

**Description**:
Implement the application shell based on design spec.

**Acceptance Criteria**:

- [ ] `<AppShell>` layout component
- [ ] `<Sidebar>` with navigation links
- [ ] `<Header>` with company switcher
- [ ] Privacy mode toggle in header
- [ ] Main content slot
- [ ] Responsive sidebar (collapsible)

**Notes**:
Use TanStack Router's layout routes for the shell.

---

### TASK-03-010: Implement Company Switcher

| Field            | Value                      |
| ---------------- | -------------------------- |
| Assigned Persona | Frontend Engineer          |
| Status           | pending                    |
| Depends On       | TASK-03-006, TASK-03-004   |
| Deliverable      | Company dropdown component |

**Description**:
Create the company switcher dropdown for the header.

**Acceptance Criteria**:

- [ ] Dropdown shows all companies
- [ ] Current company indicated
- [ ] Selecting updates context
- [ ] Loading state while fetching
- [ ] Empty state if no companies

**Notes**:
Use shadcn/ui dropdown-menu component.

---

### TASK-03-011: Set Up Toast Notifications

| Field            | Value                     |
| ---------------- | ------------------------- |
| Assigned Persona | Frontend Engineer         |
| Status           | pending                   |
| Depends On       | TASK-03-004               |
| Deliverable      | Toast notification system |

**Description**:
Configure toast notifications for success/error feedback.

**Acceptance Criteria**:

- [ ] Toast provider configured
- [ ] `useToast()` hook available
- [ ] Success, error, info variants
- [ ] Auto-dismiss with configurable duration
- [ ] Can be triggered from anywhere in app

**Notes**:
Use shadcn/ui toast component. Configure Sonner or similar.

---

### TASK-03-012: Create Error Boundary

| Field            | Value                    |
| ---------------- | ------------------------ |
| Assigned Persona | Frontend Engineer        |
| Status           | pending                  |
| Depends On       | TASK-03-001              |
| Deliverable      | Error boundary component |

**Description**:
Create error boundary for graceful error handling.

**Acceptance Criteria**:

- [ ] Error boundary catches render errors
- [ ] User-friendly error message
- [ ] Option to retry/reset
- [ ] Errors logged (console for now)
- [ ] Works with TanStack Router

**Notes**:
Place at root and route level for granular recovery.

---

## Task Dependency Graph

```
TASK-03-001 (Vite init)
├── TASK-03-002 (Router)
├── TASK-03-003 (Tailwind)
│   └── TASK-03-004 (shadcn)
│       ├── TASK-03-008 (Shell design)
│       ├── TASK-03-010 (Company switcher)
│       └── TASK-03-011 (Toasts)
├── TASK-03-005 (Convex)
│   └── TASK-03-006 (Company context)
│       └── TASK-03-009 (Shell impl) ← also depends on 008, 007
├── TASK-03-007 (Privacy context)
└── TASK-03-012 (Error boundary)
```

## Delegation Order

1. TASK-03-001 (start after scaffolding)
2. TASK-03-002, TASK-03-003, TASK-03-007, TASK-03-012 (parallel)
3. TASK-03-004, TASK-03-005 (after 003, 001)
4. TASK-03-006, TASK-03-008, TASK-03-011 (after 005, 004)
5. TASK-03-010 (after 006, 004)
6. TASK-03-009 (after 006, 007, 008)
