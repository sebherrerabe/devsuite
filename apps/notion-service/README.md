# DevSuite Notion Service

Node.js service for Notion integration workflows.

## Current Scope

- Service health endpoint
- Request auth boundary (`Authorization: Bearer` + `x-devsuite-user-id`)
- Browser-first Notion OAuth endpoints:
  - `POST /notion/connect/start`
  - `GET /notion/connect/status`
  - `POST /notion/disconnect`
  - `GET /notion/connect/callback`
- Notion task-link validation endpoint:
  - `POST /notion/links/resolve`
- Notion webhook ingest endpoint:
  - `POST /notion/webhooks`
- Server-managed Notion OAuth with per-user-per-company state
- Token introspection + refresh handling for long-lived sessions
- Encrypted Notion token persistence (AES-256-GCM)

## Environment Variables

- `DEVSUITE_NOTION_SERVICE_HOST` (default: `0.0.0.0`)
- `DEVSUITE_NOTION_SERVICE_PORT` (default: `8791`)
- `DEVSUITE_NOTION_SERVICE_TOKEN` (optional in dev, required in production)
- `DEVSUITE_NOTION_SERVICE_CORS_ORIGINS` (CSV, default: `http://localhost:5173`)
- `DEVSUITE_NOTION_SERVICE_DATA_DIR` (default: `~/.devsuite/notion-service`)
- `DEVSUITE_NOTION_SERVICE_ENCRYPTION_KEY` (required, base64 32-byte key)
- `DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN` (required for Convex upsert/clear routes)
- `DEVSUITE_NOTION_OAUTH_CLIENT_ID` (required)
- `DEVSUITE_NOTION_OAUTH_CLIENT_SECRET` (required)
- `DEVSUITE_NOTION_OAUTH_REDIRECT_URI` (required; e.g., `http://localhost:8791/notion/connect/callback`)
- `DEVSUITE_NOTION_POST_AUTH_REDIRECT_URL` (optional; defaults to first CORS origin + `/_app/settings/integrations`)
- `DEVSUITE_NOTION_WEBHOOK_VERIFICATION_TOKEN` (optional but recommended; validates `x-notion-signature` HMAC SHA-256 over the raw JSON body)
- `DEVSUITE_CONVEX_SITE_URL` (required for Convex backend calls)

Webhook setup note: Notion sends a one-time `verification_token` in the request body when a subscription is created. Save that token as `DEVSUITE_NOTION_WEBHOOK_VERIFICATION_TOKEN` to enable signature verification for subsequent deliveries.

## Running

```bash
pnpm --filter @devsuite/notion-service dev
```

The service auto-loads env files from repo root (`.env`, `.env.local`) and app root
(`apps/notion-service/.env`, `apps/notion-service/.env.local`).
