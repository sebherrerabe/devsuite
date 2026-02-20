# DevSuite Security Audit Report

**Date**: 2026-02-20  
**Scope**: Environment configuration, secrets management, token handling, deployment security

---

## Executive Summary

Overall security posture is **GOOD** with several critical recommendations. The project:

✅ **Strengths**:

- No secrets committed to git
- Strong encryption (AES-256-GCM) for token storage
- Service token authentication on Convex HTTP ingestion routes
- Proper CORS validation on microservices
- Environment variable validation with Zod
- Production-mode secret enforcement

⚠️ **Areas of Concern**:

- Encryption keys have no rotation mechanism
- BETTER_AUTH_SECRET has no complexity requirements documented
- Weak default for MCP_TOKEN (optional, no min length spec)
- Backend tokens optional in development but missing validation
- CORS defaults allow localhost only (good) but production config needs automation
- No explicit HTTPS requirement documentation

🔴 **Critical**:

- DEVSUITE_GH_SERVICE_ENCRYPTION_KEY and DEVSUITE_NOTION_SERVICE_ENCRYPTION_KEY lack strength validation
- .env.example doesn't specify that encryption keys must be 32 bytes

---

## 1. Environment Variables (.env.example) Analysis

### 1.1 Secret vs. Non-Secret Classification

| Variable                                            | Type       | Secret? | Optional?      | Min Length   | Notes                        |
| --------------------------------------------------- | ---------- | ------- | -------------- | ------------ | ---------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`                            | Config     | No      | No             | -            | Public; safe to expose       |
| `CONVEX_DEPLOYMENT`                                 | Config     | No      | Yes            | -            | Deployment name              |
| `MCP_TOKEN`                                         | **Secret** | Yes     | Yes            | **None**     | ⚠️ No minimum length spec    |
| `DEVSUITE_GH_SERVICE_HOST`                          | Config     | No      | Yes            | -            | Defaults to 0.0.0.0          |
| `DEVSUITE_GH_SERVICE_PORT`                          | Config     | No      | Yes            | -            | Defaults to 8790             |
| `DEVSUITE_GH_SERVICE_TOKEN`                         | **Secret** | Yes     | Yes            | **16 bytes** | ✅ Enforced in config        |
| `DEVSUITE_GH_SERVICE_CORS_ORIGINS`                  | Config     | No      | No             | -            | ✅ Defaults to localhost     |
| `DEVSUITE_GH_SERVICE_DATA_DIR`                      | Config     | No      | Yes            | -            | Stores encrypted tokens      |
| `DEVSUITE_GH_SERVICE_ENCRYPTION_KEY`                | **Secret** | Yes     | No             | **32 bytes** | ⚠️ No complexity check       |
| `DEVSUITE_GH_OAUTH_CLIENT_ID`                       | **Secret** | Yes     | No             | -            | ✅ Has default (GitHub CLI)  |
| `DEVSUITE_GH_OAUTH_SCOPES`                          | Config     | No      | No             | -            | ✅ Reasonable defaults       |
| `DEVSUITE_GH_SERVICE_NOTIFICATION_POLL_ENABLED`     | Config     | No      | Yes            | -            | ✅ Defaults to true          |
| `DEVSUITE_GH_SERVICE_NOTIFICATION_POLL_INTERVAL_MS` | Config     | No      | Yes            | -            | ✅ Min 10000ms enforced      |
| `DEVSUITE_GH_SERVICE_NOTIFICATION_BATCH_SIZE`       | Config     | No      | Yes            | -            | ✅ Min 1, max 100 enforced   |
| `DEVSUITE_GH_SERVICE_BACKEND_TOKEN`                 | **Secret** | Yes     | Yes            | **16 bytes** | ✅ Enforced in config        |
| `DEVSUITE_CONVEX_SITE_URL`                          | Config     | No      | Yes            | -            | Backend URL for ingestion    |
| `DEVSUITE_NOTION_SERVICE_TOKEN`                     | **Secret** | Yes     | Yes            | **16 bytes** | ✅ Enforced in config        |
| `DEVSUITE_NOTION_SERVICE_ENCRYPTION_KEY`            | **Secret** | Yes     | No             | **32 bytes** | ⚠️ No complexity check       |
| `DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN`             | **Secret** | Yes     | Yes            | **16 bytes** | ✅ Enforced in config        |
| `DEVSUITE_NOTION_OAUTH_CLIENT_ID`                   | **Secret** | Yes     | Yes            | -            | ⚠️ No min length             |
| `DEVSUITE_NOTION_OAUTH_CLIENT_SECRET`               | **Secret** | Yes     | Yes            | -            | ⚠️ No min length             |
| `DEVSUITE_NOTION_OAUTH_REDIRECT_URI`                | Config     | No      | Yes            | -            | Must match Notion OAuth      |
| `DEVSUITE_NOTION_POST_AUTH_REDIRECT_URL`            | Config     | No      | Yes            | -            | Frontend redirect            |
| `DEVSUITE_NOTION_WEBHOOK_VERIFICATION_TOKEN`        | **Secret** | Yes     | Yes            | -            | ⚠️ No min length             |
| `BETTER_AUTH_SECRET`                                | **Secret** | Yes     | No (in Convex) | -            | ⚠️ No min length requirement |
| `SITE_URL`                                          | Config     | No      | No (in Convex) | -            | Public URL of app            |
| `DEVSUITE_WEB_PUSH_VAPID_PUBLIC_KEY`                | **Secret** | Yes     | No             | -            | ✅ Per Web Push spec         |
| `DEVSUITE_WEB_PUSH_VAPID_PRIVATE_KEY`               | **Secret** | Yes     | No             | -            | ✅ Per Web Push spec         |
| `DEVSUITE_WEB_PUSH_VAPID_SUBJECT`                   | Config     | No      | No             | -            | Contact URL/email            |

### 1.2 Findings

**CRITICAL ISSUES**:

1. **Encryption key strength not validated**
   - `DEVSUITE_GH_SERVICE_ENCRYPTION_KEY` and `DEVSUITE_NOTION_SERVICE_ENCRYPTION_KEY` require exactly 32 bytes (256 bits)
   - Code validates length but NOT complexity/entropy
   - `.env.example` doesn't clarify 32-byte requirement
   - **Recommendation**: Document that keys must be generated with `openssl rand -base64 32` (already in comments but could be stronger)

2. **BETTER_AUTH_SECRET lacks documentation**
   - Comments say "32+ character string" but no validation enforces it
   - Code: `secret: process.env.BETTER_AUTH_SECRET!` with no validation
   - **Recommendation**: Add Zod validation to Convex env schema for BETTER_AUTH_SECRET (min 32 chars)

3. **MCP_TOKEN has no specification**
   - Listed as "Static token for securing MCP server access"
   - Optional with no min length requirement
   - **Recommendation**: Either make it required in production or enforce `min(16)` in validation

4. **Notion OAuth secrets lack minimum length**
   - `DEVSUITE_NOTION_OAUTH_CLIENT_ID`, `DEVSUITE_NOTION_OAUTH_CLIENT_SECRET`, `DEVSUITE_NOTION_WEBHOOK_VERIFICATION_TOKEN`
   - No minimum length enforced in Zod schemas
   - **Recommendation**: Add `.min(1)` at minimum for client ID/secret

---

## 2. Secret Handling & Encryption

### 2.1 Token Cipher Implementation

**File**: `apps/gh-service/src/token-cipher.ts` and `apps/notion-service/src/token-cipher.ts`

**Strengths** ✅:

- Algorithm: **AES-256-GCM** (authenticated encryption) - excellent choice
- IV: **12 bytes (96 bits)** - per NIST spec for GCM
- Auth tag: Included for integrity verification
- No hardcoded keys; loaded from environment

**Findings**:

- ✅ Encryption key validation: exactly 32 bytes required
- ✅ Decryption validates auth tag (will throw if tampered)
- ✅ Version prefix allows future algorithm migration
- ⚠️ **No key rotation mechanism**: encrypted tokens remain valid if key is rotated
- ⚠️ **No timestamp in payload**: cannot detect old tokens

### 2.2 Token Storage & Rotation

**Issue**: There is **no key rotation strategy documented**.

Current state:

- Tokens are encrypted with `DEVSUITE_GH_SERVICE_ENCRYPTION_KEY` at rest
- If key is rotated in production, old encrypted tokens become **unrecoverable**
- No mechanism to re-encrypt tokens with new key

**Recommendation**:

```typescript
// Add optional key versioning to enable rotation:
// Format: v1:keyVersion:iv:authTag:ciphertext
// - keyVersion = which key version encrypted this token
// - On key rotation, keep old key for decryption, use new key for encryption
// - Periodically re-encrypt all stored tokens with latest key
```

---

## 3. Service Token & Backend Token Authentication

### 3.1 gh-service & notion-service Token Handling

**Config validation** (`apps/gh-service/src/config.ts` lines 64-66):

```typescript
if (parsed.NODE_ENV === 'production' && !parsed.DEVSUITE_GH_SERVICE_TOKEN) {
  throw new Error('Missing DEVSUITE_GH_SERVICE_TOKEN in production');
}
```

✅ **Good**: Required in production, optional in dev

**Auth middleware** (`apps/gh-service/src/auth.ts` lines 43-55):

```typescript
function assertServiceAuth(req, config) {
  if (!config.serviceToken) {
    return; // Skip auth if token not set (dev mode)
  }
  const token = parseBearerToken(req);
  if (!token || token !== config.serviceToken) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid service token');
  }
}
```

✅ **Good**: Allows development without token
⚠️ **Issue**: No rate limiting on failed auth attempts

### 3.2 Convex Backend Token Validation

**File**: `convex/http.ts` lines 41-79

```typescript
function authorizeGhServiceRequest(request) {
  const expectedToken = process.env[GH_SERVICE_BACKEND_TOKEN_ENV];
  if (!expectedToken) {
    return jsonResponse(503, {
      error: 'GitHub service backend token is not configured',
    });
  }
  const actualToken = readBearerToken(request);
  if (!actualToken || actualToken !== expectedToken) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }
  return null;
}
```

✅ **Good**: Bearer token validation
✅ **Good**: 503 if not configured (explicit failure)
⚠️ **Issue**: These tokens are optional (`optional()` in config)

- Can lead to bypass if forgotten
- Production deployments must set these

---

## 4. CORS Configuration

### 4.1 gh-service CORS

**Implementation** (`apps/gh-service/src/server.ts` lines 91-112):

```typescript
function setCorsHeaders(req, res, config) {
  const origin = normalizeOriginHeader(req.headers.origin);
  if (!origin) {
    return; // No CORS headers if no origin
  }
  if (!config.corsOrigins.includes(origin)) {
    return; // No CORS headers if origin not in allowlist
  }
  res.setHeader('access-control-allow-origin', origin);
  res.setHeader(
    'access-control-allow-headers',
    'authorization, content-type, x-devsuite-user-id'
  );
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('vary', 'Origin');
}
```

✅ **Good**: Whitelist-based (not `*`)
✅ **Good**: Default to `http://localhost:5173` (local dev)
✅ **Good**: `Vary: Origin` header prevents cache issues

**Default** (`apps/gh-service/src/config.ts` line 12):

```typescript
DEVSUITE_GH_SERVICE_CORS_ORIGINS: z.string().default('http://localhost:5173'),
```

⚠️ **Issue in production**: Default only allows localhost

- **Good**: Fails safe (must explicitly configure production origin)
- **Bad**: Easy to forget in Railway/Fly.io deployment
- **Recommendation**: Add validation that production CORS origins don't include localhost

### 4.2 Convex CORS

**Implementation** (`convex/http.ts` line 13):

```typescript
authComponent.registerRoutes(http, createAuth, { cors: true });
```

✅ **Good**: Better Auth handles CORS correctly for SPA
✅ **Good**: Uses `crossDomain` plugin with SITE_URL

**trustedOrigins** (`convex/betterAuth/auth.ts` line 28):

```typescript
trustedOrigins: [siteUrl],
```

✅ **Good**: Single trusted origin from `SITE_URL` env var

---

## 5. Deployment Configuration

### 5.1 Deployment.md Analysis

**Strengths**:

- ✅ Comprehensive platform comparison (Vercel, Railway, Fly.io, Hetzner, etc.)
- ✅ Addresses webhook reliability requirement
- ✅ Identifies always-on Node.js services need
- ✅ Migration checklist includes env var setup

**Findings**:

1. **Railway deployment** (recommended):
   - Service tokens must be set per checklist
   - Environment variables stored in Railway dashboard (encrypted at rest)
   - ✅ No local `.env` files in production

2. **HTTPS/SSL**:
   - ✅ Railway provides auto-SSL for services
   - ✅ Cloudflare Pages provides auto-SSL for web SPA
   - ✅ Convex provides auto-SSL for backend

3. **Secret rotation considerations**:
   - Encryption keys (`DEVSUITE_GH_SERVICE_ENCRYPTION_KEY`, etc.) are not rotatable without data migration
   - Service tokens (`DEVSUITE_GH_SERVICE_TOKEN`) can be rotated without impact (ephemeral auth)
   - Backend tokens can be rotated by updating both Convex and service environments

---

## 6. Network Exposure & Security

### 6.1 Host Binding

**gh-service** (`apps/gh-service/src/config.ts` line 9):

```typescript
DEVSUITE_GH_SERVICE_HOST: z.string().default('0.0.0.0'),
```

⚠️ **Issue in production**:

- Default `0.0.0.0` means "bind to all network interfaces"
- In Railway/Fly.io, this exposes service to the internet
- **Recommendation**: Document that production should use specific port binding or reverse proxy auth

Similarly for **notion-service** (`apps/notion-service/src/config.ts` line 9):

```typescript
DEVSUITE_NOTION_SERVICE_HOST: z.string().default('0.0.0.0'),
```

### 6.2 Network Access Control

**Current Model**:

- CORS handles browser cross-origin requests
- Bearer token auth handles service-to-service calls
- No network-level access control (firewall rules)

**Recommendation for Railway deployment**:

- Use Railway's private networking to keep gh-service and notion-service internal
- Only expose web SPA to public

---

## 7. Convex Environment Variables

### 7.1 Backend Secrets

Secrets managed via `npx convex env set`:

| Variable                                | Type       | Criticality | Rotation                            |
| --------------------------------------- | ---------- | ----------- | ----------------------------------- |
| `BETTER_AUTH_SECRET`                    | **Secret** | 🔴 Critical | 🟡 Requires user re-auth            |
| `SITE_URL`                              | Config     | 🟢 Low      | No impact                           |
| `DEVSUITE_GH_SERVICE_BACKEND_TOKEN`     | **Secret** | 🟡 High     | ✅ Can be rotated freely            |
| `DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN` | **Secret** | 🟡 High     | ✅ Can be rotated freely            |
| `DEVSUITE_WEB_PUSH_VAPID_PRIVATE_KEY`   | **Secret** | 🟡 High     | 🟡 Requires browser re-subscription |

### 7.2 BETTER_AUTH_SECRET Strength

**Current state**:

- No validation on minimum length
- Comments say "32+ character string"
- Generated with `openssl rand -base64 32` per documentation

**Recommendation**:

```typescript
// Add to Convex auth setup validation:
if (process.env.BETTER_AUTH_SECRET?.length! < 32) {
  throw new Error('BETTER_AUTH_SECRET must be at least 32 characters');
}
```

---

## 8. GitHub OAuth Configuration

### 8.1 Default OAuth App

**File**: `.env.example` lines 67

```
DEVSUITE_GH_OAUTH_CLIENT_ID=178c6fc778ccc68e1d6a
```

✅ **Good**: Uses GitHub CLI's public OAuth app (no secret needed for device flow)
✅ **Good**: Scopes are reasonable: `repo,read:org,gist,notifications`

⚠️ **Note**: This is a public client ID, so it's safe to expose

### 8.2 Notion OAuth Configuration

**File**: `.env.example` lines 119-126

```
DEVSUITE_NOTION_OAUTH_CLIENT_ID=
DEVSUITE_NOTION_OAUTH_CLIENT_SECRET=
DEVSUITE_NOTION_OAUTH_REDIRECT_URI=
DEVSUITE_NOTION_POST_AUTH_REDIRECT_URL=
```

✅ **Good**: No defaults (must configure)
⚠️ **Issue**: No validation that redirect URIs match between Notion and app

**Recommendation**:

```typescript
// Add validation that redirect URIs are consistent
if (!DEVSUITE_NOTION_OAUTH_REDIRECT_URI?.includes(':8791')) {
  console.warn('Notion redirect URI should use notion-service port 8791');
}
```

---

## 9. Data Directory & Persistent Storage

### 9.1 Token Storage Location

**gh-service**: `apps/gh-service/src/config.ts` lines 79-81

```typescript
const dataDir =
  parsed.DEVSUITE_GH_SERVICE_DATA_DIR ??
  path.join(os.homedir(), '.devsuite', 'gh-service');
```

✅ **Good**: User home directory with `.devsuite` namespace
✅ **Good**: Tokens are encrypted before storing to disk

**Potential issue in containers/serverless**:

- If running in Railway/Fly.io, `os.homedir()` may be `/root/.devsuite/gh-service`
- **Recommendation**: Set `DEVSUITE_GH_SERVICE_DATA_DIR` to persistent volume mount in production

### 9.2 File Permissions

**Note**: No explicit file permission restrictions found in code

- Convex stores encrypted tokens in files
- **Recommendation**: Ensure persistent volume has restricted permissions (0700 at minimum)

---

## 10. MCP Server & Token Authentication

### 10.1 MCP_TOKEN

**File**: `.env.example` lines 39-40

```
# Static token for securing MCP server access.
# Only needed if running the MCP server or integrating with Claude/external AI.
MCP_TOKEN=
```

⚠️ **Issues**:

1. Optional with no specification
2. No minimum length requirement in `.env.example`
3. MCP runs locally via stdio, so token may not be necessary

**Recommendation**:

- If MCP is intended for production use, require min 32-char token
- Document that MCP tokens are stateless (unlike service tokens)

---

## Summary of Findings

### 🔴 CRITICAL (Fix Immediately)

1. **Encryption key complexity not validated**
   - Add documentation that `DEVSUITE_GH_SERVICE_ENCRYPTION_KEY` must be generated with `openssl rand -base64 32`
   - Consider adding runtime validation to warn if key entropy is too low

2. **No key rotation mechanism**
   - Encrypted tokens cannot be recovered if key is lost
   - Add key versioning to token cipher for future rotation support

3. **Backend tokens optional but critical in production**
   - Add production validation that `DEVSUITE_GH_SERVICE_BACKEND_TOKEN` is set in prod

### 🟡 HIGH (Fix Before Production Deployment)

1. **BETTER_AUTH_SECRET lacks validation**
   - Add Zod validation: `z.string().min(32)`
   - Document in Convex env setup

2. **CORS defaults allow localhost only**
   - Good for dev, but production must explicitly set origins
   - Add validation that production config doesn't include localhost

3. **Default host binding `0.0.0.0`**
   - Document that production should use reverse proxy or internal networking
   - For Railway: use private networking between services

4. **No rate limiting on token auth failures**
   - Brute force attack possible on 16-char tokens
   - Recommend implementing token-based rate limiting

### 🟢 GOOD (Monitor)

1. ✅ No secrets committed to git (`.gitignore` includes `.env*`)
2. ✅ Encryption is strong (AES-256-GCM)
3. ✅ Service token validation is correct
4. ✅ CORS whitelist-based (not `*`)
5. ✅ Production secret enforcement enforced at startup

---

## Recommendations Priority

### Phase 1: Immediate (Before Production)

- [ ] Add BETTER_AUTH_SECRET validation to Convex (min 32 chars)
- [ ] Document encryption key generation in README
- [ ] Add production validation that backend tokens are set
- [ ] Add CORS origin validation (warn if localhost in production)
- [ ] Document persistent volume requirements for Railway/Fly.io

### Phase 2: Short Term (Within 2 sprints)

- [ ] Implement key versioning in TokenCipher for future rotation
- [ ] Add rate limiting to token auth endpoints
- [ ] Add Zod validation for Notion OAuth secrets (min 1 char)
- [ ] Document host binding recommendations for reverse proxy

### Phase 3: Medium Term (Next Quarter)

- [ ] Implement key rotation CLI tool
- [ ] Add telemetry for failed auth attempts
- [ ] Add security headers (HSTS, CSP, etc.) to web SPA
- [ ] Implement token expiration/invalidation mechanism

### Phase 4: Long Term (Roadmap)

- [ ] Move to secrets manager (AWS Secrets Manager, Vault, etc.)
- [ ] Implement certificate pinning for service-to-service calls
- [ ] Add cryptographic signatures to webhooks
- [ ] Implement audit logging for all token access

---

## Testing Recommendations

### Token Generation

```bash
# Generate service tokens (16+ chars)
openssl rand -base64 12  # 16 chars

# Generate encryption keys (32 bytes = 256 bits)
openssl rand -base64 32

# Generate BETTER_AUTH_SECRET (32+ chars)
openssl rand -base64 24

# Generate VAPID keys
npx web-push generate-vapid-keys
```

### Validation Checklist

- [ ] All encryption keys are exactly 32 bytes
- [ ] All service tokens are at least 16 characters
- [ ] CORS origins don't include localhost in production
- [ ] BETTER_AUTH_SECRET is at least 32 characters
- [ ] Backend tokens match between Convex and services
- [ ] No `.env` or `.env.local` files in deployed containers
- [ ] Persistent volume has restricted permissions (0700)

---

## Conclusion

DevSuite has a **solid security foundation**. The main gaps are:

1. **Lack of documentation** on secret strength requirements
2. **No key rotation strategy** for encryption keys
3. **Missing production validation** for optional-in-dev secrets

Implementing the Phase 1 recommendations will significantly harden the production deployment.

**Estimated effort**: 4-6 hours to implement all Critical + High items.
