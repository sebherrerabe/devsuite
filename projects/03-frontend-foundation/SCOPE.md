# Scope: Frontend Foundation

## In Scope

### Build Setup
- Vite configuration for React + TypeScript
- Path aliases (`@/` for src)
- Environment variable handling
- Development and production builds

### Routing
- TanStack Router setup
- File-based route generation
- Type-safe route definitions
- Layout routes for shared UI
- Protected route pattern (for auth later)

### State Management
- Convex React provider setup
- TanStack Query for external API calls
- React Context for app-level state
- Company context (current company)
- Privacy mode context

### UI Framework
- Tailwind CSS v4 configuration
- shadcn/ui installation and theming
- CSS custom properties for theming
- Dark/light mode support
- lucide-react icon library

### Application Shell
- Root layout component
- Sidebar navigation
- Header with company switcher
- Privacy mode toggle
- Main content area
- Toast/notification system

### Base Components
- Button variants (from shadcn)
- Form components (input, select, checkbox)
- Card component
- Dialog/modal pattern
- Table component
- Loading states
- Error boundaries

### Company Context
- Company selector dropdown
- Current company in context
- Persist selection (localStorage)
- Company-scoped routes

### Privacy Mode
- Toggle between company view and global view
- Visual indicator of current mode
- Persist preference

## Out of Scope

- Feature-specific pages (covered by: feature modules)
- Convex schema/functions (covered by: 02-convex-foundation)
- MCP integration (covered by: 09-mcp-server)
- Authentication UI (deferred)
- Mobile-responsive beyond basic

## Boundaries

### Foundation vs Features
This project creates the shell and patterns. Feature modules add specific pages and components.

### shadcn Components vs Custom
Use shadcn/ui as the base. Custom components should follow shadcn patterns.

### Convex vs TanStack Query
Use Convex hooks for database operations. Use TanStack Query for external APIs (GitHub, etc.).

## Assumptions
- Single-user application (no auth UI needed initially)
- Desktop-first (basic mobile support)
- Modern browsers only (no IE11)
- Company list comes from Convex

## Open Questions
- [ ] Specific shadcn/ui theme preferences? (owner: @human-review)
- [ ] Navigation structure (sidebar items)? (owner: @ux-designer)
- [ ] Any specific accessibility requirements? (owner: @human-review)
