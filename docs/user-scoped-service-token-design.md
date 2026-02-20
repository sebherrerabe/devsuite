# User-Scoped Service Token Design

This document defines the user-scoped token format accepted by `gh-service` and
`notion-service` via the `x-devsuite-user-token` request header.

## Goal

Reduce trust in raw `x-devsuite-user-id` headers by requiring a signed,
short-lived token that binds a caller to a specific user identity.

## Token Format

`<payloadBase64Url>.<signatureBase64Url>`

- `payloadBase64Url`: base64url-encoded JSON:
  - `sub`: DevSuite user id
  - `exp`: expiration timestamp in Unix seconds
- `signatureBase64Url`: HMAC-SHA256 over the payload segment using:
  - `DEVSUITE_GH_SERVICE_USER_TOKEN_SECRET` (GH service)
  - `DEVSUITE_NOTION_SERVICE_USER_TOKEN_SECRET` (Notion service)

## Verification Behavior

When `*_USER_TOKEN_SECRET` is configured:

- Request must include `x-devsuite-user-token`
- Signature must match
- `exp` must be in the future
- `sub` becomes `AuthContext.userId`
- `x-devsuite-user-id` is ignored

When `*_USER_TOKEN_SECRET` is not configured:

- Service uses legacy `x-devsuite-user-id` behavior for compatibility.

## Rollout Plan

1. Configure `*_USER_TOKEN_SECRET` in staging.
2. Update MCP and backend callers to send `x-devsuite-user-token`.
3. Validate that service requests no longer rely on `x-devsuite-user-id`.
4. Configure in production and remove legacy header usage from callers.
