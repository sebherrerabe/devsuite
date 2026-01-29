# apps/web — Agent Instructions

## Stack

- Vite + React + TypeScript
- TanStack Router
- Tailwind CSS + shadcn/ui
- Convex React client

## UI conventions

- Build accessible, responsive components by default.
- Always include loading/empty/error states for data-driven UI.
- Prefer reusable components for selectors (company/repo/project/task).

## Data conventions

- Use Convex subscriptions for realtime entity lists when appropriate.
- Keep company context consistent with the shell's company switcher.
