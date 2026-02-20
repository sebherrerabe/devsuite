# DevSuite Notion Service

Node.js service for Notion integration workflows.

## Current Scope

- Service health endpoint
- Request auth boundary (`Authorization: Bearer` + `x-devsuite-user-id`)
- Optional signed user token auth (`x-devsuite-user-token`) when
  `DEVSUITE_NOTION_SERVICE_USER_TOKEN_SECRET` is configured
- Browser-first Notion OAuth endpoints:
  - `POST /notion/connect/start`
  - `GET /notion/connect/status`
  - `POST /notion/disconnect`
  - `GET /notion/connect/callback`
- Notion task-link validation endpoint:
  - `POST /notion/links/resolve`
- Notion assignee-filter configuration endpoints:
  - `POST /notion/webhooks/assignee/options`
  - `POST /notion/webhooks/assignee/config`
- Notion webhook ingest endpoint:
  - `POST /notion/webhooks`
- Webhook notifications are emitted only for page events assigned to the connected Notion user (across all people properties by default, or a configured specific people property per company)
- Server-managed Notion OAuth with per-user-per-company state
- Token introspection + refresh handling for long-lived sessions
- Encrypted Notion token persistence (AES-256-GCM)

## Environment Variables

- `DEVSUITE_NOTION_SERVICE_HOST` (default: `0.0.0.0`)
- `DEVSUITE_NOTION_SERVICE_PORT` (default: `8791`)
- `DEVSUITE_NOTION_SERVICE_TOKEN` (required in non-development environments)
- `DEVSUITE_NOTION_SERVICE_USER_TOKEN_SECRET` (optional; enables signed user-token auth)
- `DEVSUITE_NOTION_SERVICE_CORS_ORIGINS` (CSV, default: `http://localhost:5173`)
- `DEVSUITE_NOTION_SERVICE_DATA_DIR` (default: `~/.devsuite/notion-service`)
- `DEVSUITE_NOTION_SERVICE_ENCRYPTION_KEY` (required, base64 32-byte key)
- `DEVSUITE_NOTION_SERVICE_ENCRYPTION_KEY_VERSION` (optional; default `v1`)
- `DEVSUITE_NOTION_SERVICE_ENCRYPTION_LEGACY_KEYS` (optional JSON map for key rotation)
- `DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN` (required for Convex upsert/clear routes)
- `DEVSUITE_NOTION_OAUTH_CLIENT_ID` (required)
- `DEVSUITE_NOTION_OAUTH_CLIENT_SECRET` (required)
- `DEVSUITE_NOTION_OAUTH_REDIRECT_URI` (required; e.g., `http://localhost:8791/notion/connect/callback`)
- `DEVSUITE_NOTION_POST_AUTH_REDIRECT_URL` (optional; defaults to first CORS origin + `/settings/integrations`)
- `DEVSUITE_NOTION_WEBHOOK_VERIFICATION_TOKEN` (required in production; validates `x-notion-signature` HMAC SHA-256 over the raw JSON body)
- `DEVSUITE_CONVEX_SITE_URL` (required for Convex backend calls)

Webhook setup note: Notion sends a one-time `verification_token` in the request body when a subscription is created. Save that token as `DEVSUITE_NOTION_WEBHOOK_VERIFICATION_TOKEN` to enable signature verification for subsequent deliveries.

## Running

```bash
pnpm --filter @devsuite/notion-service dev
```

Rotate stored encrypted tokens to the active key version:

```bash
pnpm --filter @devsuite/notion-service rotate:keys
```

The service auto-loads env files from repo root (`.env`, `.env.local`) and app root
(`apps/notion-service/.env`, `apps/notion-service/.env.local`).
