# DevSuite — Deployment Research & Proposal

> Research on hosting options for DevSuite's apps and services.
> Goal: minimize cost (free-tier first), single-user workload.

**Last Updated**: 2026-02-16

---

## 1. Stack Inventory

| App / Service         | Runtime      | Type                     | Protocol       | Port | Always-On? | Notes                                               |
| --------------------- | ------------ | ------------------------ | -------------- | ---- | ---------- | --------------------------------------------------- |
| `apps/web`            | Vite + React | Static SPA (after build) | HTTP (CDN)     | -    | N/A        | Build output is pure static files (`dist/`)         |
| `apps/gh-service`     | Node.js 22   | HTTP microservice        | HTTP/JSON REST | 8790 | Yes        | GitHub OAuth, PR discovery, notification poll       |
| `apps/notion-service` | Node.js 22   | HTTP microservice        | HTTP/JSON REST | 8791 | Yes        | Notion OAuth, webhook receiver, link resolver       |
| `apps/mcp`            | Node.js 22   | MCP server (stdio)       | stdio          | -    | No         | Runs locally alongside AI agent (Cursor)            |
| `apps/desktop`        | Electron 30  | Desktop app (Windows)    | -              | -    | No         | Packaged with electron-builder + NSIS, runs locally |
| `convex/`             | Convex BaaS  | Managed backend          | -              | -    | N/A        | Deployed via `convex deploy`                        |
| `packages/shared`     | TypeScript   | Build-time library       | -              | -    | N/A        | Consumed by other packages at build time            |

### What actually needs hosting?

| Component             | Needs hosting? | Why                                                   |
| --------------------- | -------------- | ----------------------------------------------------- |
| `apps/web`            | **Yes**        | Static SPA served to browser                          |
| `apps/gh-service`     | **Yes**        | Must be reachable by the web app and receive webhooks |
| `apps/notion-service` | **Yes**        | Must be reachable by the web app and receive webhooks |
| `convex/`             | **No**         | Convex is a BaaS - deploy with `convex deploy`        |
| `apps/mcp`            | **No**         | Runs locally via stdio (Cursor MCP client)            |
| `apps/desktop`        | **No**         | Distributed as installer, runs locally                |
| `packages/shared`     | **No**         | Build-time dependency only                            |

**Summary**: We need to host **1 static site** + **2 always-on Node.js services**.

---

## 2. Convex (Backend) — No Action Needed

Convex is a fully managed BaaS. You deploy with `convex deploy` and it handles:

- Database, realtime subscriptions, server functions
- Auth (via better-auth integration)
- Scaling, uptime, SSL

### Free Tier Limits

| Resource         | Free Limit      | Enough for single user? |
| ---------------- | --------------- | ----------------------- |
| Database storage | 0.5 GiB         | Yes                     |
| Bandwidth        | 1 GiB/month     | Yes                     |
| Function calls   | 1,000,000/month | Yes                     |
| Action execution | 20 GiB-hours    | Yes                     |
| Deployments      | 40/team         | Yes                     |

**Verdict**: Convex free tier is more than enough for a single-user app. No cost here.

---

## 3. Platform Comparison

### 3.1 The Static SPA (`apps/web`)

The web app builds to a static `dist/` folder. Any CDN/static host works perfectly.

| Platform             | Free Tier?  | Bandwidth | Builds    | Custom Domain | Notes                                 |
| -------------------- | ----------- | --------- | --------- | ------------- | ------------------------------------- |
| **Vercel**           | Yes (Hobby) | 100 GB/mo | 100/day   | Yes + SSL     | Auto-detects Vite, zero config        |
| **Cloudflare Pages** | Yes (Free)  | Unlimited | 500/mo    | Yes + SSL     | Fastest global CDN, unlimited BW      |
| **Netlify**          | Yes (Free)  | 100 GB/mo | 300/mo    | Yes + SSL     | Mature, good DX                       |
| **GitHub Pages**     | Yes (Free)  | 100 GB/mo | Manual/CI | Yes + SSL     | Requires CI workflow, no build system |

**Winner: Cloudflare Pages** (or Vercel)

- Cloudflare Pages: unlimited bandwidth, fastest CDN, generous free tier
- Vercel: slightly better Vite DX (auto-detection), but 100 GB BW cap
- Both are excellent. For a single-user app, either works perfectly

---

### 3.2 The Node.js Services (`gh-service` + `notion-service`)

These two HTTP microservices need to be **always-on** because:

- They handle OAuth callback flows
- `gh-service` runs a background notification poller
- `notion-service` receives webhooks from Notion

This is the critical decision: **serverless vs. VPS**.

#### Why Serverless is Problematic Here

| Issue                   | Impact                                                        |
| ----------------------- | ------------------------------------------------------------- |
| Cold starts             | OAuth callbacks may timeout on cold start                     |
| No background processes | gh-service's notification poller needs always-on runtime      |
| Webhook reliability     | Notion webhooks need instant responses (< 5s)                 |
| State on disk           | Both services store encrypted tokens in `DATA_DIR`            |
| Port/server model       | Services use raw `http.createServer`, not serverless handlers |

**Verdict**: These services need a **persistent, always-on runtime**. Serverless (Lambda, Vercel Functions) is a poor fit without significant refactoring.

#### Platform Comparison for Always-On Node.js

| Platform             | Free Tier?         | Always-On?      | Cost (min)      | Multiple Services? | Notes                                              |
| -------------------- | ------------------ | --------------- | --------------- | ------------------ | -------------------------------------------------- |
| **Railway (Free)**   | $1/mo credit       | Yes             | ~$0             | 1 svc only (free)  | $1 credit burns in ~hours with 2 services          |
| **Railway (Hobby)**  | $5/mo credit       | Yes             | $5/mo           | Yes                | Could fit 2 small services in $5 budget            |
| **Render (Free)**    | 750 hrs/mo         | No (spins down) | $0              | Yes                | 15-min idle spindown kills webhooks/polling        |
| **Render (Starter)** | N/A                | Yes             | $7/mo/service   | Yes                | $14/mo for both services - expensive               |
| **Fly.io (Hobby)**   | $5/mo credit       | Yes             | $5/mo           | Yes                | ~$2.3/svc/mo for small VMs, fits in $5             |
| **Hetzner CX22**     | No free tier       | Yes             | ~€3.49/mo       | Yes (VPS)          | 2 vCPU, 4 GB RAM - both services on one box        |
| **OVH VPS-1**        | No free tier       | Yes             | ~£3.40/mo       | Yes (VPS)          | 4 vCPU, 8 GB RAM - excellent value                 |
| **AWS EC2 t3.micro** | 12 months free     | Yes             | $0 (first year) | Yes (VPS)          | 1 GiB RAM, free only first year then ~$8/mo        |
| **AWS Lambda**       | Always free 1M req | No              | $0              | N/A                | Not suitable (needs refactor, no background tasks) |

---

## 4. Strategy Analysis

### Option A: Full Free (Cloudflare Pages + Railway Free)

| Component      | Platform             | Cost   |
| -------------- | -------------------- | ------ |
| Web SPA        | Cloudflare Pages     | $0     |
| gh-service     | Railway (free)       | $0     |
| notion-service | ??? (no free option) | -      |
| Convex         | Convex Free          | $0     |
| **Total**      |                      | **$0** |

**Problem**: Railway free tier only allows 1 service and gives $1/mo credit. You cannot run 2 always-on services for free. No platform offers truly free always-on hosting for 2 services.

---

### Option B: Near-Free Hybrid (Cloudflare Pages + Railway Hobby)

| Component      | Platform         | Cost       |
| -------------- | ---------------- | ---------- |
| Web SPA        | Cloudflare Pages | $0         |
| gh-service     | Railway Hobby    | ~$2.5/mo   |
| notion-service | Railway Hobby    | ~$2.5/mo   |
| Convex         | Convex Free      | $0         |
| **Total**      |                  | **~$5/mo** |

Railway Hobby gives $5/mo credit. Two minimal Node.js services (low RAM, shared CPU) should fit within budget. Good DX with GitHub auto-deploy.

**Pros**: Zero-config deploys, auto-SSL, monitoring dashboard, CI/CD built-in
**Cons**: If services exceed $5 budget, charges apply. Limited control.

---

### Option C: Near-Free Hybrid (Cloudflare Pages + Fly.io Hobby)

| Component      | Platform         | Cost       |
| -------------- | ---------------- | ---------- |
| Web SPA        | Cloudflare Pages | $0         |
| gh-service     | Fly.io Hobby     | ~$2.3/mo   |
| notion-service | Fly.io Hobby     | ~$2.3/mo   |
| Convex         | Convex Free      | $0         |
| **Total**      |                  | **~$5/mo** |

Similar to Railway. Fly.io Hobby = $5/mo with $5 credit. Two shared-cpu-1x 256MB machines cost ~$4.60/mo total.

**Pros**: More control over machine sizing, great CLI, persistent volumes
**Cons**: Slightly steeper learning curve than Railway

---

### Option D: Budget VPS (Cloudflare Pages + Hetzner)

| Component      | Platform              | Cost                   |
| -------------- | --------------------- | ---------------------- |
| Web SPA        | Cloudflare Pages      | $0                     |
| gh-service     | Hetzner CX22 (shared) | shared                 |
| notion-service | Hetzner CX22 (shared) | shared                 |
| VPS (both svc) | Hetzner CX22          | ~€3.49/mo              |
| Convex         | Convex Free           | $0                     |
| **Total**      |                       | **~€3.49/mo (~$3.80)** |

Run both services on a single VPS. Use Docker Compose or systemd, or Coolify (self-hosted PaaS) for deploy automation.

**Pros**: Cheapest always-on option, full control, 2 vCPU + 4 GB RAM (massive overkill), could host more services later
**Cons**: You manage the server (updates, security, restarts). Coolify can automate most of this.

---

### Option E: Budget VPS with Coolify (Cloudflare Pages + Hetzner + Coolify)

Same as Option D but with Coolify as self-hosted PaaS:

| Component      | Platform          | Cost                   |
| -------------- | ----------------- | ---------------------- |
| Web SPA        | Cloudflare Pages  | $0                     |
| gh-service     | Hetzner + Coolify | shared                 |
| notion-service | Hetzner + Coolify | shared                 |
| VPS + Coolify  | Hetzner CX22      | ~€3.49/mo              |
| Convex         | Convex Free       | $0                     |
| **Total**      |                   | **~€3.49/mo (~$3.80)** |

**Pros**: Same price as raw VPS, but with Vercel-like DX (git push deploy, auto-SSL, monitoring UI, Docker management)
**Cons**: Coolify itself needs ~1 GB RAM (still fits in 4 GB CX22). Initial setup time ~30 min.

---

### Option F: AWS First-Year Free (Cloudflare Pages + EC2)

| Component      | Platform         | Cost                          |
| -------------- | ---------------- | ----------------------------- |
| Web SPA        | Cloudflare Pages | $0                            |
| gh-service     | AWS EC2 t3.micro | $0 (first year)               |
| notion-service | AWS EC2 t3.micro | $0 (first year)               |
| Convex         | Convex Free      | $0                            |
| **Total**      |                  | **$0 (year 1), ~$8/mo after** |

**Pros**: Truly free for 12 months
**Cons**: 1 GiB RAM is tight. AWS complexity (VPC, security groups, IAM). After year 1, ~$8/mo is expensive compared to Hetzner.

---

## 5. Recommendation

### Proposed Stack

| Component          | Platform             | Cost       | Rationale                                                 |
| ------------------ | -------------------- | ---------- | --------------------------------------------------------- |
| **Static Web SPA** | **Cloudflare Pages** | **$0**     | Unlimited BW, fastest CDN, great Vite support, truly free |
| **gh-service**     | **Railway Hobby**    | ~$2.5/mo   | Zero-config deploy, auto-SSL, fits in $5 credit           |
| **notion-service** | **Railway Hobby**    | ~$2.5/mo   | Same project, shared $5 credit budget                     |
| **Convex backend** | **Convex Free**      | **$0**     | BaaS, deploy with `convex deploy`, generous free tier     |
| **MCP server**     | **Local (stdio)**    | **$0**     | Runs alongside Cursor, no hosting needed                  |
| **Desktop app**    | **Local (Electron)** | **$0**     | Packaged installer, no hosting needed                     |
| **Total**          |                      | **~$5/mo** |                                                           |

### Why Railway Hobby over alternatives?

| Factor              | Railway ($5/mo) | Fly.io ($5/mo)   | Hetzner (~$3.80/mo)    | Render ($14/mo) |
| ------------------- | --------------- | ---------------- | ---------------------- | --------------- |
| Deploy complexity   | Git push        | Dockerfile + CLI | Docker/systemd/Coolify | Git push        |
| Auto SSL            | Yes             | Yes              | Manual or Coolify      | Yes             |
| Monitoring          | Built-in        | Basic            | DIY or Coolify         | Built-in        |
| Scaling             | Easy            | Easy             | Manual                 | Easy            |
| Cost for 2 services | ~$5 (incl.)     | ~$5 (incl.)      | ~$3.80                 | ~$14            |
| Server management   | None            | Minimal          | Full (or Coolify)      | None            |
| Fits free credit?   | Yes ($5)        | Yes ($5)         | No free tier           | No              |

**Railway wins on DX/simplicity** for your use case: single user, two small services, git push deploys, and the $5 credit covers both services comfortably.

### Budget Alternative

If you want to save that $5/mo, the **Hetzner CX22 + Coolify** option at ~€3.49/mo gives you:

- Way more resources (2 vCPU, 4 GB RAM)
- Vercel-like deploy UX via Coolify
- Room to host additional services later
- But requires initial server setup (~30 min)

### Free Alternative (with trade-offs)

If you want **$0/mo**, the only option is:

- Put the web SPA on Cloudflare Pages ($0)
- Consolidate `gh-service` + `notion-service` into a single process on Railway Free ($1/mo credit, 1 service limit)
- This requires code changes to merge both services into one HTTP server

---

## 6. Migration Checklist (for chosen option: Cloudflare Pages + Railway)

### Web SPA (Cloudflare Pages)

- [ ] Create Cloudflare account
- [ ] Connect GitHub repo to Cloudflare Pages
- [ ] Set build command: `pnpm run build:web:ci`
- [ ] Set build output directory: `apps/web/dist`
- [ ] Add env var `SKIP_DEPENDENCY_INSTALL=1` (so our filtered install runs instead of full install; avoids desktop/active-win on Linux)
- [ ] Set environment variables (Convex URL, service URLs)
- [ ] Configure custom domain (optional)
- [ ] Verify SPA fallback routing works (single-page app)

### gh-service (Railway)

- [ ] Create Railway account + Hobby plan ($5/mo)
- [ ] Create new project with service from GitHub repo
- [ ] Set root directory: `apps/gh-service`
- [ ] Set build command: `pnpm install && pnpm build`
- [ ] Set start command: `node dist/index.js`
- [ ] Configure environment variables:
  - `NODE_ENV=production`
  - `DEVSUITE_GH_SERVICE_TOKEN=<generate>`
  - `DEVSUITE_GH_SERVICE_ENCRYPTION_KEY=<generate>`
  - `DEVSUITE_GH_SERVICE_CORS_ORIGINS=<cloudflare-pages-url>`
  - `DEVSUITE_CONVEX_SITE_URL=<convex-url>`
- [ ] Verify health endpoint: `GET /health`
- [ ] Note: Railway provides persistent volume for `DATA_DIR`

### notion-service (Railway)

- [ ] Add second service to same Railway project
- [ ] Set root directory: `apps/notion-service`
- [ ] Set build command: `pnpm install && pnpm build`
- [ ] Set start command: `node dist/index.js`
- [ ] Configure environment variables:
  - `NODE_ENV=production`
  - `DEVSUITE_NOTION_SERVICE_TOKEN=<generate>`
  - `DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN=<generate-and-share-with-convex>`
  - `DEVSUITE_NOTION_SERVICE_ENCRYPTION_KEY=<generate>`
  - `DEVSUITE_NOTION_SERVICE_CORS_ORIGINS=<cloudflare-pages-url>`
  - `DEVSUITE_CONVEX_SITE_URL=<convex-url>`
  - `DEVSUITE_NOTION_OAUTH_CLIENT_ID=<from-notion>`
  - `DEVSUITE_NOTION_OAUTH_CLIENT_SECRET=<from-notion>`
- [ ] Verify health endpoint: `GET /health`
- [ ] Configure Notion webhook URL to point to Railway service

### Convex

- [ ] Run `npx convex deploy` from the repo root
- [ ] Set production environment variables in Convex dashboard
  - `DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN=<same-value-as-notion-service>`
- [ ] Verify deployment via Convex dashboard

### Post-Deploy

- [ ] Update web app env vars with production service URLs
- [ ] Test OAuth flows end-to-end (GitHub + Notion)
- [ ] Test webhook delivery (Notion)
- [ ] Monitor Railway usage to ensure it stays within $5 budget
- [ ] Set up Railway usage alerts

### Cloudflare Pages Troubleshooting

| Error                                        | Fix                                                                                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Could not resolve convex/_generated/api`    | Ensure the commit with `convex/_generated/` files is pushed (`git push`). The commit message is "chore: commit Convex generated files for CI builds". |
| `active-win` 404 / node-gyp compile on Linux | Use `build:web:ci` and `SKIP_DEPENDENCY_INSTALL=1`. The desktop app (Windows-only) pulls in `active-win`; the filtered install skips it.              |

---

## 7. Cost Summary

### Monthly Cost Breakdown

| Service        | Platform         | Monthly Cost |
| -------------- | ---------------- | ------------ |
| Web SPA        | Cloudflare Pages | $0           |
| gh-service     | Railway Hobby    | ~$2.50       |
| notion-service | Railway Hobby    | ~$2.50       |
| Convex backend | Convex Free      | $0           |
| MCP server     | Local            | $0           |
| Desktop app    | Local            | $0           |
| **Total**      |                  | **~$5/mo**   |

### Annual Cost

| Scenario                       | Annual Cost |
| ------------------------------ | ----------- |
| Cloudflare + Railway Hobby     | ~$60/yr     |
| Cloudflare + Hetzner CX22      | ~$46/yr     |
| Cloudflare + Fly.io Hobby      | ~$60/yr     |
| Cloudflare + AWS EC2 (year 1)  | $0          |
| Cloudflare + AWS EC2 (year 2+) | ~$96/yr     |

**Cheapest long-term**: Hetzner (~$46/yr) with slightly more setup effort
**Best DX**: Railway (~$60/yr) with zero server management
