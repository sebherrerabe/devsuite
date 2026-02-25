# DevSuite GitHub Service

Node.js service for GitHub integration workflows.

## Current Scope

- Service health and readiness endpoints
- Request auth boundary (`Authorization: Bearer` + `x-devsuite-user-id`)
- Optional signed user token auth (`x-devsuite-user-token`) when
  `DEVSUITE_GH_SERVICE_USER_TOKEN_SECRET` is configured
- Browser-first device flow endpoints:
- `POST /github/connect/start`
- `GET /github/connect/status`
- `POST /github/disconnect`
- `POST /github/pr/discover`
- `POST /github/pr/bundle-data`
- `POST /github/notifications/sync`
- Server-managed GitHub OAuth device flow with per-user state
- Encrypted GitHub token persistence (AES-256-GCM)
- Allowlisted GitHub command execution for PR discovery and bundle retrieval

## Environment Variables

- `DEVSUITE_GH_SERVICE_HOST` (default: `0.0.0.0`)
- `DEVSUITE_GH_SERVICE_PORT` (default: `8790`)
- `DEVSUITE_GH_SERVICE_TOKEN` (required in non-development environments)
- `DEVSUITE_GH_SERVICE_USER_TOKEN_SECRET` (optional; enables signed user-token auth)
- `DEVSUITE_GH_SERVICE_CORS_ORIGINS` (CSV, default: `http://localhost:5173`)
- `DEVSUITE_GH_SERVICE_DATA_DIR` (default: `~/.devsuite/gh-service`)
- `DEVSUITE_GH_SERVICE_ENCRYPTION_KEY` (required, base64 32-byte key)
- `DEVSUITE_GH_SERVICE_ENCRYPTION_KEY_VERSION` (optional; default `v1`)
- `DEVSUITE_GH_SERVICE_ENCRYPTION_LEGACY_KEYS` (optional JSON map for key rotation)
- `DEVSUITE_GH_OAUTH_CLIENT_ID` (default: GitHub CLI OAuth app id)
- `DEVSUITE_GH_OAUTH_SCOPES` (default: `repo,read:org,gist,notifications`)
- `DEVSUITE_GH_SERVICE_BACKEND_TOKEN` (required for notification ingest/sync)
- `DEVSUITE_CONVEX_SITE_URL` (required for notification ingest/sync)
- `DEVSUITE_GH_SERVICE_NOTIFICATION_POLL_INTERVAL_MS` (optional; default `60000` in `development`, `300000` in `production`)

## Running

```bash
pnpm --filter @devsuite/gh-service dev
```

## Railway Deployment (Dockerfile)

The service requires the GitHub CLI (`gh`) binary. Use the included Dockerfile:

1. In Railway, set **Dockerfile Path** to `apps/gh-service/Dockerfile`
2. Keep **Root Directory** as the repo root (or unset) so the build context includes workspace files
3. Deploy — the image installs `gh` and builds the service

Rotate stored encrypted tokens to the active key version:

```bash
pnpm --filter @devsuite/gh-service rotate:keys
```

The service auto-loads env files from repo root (`.env`, `.env.local`) and app root
(`apps/gh-service/.env`, `apps/gh-service/.env.local`).

## Notes

`/github/connect/start` returns device code + verification URI from GitHub device flow.
`/github/connect/status` advances polling server-side and finalizes encrypted token storage
once GitHub authorization completes.

`/github/pr/discover` accepts `{ "repo": "owner/repo", "state": "open|closed|merged|all", "limit": 1-100 }`
and returns normalized PR metadata for the authenticated user.

`/github/pr/bundle-data` accepts
`{ "repo": "owner/repo", "number": 123, "includeChecks": true|false }`
and returns PR metadata + diff (+ optional checks) for the authenticated user.

`/github/notifications/sync` accepts optional `{ "limit": 1-100 }` and performs
an immediate fetch + route + ingest cycle for the authenticated user.

Sync telemetry (last attempt/success + counters) is persisted in Convex and can be
queried by the web app for status visibility.
