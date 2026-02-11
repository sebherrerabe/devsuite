# DevSuite GitHub Service

Node.js service for GitHub integration workflows.

## Current Scope

- Service health and readiness endpoints
- Request auth boundary (`Authorization: Bearer` + `x-devsuite-user-id`)
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
- `DEVSUITE_GH_SERVICE_TOKEN` (optional in dev, required in production)
- `DEVSUITE_GH_SERVICE_CORS_ORIGINS` (CSV, default: `http://localhost:5173`)
- `DEVSUITE_GH_SERVICE_DATA_DIR` (default: `~/.devsuite/gh-service`)
- `DEVSUITE_GH_SERVICE_ENCRYPTION_KEY` (required, base64 32-byte key)
- `DEVSUITE_GH_OAUTH_CLIENT_ID` (default: GitHub CLI OAuth app id)
- `DEVSUITE_GH_OAUTH_SCOPES` (default: `repo,read:org,gist,notifications`)
- `DEVSUITE_GH_SERVICE_BACKEND_TOKEN` (required for notification ingest/sync)
- `DEVSUITE_CONVEX_SITE_URL` (required for notification ingest/sync)
- `DEVSUITE_GH_SERVICE_NOTIFICATION_POLL_INTERVAL_MS` (optional; default `60000` in `development`, `300000` in `production`)

## Running

```bash
pnpm --filter @devsuite/gh-service dev
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
