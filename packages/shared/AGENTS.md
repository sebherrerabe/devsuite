# packages/shared — Agent Instructions

## Purpose

Single source of truth for shared contracts:

- TypeScript types
- Zod schemas for runtime validation
- small shared utilities (no app-specific logic)

## Rules

- Keep exports stable; document breaking changes.
- Avoid circular dependencies.
- Keep imports dependency-light (shared should not depend on apps; avoid backend-specific imports).
- Prefer Zod schemas colocated with types when feasible.

## Outputs expected

- Clean import surface: `@devsuite/shared`
- Strict TypeScript compatibility
