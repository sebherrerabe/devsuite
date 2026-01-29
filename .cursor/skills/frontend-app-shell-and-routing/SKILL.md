---
name: frontend-app-shell-and-routing
description: Set up TanStack Router with file-based routing, application shell (layout, navigation, sidebar), company context propagation, and type-safe navigation patterns. Use when implementing routing, layouts, navigation components, or company switcher integration.
---

# Frontend App Shell & Routing

## Intent
This skill is responsible for establishing the routing foundation and application shell that all feature modules build upon:
- TanStack Router configuration with file-based routing
- Application shell (root layout, sidebar, header)
- Company context propagation through routes
- Type-safe navigation patterns
- Privacy mode integration with routing

## Non-Goals
- Implementing feature-specific routes (delegated to module skills)
- UI component implementation (use `frontend-ui-patterns-shadcn-tailwind`)
- Convex data fetching (use `frontend-convex-integration`)
- Authentication flows (covered by authz skill)

## Inputs to Read First
- Repo: `projects/03-frontend-foundation/PROJECT.md`, `projects/04-company-module/PROJECT.md`
- Repo: `projects/_conventions.md` (spec standards)
- Repo: `/dev_suite_conceptual_architecture_business_vs_tech.md` (routing requirements)
- Docs (Context7): TanStack Router file-based routing, route configuration, type-safe navigation
- Cursor: `https://cursor.com/docs/context/skills`

## Workflow

### 1) Configure TanStack Router plugin in Vite
- Install `@tanstack/router-plugin` and `@tanstack/react-router`
- Add router plugin to `vite.config.ts` **before** React plugin:
  ```ts
  import { tanstackRouter } from '@tanstack/router-plugin/vite'

  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
  ]
  ```
- Create `tsr.config.json` in project root:
  ```json
  {
    "routesDirectory": "./src/routes",
    "generatedRouteTree": "./src/routeTree.gen.ts"
  }
  ```

### 2) Set up file-based route structure
- Create `src/routes/` directory
- Create root route: `src/routes/__root.tsx` with:
  - Root layout component (shell structure)
  - `<Outlet />` for nested routes
  - Company context provider wrapper
- Create index route: `src/routes/index.tsx` (home page)
- Follow TanStack Router file naming conventions:
  - `index.tsx` → `/`
  - `about.tsx` → `/about`
  - `posts.$id.tsx` → `/posts/:id`
  - `posts.route.tsx` → layout for `/posts/*`
  - Files prefixed with `-` are ignored

### 3) Implement application shell components
Create in `src/components/shell/`:
- **RootLayout**: Main app container with sidebar + content area
- **Sidebar**: Navigation menu, company switcher, privacy toggle
- **Header**: Top bar with user info, notifications, theme toggle
- **CompanySwitcher**: Dropdown/select for switching company context
- **PrivacyToggle**: Switch between company-scoped and private global mode

Shell structure:
```
<RootLayout>
  <Sidebar />
  <main>
    <Header />
    <Outlet /> {/* Route content */}
  </main>
</RootLayout>
```

### 4) Set up company context propagation
- Create `src/contexts/CompanyContext.tsx`:
  - Provides current `companyId` (or `null` for private mode)
  - Provides `setCompanyId` function
  - Provides `privacyMode` state (`'company' | 'private'`)
- Wrap root route with `CompanyProvider`
- Access context in routes via `useCompanyContext()` hook
- Pass company context to Convex queries (see `frontend-convex-integration`)

### 5) Configure type-safe navigation
- Import generated route tree: `import { routeTree } from '../routeTree.gen'`
- Create router instance with route tree
- Register router types:
  ```ts
  declare module '@tanstack/react-router' {
    interface Register {
      router: typeof router
    }
  }
  ```
- Use `<Link>` components with type-safe `to` prop
- Use `useNavigate()` hook for programmatic navigation

### 6) Handle loading and error states
- Create `src/routes/__root.tsx` with:
  - `pendingComponent` for route-level loading
  - `errorComponent` for route-level errors
- Use TanStack Router's `beforeLoad` for data prefetching if needed
- Implement consistent loading skeletons (delegate to UI skill for components)

### 7) Integrate with company switcher
- Company switcher reads from Convex query (list companies)
- On company switch:
  - Update `CompanyContext`
  - Navigate to company-scoped route if needed
  - Invalidate relevant Convex queries
- Handle "private global mode" (no company selected)

## Deliverables Checklist
- [ ] Vite configured with TanStack Router plugin
- [ ] `tsr.config.json` created with route directory settings
- [ ] `src/routes/` directory structure established
- [ ] Root route (`__root.tsx`) with shell layout
- [ ] Index route (`index.tsx`) renders correctly
- [ ] Application shell components (Sidebar, Header, RootLayout)
- [ ] Company context provider and hook
- [ ] Company switcher component integrated
- [ ] Privacy mode toggle functional
- [ ] Router types registered and type-safe navigation works
- [ ] Route tree generates successfully (`pnpm dev` works)
- [ ] Loading and error states handled at route level

## References
- TanStack Router docs: https://tanstack.com/router/latest
- File-based routing: https://tanstack.com/router/latest/docs/framework/react/guide/file-based-routing
- Route configuration: https://tanstack.com/router/latest/docs/api/file-based-routing

## Notes
- Keep route files focused on route configuration; delegate component implementation to feature modules
- Company context must be available before any Convex queries run
- Privacy mode affects which data is visible; enforce at query level, not just UI level
- Use route-level code splitting; TanStack Router handles this automatically with file-based routing
