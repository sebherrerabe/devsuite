---
name: frontend-convex-integration
description: Integrate Convex React client with TanStack Query patterns, handle realtime subscriptions, company scoping, and data fetching patterns. Use when connecting frontend to Convex backend, implementing data fetching, or handling realtime updates.
---

# Frontend Convex Integration

## Intent

This skill is responsible for connecting the React frontend to the Convex backend:

- Convex React client setup and configuration
- Realtime subscription patterns with `useQuery`
- Mutation patterns with `useMutation`
- Company scoping integration
- Error handling and loading states
- Type-safe Convex function references

## Non-Goals

- Defining Convex schema or functions (use Convex skills)
- UI component implementation (use `frontend-ui-patterns-shadcn-tailwind`)
- Routing or navigation (use `frontend-app-shell-and-routing`)
- Business logic (delegated to feature modules)

## Inputs to Read First

- Repo: `projects/02-convex-foundation/PROJECT.md`, `projects/03-frontend-foundation/PROJECT.md`
- Repo: `projects/_conventions.md` (spec standards)
- Repo: `/dev_suite_conceptual_architecture_business_vs_tech.md` (realtime model, company scoping)
- Docs (Context7): Convex React hooks, useQuery, useMutation, subscriptions, realtime patterns
- Cursor: `https://cursor.com/docs/context/skills`

## Workflow

### 1) Set up Convex React client

- Install `convex` package in `apps/web/`
- Create Convex client in `src/lib/convex.ts`:

  ```ts
  import { ConvexReactClient } from 'convex/react';

  const convexUrl = import.meta.env.VITE_CONVEX_URL;
  if (!convexUrl) {
    throw new Error('VITE_CONVEX_URL is not set');
  }

  export const convex = new ConvexReactClient(convexUrl);
  ```

- Wrap app root with `ConvexProvider`:

  ```tsx
  import { ConvexProvider } from 'convex/react';

  <ConvexProvider client={convex}>
    <App />
  </ConvexProvider>;
  ```

### 2) Configure type-safe Convex function references

- Import generated API types: `import { api } from "../convex/_generated/api"`
- Use `api` object for type-safe function references:
  ```tsx
  const data = useQuery(api.tasks.getAll, { companyId });
  ```
- Ensure `convex/_generated/api.ts` is generated (run `npx convex dev`)

### 3) Implement query patterns with `useQuery`

- Use `useQuery` for read operations (automatically subscribes to realtime updates):

  ```tsx
  import { useQuery } from 'convex/react';

  function TaskList({ companyId }: { companyId: string | null }) {
    const tasks = useQuery(api.tasks.list, { companyId });

    if (tasks === undefined) {
      return <LoadingState />;
    }

    return <TaskListContent tasks={tasks} />;
  }
  ```

- Handle `undefined` during initial load (Convex returns `undefined` while loading)
- Query automatically re-runs when arguments change
- Query automatically updates when backend data changes (realtime)

### 4) Implement mutation patterns with `useMutation`

- Use `useMutation` for write operations:

  ```tsx
  import { useMutation } from 'convex/react';

  function CreateTaskForm() {
    const createTask = useMutation(api.tasks.create);
    const [isPending, setIsPending] = useState(false);

    const handleSubmit = async (data: TaskInput) => {
      setIsPending(true);
      try {
        await createTask(data);
        // Success handling
      } catch (error) {
        // Error handling
      } finally {
        setIsPending(false);
      }
    };

    return <form onSubmit={handleSubmit}>...</form>;
  }
  ```

- Mutations are async; handle loading states manually
- Mutations don't automatically refetch queries; queries update via realtime

### 5) Integrate company scoping

- Always pass `companyId` to queries/mutations that require it:
  ```tsx
  const tasks = useQuery(api.tasks.list, {
    companyId: companyId ?? undefined, // null becomes undefined
  });
  ```
- Use company context from `frontend-app-shell-and-routing`:

  ```tsx
  import { useCompanyContext } from '@/contexts/CompanyContext';

  function TaskList() {
    const { companyId } = useCompanyContext();
    const tasks = useQuery(api.tasks.list, { companyId });
    // ...
  }
  ```

- Handle private global mode (`companyId === null`):
  - Some queries may not accept `companyId: null`
  - Use conditional queries: `enabled: companyId !== null`
  - Or create separate query functions for private mode

### 6) Handle loading and error states

- **Loading**: `useQuery` returns `undefined` during initial load
- **Error**: Convex queries throw errors; use error boundaries or try/catch
- Pattern:

  ```tsx
  const data = useQuery(api.tasks.list, { companyId });

  if (data === undefined) {
    return <LoadingState />;
  }

  // data is defined here
  return <Content data={data} />;
  ```

- For mutations, track `isPending` state manually

### 7) Optimize query patterns

- **Conditional queries**: Use `enabled` pattern if needed (though Convex handles this well):
  ```tsx
  // Not typically needed with Convex, but example:
  const data = useQuery(
    api.tasks.list,
    { companyId },
    { enabled: companyId !== null }
  );
  ```
- **Query keys**: Convex automatically handles caching based on function + args
- **Refetching**: Not needed; realtime updates handle this automatically
- **Stale data**: Convex queries are always fresh (realtime)

### 8) Integrate with TanStack Query (if needed)

- Convex queries use `useQuery` from `convex/react`, not TanStack Query
- Use TanStack Query only for non-Convex data (external APIs, etc.)
- Don't mix Convex `useQuery` with TanStack Query `useQuery` in the same component
- If you need both, use different variable names:

  ```tsx
  import { useQuery as useConvexQuery } from 'convex/react';
  import { useQuery } from '@tanstack/react-query';

  const convexData = useConvexQuery(api.tasks.list);
  const externalData = useQuery({
    queryKey: ['external'],
    queryFn: fetchExternal,
  });
  ```

## Deliverables Checklist

- [ ] Convex React client configured and exported
- [ ] `ConvexProvider` wraps app root
- [ ] Environment variable `VITE_CONVEX_URL` documented
- [ ] Type-safe API imports working (`api` from `_generated/api`)
- [ ] Example query component using `useQuery`
- [ ] Example mutation component using `useMutation`
- [ ] Company scoping integrated (companyId passed to queries)
- [ ] Private global mode handled correctly
- [ ] Loading states handled (`undefined` check)
- [ ] Error handling pattern established
- [ ] Realtime updates verified (data updates automatically)

## References

- Convex React docs: https://docs.convex.dev/client/react
- useQuery hook: https://docs.convex.dev/api/react/useQuery
- useMutation hook: https://docs.convex.dev/api/react/useMutation
- Realtime subscriptions: https://docs.convex.dev/client/react#reactivity

## Notes

- Convex `useQuery` automatically subscribes to realtime updates; no manual refetching needed
- Always handle `undefined` return value from `useQuery` (initial load state)
- Company scoping is enforced at the backend level; frontend must pass `companyId`
- Mutations are async; handle loading states with local state or loading indicators
- Convex queries are type-safe via generated `api` object; use it for all function references
- Don't use TanStack Query for Convex data; Convex has its own realtime system
- Privacy mode affects which queries are available; handle `companyId === null` appropriately
