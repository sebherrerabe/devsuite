# Convex Foundation

This directory contains the Convex backend for DevSuite, including schemas, functions, and cross-cutting patterns (company scoping, soft delete, authentication).

## Quick Start

### 1. Prerequisites

- Node.js >= 22.0.0
- pnpm >= 9.0.0
- Convex account (free at [convex.dev](https://www.convex.dev))

### 2. Initialize Convex Cloud Project

If this is your first time setting up DevSuite:

```bash
# From repo root
cd convex

# Run Convex dev server (first time will prompt for login)
pnpm dev
```

On first run, the CLI will typically:

1. Prompt you to sign up for Convex Cloud (if you don't have an account)
2. Create or select a Convex project
3. Establish a development deployment and start syncing code

This repo already includes a root-level `convex.json` that points Convex at the `convex/` functions directory. It is safe to commit. **Do not commit secrets** (auth secrets must be stored in Convex env vars).

### 3. Configure Better Auth Environment Variables

Better Auth requires secrets to be set in Convex Cloud (not in your local `.env`):

```bash
# Generate a random secret for auth token signing
BETTER_AUTH_SECRET=$(openssl rand -base64 32)

# Set it in Convex Cloud
npx convex env set BETTER_AUTH_SECRET $BETTER_AUTH_SECRET

# Set your site URL (for local dev)
npx convex env set SITE_URL http://localhost:5173
```

**For production**, update `SITE_URL` to your deployed app URL.

### 4. Populate `.env` (Local Dev Only)

After running `pnpm dev`, update the repo root `.env.local` with your Convex deployment URL:

```bash
# Vite (apps/web) convention:
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud

# Optional: if you use a different frontend framework that expects NEXT_PUBLIC_*
# NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
```

See `.env.example` for full reference.

### 5. Run Dev Server

```bash
# Start Convex dev server (stays running)
pnpm dev

# In another terminal, start the frontend
cd ../apps/web
pnpm dev
```

The Convex dev server watches for schema and function changes and automatically redeploys to your local development environment.

---

## Project Structure

```
convex/
├── schema.ts              # Core entity schemas with indexes + soft-delete fields
├── lib/helpers.ts         # Cross-cutting helpers (company scoping, soft delete, pagination)
├── auth.config.ts         # Better Auth provider configuration (Convex auth)
├── convex.config.ts       # Convex app config (registers Better Auth component)
├── http.ts                # HTTP routes (Better Auth endpoints)
├── auth.ts                # Minimal auth sanity query (identity)
├── betterAuth/            # Better Auth component wiring
│   ├── auth.ts
│   ├── adapter.ts
│   ├── convex.config.ts
│   └── schema.ts
└── README.md              # This file
```

---

## Key Patterns

### Company Scoping

All company-scoped queries and mutations **must** enforce tenant isolation. In DevSuite, the baseline pattern is:

- **Require `companyId` as an explicit function argument** (do not infer it from auth yet).
- **Validate ownership** for any entity IDs passed in (entity must belong to the provided `companyId`).

```typescript
import { query } from './_generated/server';
import { v } from 'convex/values';
import { requireCompanyId } from './lib/helpers';

export const listRepositories = query({
  args: { companyId: v.id('companies') },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    return await ctx.db
      .query('repositories')
      .withIndex('by_companyId_deletedAt', q =>
        q.eq('companyId', companyId).eq('deletedAt', null)
      )
      .collect();
  },
});
```

### Soft Delete

Never use hard deletes. **Do not call `ctx.db.delete`** for application entities.

Use `deletedAt` as the **source of truth**:

- Active record: `deletedAt` is empty (this codebase uses `null` in Convex tables)
- Deleted record: `deletedAt` is a timestamp (number)

```typescript
import { mutation } from './_generated/server';
import { v } from 'convex/values';
import {
  createSoftDeletePatch,
  assertCompanyScoped,
  requireCompanyId,
} from './lib/helpers';

export const softDeleteRepository = mutation({
  args: { companyId: v.id('companies'), repositoryId: v.id('repositories') },
  handler: async (ctx, args) => {
    const companyId = requireCompanyId(args.companyId);
    const repo = await ctx.db.get(args.repositoryId);
    assertCompanyScoped(repo, companyId, 'repositories');
    await ctx.db.patch(args.repositoryId, createSoftDeletePatch());
  },
});
```

### External References Only

For GitHub/Notion/TickTick/etc: **store references, not full copies**.

- **OK**: identifiers, URLs, provider enum, and small metadata needed for linking.
- **Not OK**: mirroring full external content into Convex tables.

Example (tasks): `externalLinks[]` holds `{ type, identifier, url }`.

### Realtime + Pagination Guidance

- Design “list” queries to be **subscription-friendly**: stable filters + indexed access.
- Prefer composite indexes that include deletion state (e.g. `by_companyId_deletedAt`) to avoid full table scans.
- For pagination, use a **cursor-based approach** and keep sorting deterministic. If you introduce new list queries, document:
  - sort key(s)
  - index used
  - cursor encoding/decoding approach

### Authentication

Better Auth handles user registration and login. Functions access identity via `ctx.auth`:

```typescript
export const currentUser = query(async ctx => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  return identity;
});
```

### MCP “Service Auth” Note

MCP tools may call Convex as a **service actor** (not an end-user browser session). In that case:

- `ctx.auth.getUserIdentity()` may be `null`
- Functions must still require `companyId` and enforce ownership checks
- Never add “global” access paths that bypass company scoping for convenience

---

## Development Workflow

### Local Changes

1. Edit schemas in `schema.ts`
2. Write functions in `convex/*.ts` (or subfolders you create)
3. The dev server automatically reloads

### Testing Queries

Use the Convex dashboard (opened by `pnpm dev`) to test queries/mutations interactively.

### Type Safety

Run type-checking:

```bash
pnpm typecheck
```

---

## Deployment

### Deploy to Convex Cloud Production

```bash
pnpm deploy
```

This deploys your schema and functions to your production Convex deployment. Better Auth secrets are already stored in Convex Cloud.

### Self-Hosting (Future)

DevSuite is **Cloud Free-first**. If self-hosting becomes a requirement later, treat it as a portability effort and document any config changes explicitly (do not assume self-hosted as the default).

---

## Troubleshooting

### "Deployment not found" error

The Convex CLI likely isn’t linked to a deployment yet, or your local env is missing the deployment URL. Run `pnpm dev` (in `convex/`) to log in/link a project, then ensure your repo root `.env.local` has your Convex deployment URL set.

### "Authentication failed"

Ensure `BETTER_AUTH_SECRET` and `SITE_URL` are set:

```bash
npx convex env list
```

If missing, set them:

```bash
npx convex env set BETTER_AUTH_SECRET $(openssl rand -base64 32)
npx convex env set SITE_URL http://localhost:5173
```

### "Type errors after schema change"

After editing `schema.ts`, restart the dev server and regenerate types:

```bash
# Stop the dev server (Ctrl+C), then restart
pnpm dev
```

---

## Further Reading

- [Convex Documentation](https://docs.convex.dev)
- [Better Auth on Convex](https://www.better-auth.com/docs/integrations/convex)
- [DevSuite Architecture](../dev_suite_conceptual_architecture_business_vs_tech.md)
- [Convex Foundation Project Spec](../projects/02-convex-foundation/PROJECT.md)
