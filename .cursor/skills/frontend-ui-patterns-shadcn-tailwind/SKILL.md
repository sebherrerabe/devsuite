---
name: frontend-ui-patterns-shadcn-tailwind
description: Implement UI components using shadcn/ui and Tailwind CSS v4, following DevSuite conventions for loading/empty/error states, accessibility, forms, and component composition. Use when building UI components, forms, or styling features.
---

# Frontend UI Patterns (shadcn/ui + Tailwind v4)

## Intent
This skill is responsible for establishing UI component patterns and styling conventions:
- Tailwind CSS v4 setup and configuration
- shadcn/ui component installation and customization
- Consistent loading/empty/error state patterns
- Form patterns with React Hook Form + Zod
- Accessibility standards (ARIA, keyboard navigation)
- Component composition patterns
- Theme system (light/dark mode)

## Non-Goals
- Routing or navigation (use `frontend-app-shell-and-routing`)
- Data fetching logic (use `frontend-convex-integration`)
- Business logic implementation (delegated to feature modules)
- Custom component library beyond shadcn/ui base

## Inputs to Read First
- Repo: `projects/03-frontend-foundation/PROJECT.md`
- Repo: `projects/_conventions.md` (spec standards)
- Repo: `/dev_suite_conceptual_architecture_business_vs_tech.md` (UI stack requirements)
- Docs (Context7): Tailwind CSS v4 CSS-first configuration, shadcn/ui installation, React Hook Form patterns
- Cursor: `https://cursor.com/docs/context/skills`

## Workflow

### 1) Configure Tailwind CSS v4 with Vite
- Install `tailwindcss` and `@tailwindcss/vite`
- Add Tailwind Vite plugin to `vite.config.ts`:
  ```ts
  import tailwindcss from '@tailwindcss/vite'

  plugins: [react(), tailwindcss()]
  ```
- Create/maintain main CSS file (e.g., `src/index.css`):
  ```css
  @import 'tailwindcss';
  ```
- **No `tailwind.config.js` needed** (v4 uses CSS-first config)
- Use `@theme` directive for custom theme values:
  ```css
  @theme {
    --color-primary: hsl(49, 100%, 7%);
    --color-link: hsl(49, 100%, 7%);
  }
  ```

### 2) Install and configure shadcn/ui
- Run `npx shadcn@latest init` in `apps/web/`
- Configure `components.json`:
  ```json
  {
    "style": "default",
    "rsc": false,
    "tailwind": {
      "config": "tailwind.config.js",
      "css": "src/index.css",
      "baseColor": "slate",
      "cssVariables": true
    },
    "aliases": {
      "components": "@/components",
      "utils": "@/lib/utils"
    }
  }
  ```
- Install base components: `npx shadcn@latest add button card input label form`
- Ensure path aliases (`@/components`, `@/lib`) resolve in `tsconfig.json`

### 3) Establish loading/empty/error state patterns
Create reusable state components in `src/components/ui/states/`:
- **LoadingState**: Skeleton loaders, spinners, progress indicators
- **EmptyState**: Empty list/table messages with optional actions
- **ErrorState**: Error messages with retry actions
- **Skeleton**: Reusable skeleton component for various content types

Pattern:
```tsx
{isLoading && <LoadingState />}
{!isLoading && !data && <EmptyState />}
{error && <ErrorState error={error} onRetry={refetch} />}
{data && <Content data={data} />}
```

### 4) Implement form patterns with React Hook Form + Zod
- Install: `react-hook-form`, `@hookform/resolvers`, `zod`
- Create form schema with Zod:
  ```ts
  const formSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
  })
  ```
- Use `useForm` with `zodResolver`:
  ```tsx
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "" },
  })
  ```
- Integrate shadcn/ui Form components:
  - `<Form>` wrapper with `form` prop
  - `<FormField>` for each field
  - `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>` for structure
- Handle submission: `form.handleSubmit(onSubmit)`

### 5) Ensure accessibility standards
- Use semantic HTML (`<button>`, `<nav>`, `<main>`, `<header>`)
- Add ARIA labels where needed: `aria-label`, `aria-describedby`
- Implement keyboard navigation:
  - Tab order is logical
  - Escape closes modals/dialogs
  - Enter submits forms
- Use shadcn/ui components (they include accessibility by default via Radix UI)
- Test with screen reader if possible
- Ensure color contrast meets WCAG AA standards

### 6) Component composition patterns
- **Shared UI components** live in `src/components/ui/` (shadcn/ui base)
- **Feature components** live in `src/components/features/<module>/`
- **Layout components** live in `src/components/layout/`
- Prefer composition over configuration:
  ```tsx
  <Card>
    <CardHeader>
      <CardTitle>Title</CardTitle>
    </CardHeader>
    <CardContent>Content</CardContent>
  </Card>
  ```
- Use `asChild` prop pattern for flexible rendering:
  ```tsx
  <Button asChild>
    <Link to="/path">Navigate</Link>
  </Button>
  ```

### 7) Theme system (light/dark mode)
- Use shadcn/ui's theme provider (or `next-themes` if needed)
- Configure CSS variables in `src/index.css`:
  ```css
  @theme {
    --color-background: light-dark(white, black);
    --color-foreground: light-dark(black, white);
  }
  ```
- Add theme toggle component (delegate to shell/skill)
- Ensure all components respect theme variables

### 8) Responsive design conventions
- Mobile-first approach: design for mobile, enhance for desktop
- Use Tailwind breakpoints: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
- Test sidebar collapse on mobile (if applicable)
- Ensure touch targets are at least 44x44px

## Deliverables Checklist
- [ ] Tailwind CSS v4 configured with Vite plugin
- [ ] Main CSS file imports Tailwind (`@import 'tailwindcss'`)
- [ ] Custom theme variables defined with `@theme` if needed
- [ ] shadcn/ui initialized and `components.json` configured
- [ ] Base shadcn/ui components installed (button, card, input, form, etc.)
- [ ] Path aliases (`@/components`, `@/lib`) resolve correctly
- [ ] Loading/empty/error state components created
- [ ] Form pattern established with React Hook Form + Zod
- [ ] Example form component demonstrates pattern
- [ ] Accessibility standards documented and followed
- [ ] Component composition structure established
- [ ] Theme system configured (light/dark mode)
- [ ] Responsive design conventions documented

## References
- Tailwind CSS v4: https://tailwindcss.com/blog/tailwindcss-v4
- shadcn/ui: https://ui.shadcn.com
- React Hook Form: https://react-hook-form.com
- Zod: https://zod.dev
- WCAG Guidelines: https://www.w3.org/WAI/WCAG21/quickref/

## Notes
- Tailwind v4 uses CSS-first config; avoid `tailwind.config.js` unless absolutely necessary
- shadcn/ui components are copied into your codebase; customize as needed
- Always provide loading and error states; never show raw `undefined` or errors to users
- Forms should validate on blur and submit; show clear error messages
- Accessibility is not optional; test keyboard navigation and screen readers
- Keep shared UI components generic; feature-specific logic belongs in feature components
