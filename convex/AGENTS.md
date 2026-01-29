# convex — Agent Instructions

## Purpose

Convex backend for DevSuite: schema + functions enforcing integrity.

## Rules (non-negotiable)

- Enforce company scoping on every query/mutation/action.
- No hard deletes; implement soft delete patterns only.
- External systems referenced, never mirrored.

## Implementation conventions

- Validate inputs (prefer shared Zod schemas where appropriate).
- Prefer shared helper utilities for common scoping/authorization checks.
- Index for common access patterns (companyId + entity fields).
