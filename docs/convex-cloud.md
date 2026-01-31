# Convex Cloud Bootstrap & Portability Guide

This guide documents how DevSuite uses Convex Cloud (Free tier) and how to transition to self-hosting if needed in the future.

## Current State: Convex Cloud (Free Tier)

DevSuite's default deployment target is **Convex Cloud**, the managed service operated by Convex Inc.

### Why Convex Cloud?

- **Zero ops overhead**: Managed database, backups, scaling
- **Free tier is generous**: Sufficient for MVP and small team dev
- **Quick local dev**: `npx convex dev` connects to cloud from your laptop
- **Built-in auth**: Better Auth component works seamlessly on Convex
- **Realtime out of the box**: Subscriptions require no extra infrastructure

### Setup Steps

1. **Initial Setup** (first time only):

   ```bash
   cd convex
   pnpm dev
   ```

   - Prompts for Convex Cloud sign-up or login
   - Creates a project and deployment
   - Saves project ID to `convex.json` (safe to commit)

2. **Environment Configuration**:

   ```bash
   # Set Better Auth secrets in Convex Cloud
   npx convex env set BETTER_AUTH_SECRET $(openssl rand -base64 32)
   npx convex env set SITE_URL http://localhost:5173
   ```

3. **Local Development**:

   ```bash
   NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud pnpm dev
   ```

4. **Production Deployment**:
   ```bash
   pnpm deploy
   ```

See `convex/README.md` for detailed instructions.

---

## Future: Self-Hosting Portability

If DevSuite outgrows the Convex Cloud free tier, we can self-host with minimal code changes.

### Portability Principles

1. **No cloud-only dependencies**: Code doesn't assume managed features
2. **URL/endpoint isolation**: Deployment target is env-configurable
3. **Secrets via env**: No hardcoded API keys or URLs
4. **Schema portability**: Convex schemas work locally and cloud

### Checklist: What Changes When Self-Hosting?

| Aspect           | Cloud (Current)              | Self-Hosted (Future)           | Effort |
| ---------------- | ---------------------------- | ------------------------------ | ------ |
| **Backend**      | Convex Cloud                 | Convex Node.js (self-hosted)   | Low    |
| **Database**     | Managed by Convex            | PostgreSQL (user-managed)      | Medium |
| **Deployment**   | `pnpm deploy`                | Docker/K8s + CI/CD             | High   |
| **Auth Secrets** | `npx convex env set`         | .env or secrets manager        | Low    |
| **Endpoint URL** | `https://<dep>.convex.cloud` | `https://<your-domain>/api`    | Low    |
| **Realtime**     | Built-in                     | WebSocket via Node.js          | Medium |
| **Backups**      | Automatic                    | User-managed                   | High   |
| **Monitoring**   | Convex Dashboard             | Custom/OpenTelemetry           | High   |
| **Cost Model**   | Free/Pay-as-you-go           | Fixed (infra) + variable (ops) |        |

### Migration Path (Example Scenario)

**Trigger**: "Convex Cloud free tier hit request limits"

**What stays the same**:

- `convex/schema.ts` (unchanged)
- `convex/functions/` (unchanged)
- `packages/shared/` types (unchanged)
- `apps/web/` queries/mutations (mostly unchanged)

**What changes**:

1. **Self-host Convex Node.js** on your infrastructure (Docker container)
2. **Replace managed PostgreSQL** with your own database
3. **Update `NEXT_PUBLIC_CONVEX_URL`** to your self-hosted endpoint
4. **Set up CI/CD** for deployments (GitHub Actions + Docker push)
5. **Implement monitoring & alerts** for uptime

**Estimated effort**: 2–3 weeks of infra/DevOps work (not included in current scope).

### Current Guardrails (To Stay Portable)

These practices are enforced now to prevent self-hosting friction later:

- ✅ **Convex schemas** use only portable database types (no cloud-specific features)
- ✅ **Environment variables** for URL/secrets (not hardcoded)
- ✅ **No cloud-only Convex features** (e.g., exotic indexes, cloud-only auth methods)
- ✅ **Soft delete patterns** (no hard deletes) = easier backup/restore
- ✅ **Company scoping** enforced (easier multi-tenant self-hosting later)

### What's NOT Included in Self-Hosting Scope

- Docker image for Convex Node.js
- Kubernetes manifests
- Database migration strategy
- CI/CD pipeline
- Monitoring/logging infrastructure

These will be specified in a future "infra-self-host" project if/when migration is triggered.

---

## Environment Variables Reference

| Variable                 | Cloud                        | Self-Hosted                   | Notes                        |
| ------------------------ | ---------------------------- | ----------------------------- | ---------------------------- |
| `NEXT_PUBLIC_CONVEX_URL` | `https://<dep>.convex.cloud` | `https://<your-domain>/api`   | App → Backend endpoint       |
| `CONVEX_DEPLOYMENT`      | (optional)                   | (not used)                    | For prod deployments         |
| `BETTER_AUTH_SECRET`     | Via `convex env set`         | Via `.env` or secrets manager | Auth token signing           |
| `SITE_URL`               | Via `convex env set`         | Via `.env` or app config      | Cookie domain, redirect URLs |

---

## Decision Log

| Date       | Decision                       | Rationale                                        |
| ---------- | ------------------------------ | ------------------------------------------------ |
| 2026-01-31 | Convex Cloud (Free) as default | Zero ops for MVP; generous free tier             |
| 2026-01-31 | Better Auth on Convex          | Native integration, no extra infra               |
| 2026-01-31 | Defer self-host Docker/K8s     | Out of scope for foundation; trigger-based later |
| 2026-01-31 | Env-based URL isolation        | Enable future self-host without code changes     |

---

## FAQ

### Can we use Convex Cloud free tier in production?

**Short answer**: Yes, but monitor usage. The free tier includes:

- 500K monthly reads
- 250K monthly writes
- 100MB stored data
- Shared infrastructure (no SLA)

For a small team or MVP, this is sufficient. Monitor your dashboard for approaching limits.

### What if we hit the free tier limits?

Options:

1. Upgrade to Convex Cloud paid plan (per-usage pricing)
2. Migrate to self-hosted Convex (requires infra work)

The codebase is designed to make option 2 feasible without major refactoring.

### How do I back up data from Convex Cloud?

Convex Cloud handles automatic backups. For manual exports:

- Use Convex CLI: `npx convex export` (exports schema + data as JSON)
- Useful for snapshots before major migrations

### Can we run multiple Convex deployments (staging, production)?

Yes. Create separate Convex projects for each environment:

```bash
# Prod
CONVEX_DEPLOYMENT=prod npx convex deploy

# Staging
CONVEX_DEPLOYMENT=staging npx convex deploy
```

Each gets its own project ID and database.

### How do I test self-hosting without full migration?

**For validation only** (not in current scope):

1. Spin up Convex Node.js locally in Docker
2. Point `NEXT_PUBLIC_CONVEX_URL` to `http://localhost:8000`
3. Run integration tests

This is deferred to a future project.

---

## References

- [Convex Documentation](https://docs.convex.dev)
- [Convex Pricing](https://www.convex.dev/pricing)
- [Convex Self-Hosting (Future)](https://docs.convex.dev/self-hosting) — not available yet; placeholder
- [DevSuite Architecture](../dev_suite_conceptual_architecture_business_vs_tech.md)
- [Convex Foundation Project](../projects/02-convex-foundation/PROJECT.md)
