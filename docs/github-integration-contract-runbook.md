# GitHub Integration Contract and Runbook

## Scope

This document finalizes the v1 contract for DevSuite GitHub integration:

- Browser-first user auth via `gh-service`
- Per-user isolated GitHub operations
- Company-scoped notification routing into Convex inbox
- MCP PR discovery through `gh-service`

## Public API Contract (`gh-service`)

All routes use `x-devsuite-user-id`.  
When `DEVSUITE_GH_SERVICE_TOKEN` is configured, routes also require `Authorization: Bearer <token>`.

- `GET /health`
  - Service liveness.
- `GET /ready`
  - Runtime readiness (`gh` installed, version, backend config signal).
- `POST /github/connect/start`
  - Starts GitHub device flow and returns verification URI + user code.
- `GET /github/connect/status`
  - Returns connection state (`disconnected|pending|connected|error`) and runtime info.
- `POST /github/disconnect`
  - Clears local encrypted credentials and marks user disconnected.
- `POST /github/pr/discover`
  - Input: `{ repo, state, limit }`
  - Output: normalized PR list for authenticated user.
- `POST /github/pr/bundle-data`
  - Input: `{ repo, number, includeChecks }`
  - Output: PR metadata + diff + optional checks.
- `POST /github/notifications/sync`
  - Input: optional `{ limit }`
  - Output: sync telemetry counters for this attempt.

## Backend Contract (`gh-service` -> Convex HTTP)

Routes are protected by `Authorization: Bearer ${DEVSUITE_GH_SERVICE_BACKEND_TOKEN}`.

- `POST /github/service/company-routes`
  - Input: `{ userId }`
  - Output: company routing entries with `githubOrgLogins`.
- `POST /github/service/ingest-notifications`
  - Input: `{ userId, notifications[] }`
  - Output: ingest counters.
- `POST /github/service/sync-telemetry`
  - Input: `{ userId, telemetry }`
  - Output: persisted telemetry id.

## Authorization Matrix

- Web UI -> `gh-service`
  - User identity: `x-devsuite-user-id` from Better Auth session.
  - Optional service token gate for deployment hardening.
- `gh-service` -> Convex HTTP routes
  - Backend bearer token (`DEVSUITE_GH_SERVICE_BACKEND_TOKEN`) must match on both sides.
- Web UI -> Convex data
  - Standard Convex auth and company ownership checks.
- MCP -> `gh-service`
  - MCP passes user-scoped `userId`; `gh-service` executes with user-scoped credentials.

## Routing and Idempotency Rules

- Notification routing is company-scoped.
- Route sources:
  - Company metadata `githubOrgLogins`
  - GitHub repository owners derived from company GitHub repository URLs
- Unknown org notifications are ignored.
- Ingest is insert-only by `(companyId, source=github, threadId)`:
  - Once registered, the same external thread is never re-registered.

## Sync Telemetry Contract

Telemetry is persisted per user in Convex (`githubNotificationSyncStatus`) with:

- Last attempt timestamp
- Last success timestamp
- Status (`success|skipped_no_routes|error`)
- Routing and ingest counters
- Error code/message when applicable

## Threat Model and Mitigations

### Threat: Token leakage

- Mitigations:
  - Tokens encrypted at rest (`AES-256-GCM`).
  - Tokens never returned to UI.
  - Log sanitization masks token-like values and device codes.

### Threat: Cross-user credential confusion

- Mitigations:
  - User id required on every request.
  - Credentials loaded by user id only.
  - Command audit logs include masked actor + command class + outcome.

### Threat: Unauthorized backend ingestion

- Mitigations:
  - Convex HTTP ingestion routes require backend bearer token.
  - Missing/mismatched token returns `503`/`401`.

### Threat: Notification duplication/revival

- Mitigations:
  - Insert-only external thread registration in Convex.
  - Existing thread ids are skipped, including archived items.

## Operational Defaults

- Poll interval defaults:
  - Development: 60 seconds
  - Production: 5 minutes
- Configurable via `DEVSUITE_GH_SERVICE_NOTIFICATION_POLL_INTERVAL_MS`.

## Incident Runbook

### Token revoked / auth broken

1. UI shows disconnected/token-invalid state.
2. User reconnects via device flow.
3. Validate with `GET /github/connect/status`.

### Backend token mismatch

1. `notifications/sync` returns unauthorized/backend-configured errors.
2. Set identical `DEVSUITE_GH_SERVICE_BACKEND_TOKEN` in:
   - gh-service env
   - Convex env
3. Restart gh-service and Convex dev/prod runtime.

### Rate limiting / `slow_down`

1. Respect cooldown in UI.
2. Retry after cooldown; avoid repeated restart loops.
3. If persistent, increase poll interval.

### Service restart

1. Restart `gh-service`.
2. Verify `GET /ready`.
3. Run manual `POST /github/notifications/sync` and check Inbox updates.

## Rollout Checklist

- `gh-service` deployed with `gh` installed.
- Encryption key set (`DEVSUITE_GH_SERVICE_ENCRYPTION_KEY`).
- Backend token configured on both gh-service and Convex.
- Convex site URL set in gh-service (`DEVSUITE_CONVEX_SITE_URL`).
- At least one company route source configured (org mapping and/or GitHub repositories).
- Manual smoke pass:
  - Connect
  - Sync notifications
  - Confirm inbox updates
  - Verify no duplicate re-registration after archive
