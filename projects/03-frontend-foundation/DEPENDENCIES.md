# Dependencies: Frontend Foundation

## Required Inputs

### From 00-scaffolding
- [ ] `apps/web/` folder exists
- [ ] TypeScript configured
- [ ] Package can import `@devsuite/shared`

### From 01-shared-types
- [ ] Entity types for type-safe props
- [ ] Enum types for UI state

### From 02-convex-foundation (partial)
- [ ] Convex client configuration
- [ ] Companies query (for company switcher)

## Produced Outputs

### For All Feature Modules
- [ ] Application shell (layout, navigation)
- [ ] Company context hook
- [ ] Privacy mode context hook
- [ ] Base UI components
- [ ] Routing patterns
- [ ] Convex hooks integration

### Specific Outputs
- [ ] `useCurrentCompany()` hook
- [ ] `usePrivacyMode()` hook
- [ ] `<AppShell>` component
- [ ] `<CompanySwitcher>` component
- [ ] Route definition patterns

## External Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| vite | Bundler | ^6.x |
| react | UI library | ^19.x |
| react-dom | React DOM | ^19.x |
| @tanstack/react-router | Routing | ^1.x |
| @tanstack/react-query | Data fetching | ^5.x |
| convex | Convex client | ^1.x |
| tailwindcss | Styling | ^4.x |
| lucide-react | Icons | ^0.x |
| class-variance-authority | Component variants | ^0.x |
| clsx | Class utilities | ^2.x |
| tailwind-merge | Tailwind utilities | ^2.x |

### shadcn/ui Components (installed via CLI)
- button
- input
- select
- card
- dialog
- table
- toast
- dropdown-menu
- (more as needed)

## Blocking Issues
- Waiting on 00-scaffolding completion
- Waiting on 01-shared-types completion
- Partially waiting on 02-convex-foundation (for company data)
