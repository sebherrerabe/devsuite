# Security Audit — Quick Reference

## Overview

Comprehensive security audit of DevSuite's environment configuration, secrets management, and deployment security. Full report: [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md)

---

## Key Findings

### 🟢 Strengths

- No secrets committed to git (`.gitignore` properly configured)
- Strong encryption (AES-256-GCM with authenticated encryption)
- Whitelist-based CORS (not overly permissive)
- Service token authentication on critical endpoints
- Production mode enforces secret presence

### 🔴 Critical Issues

| Issue                                      | Impact                                         | File                                  | Fix                                            |
| ------------------------------------------ | ---------------------------------------------- | ------------------------------------- | ---------------------------------------------- |
| Encryption keys lack complexity validation | Weak key could compromise all encrypted tokens | `apps/gh-service/src/config.ts`       | Add generation docs: `openssl rand -base64 32` |
| No key rotation mechanism                  | Lost key = unrecoverable tokens                | `apps/gh-service/src/token-cipher.ts` | Add key versioning to cipher format            |
| BETTER_AUTH_SECRET has no min length       | Could be weak                                  | `convex/betterAuth/auth.ts`           | Add Zod validation: `min(32)`                  |

### 🟡 High Priority

| Issue                                                            | Impact                            | File                            | Fix                                          |
| ---------------------------------------------------------------- | --------------------------------- | ------------------------------- | -------------------------------------------- |
| Backend tokens optional in dev but missing production validation | Could be forgotten in production  | `apps/gh-service/src/config.ts` | Add production env check                     |
| CORS defaults allow localhost only                               | Good for dev, unclear for prod    | `apps/gh-service/src/server.ts` | Document explicit production config required |
| Host binds to 0.0.0.0                                            | Exposes service to all interfaces | `apps/gh-service/src/config.ts` | Document use of reverse proxy in production  |
| No rate limiting on auth failures                                | Brute force possible              | `apps/gh-service/src/auth.ts`   | Implement token-based rate limiting          |

---

## Environment Variables: Secret vs. Optional

### Required Secrets

| Variable                                 | Type   | Min Length                   | Generation                         |
| ---------------------------------------- | ------ | ---------------------------- | ---------------------------------- |
| `DEVSUITE_GH_SERVICE_ENCRYPTION_KEY`     | Base64 | 32 bytes (→ 44 chars base64) | `openssl rand -base64 32`          |
| `DEVSUITE_NOTION_SERVICE_ENCRYPTION_KEY` | Base64 | 32 bytes (→ 44 chars base64) | `openssl rand -base64 32`          |
| `BETTER_AUTH_SECRET`                     | String | 32+ chars (not enforced!) ⚠️ | `openssl rand -base64 24`          |
| `DEVSUITE_WEB_PUSH_VAPID_PRIVATE_KEY`    | Base64 | Per spec                     | `npx web-push generate-vapid-keys` |

### Optional Service Tokens (Required in Production)

| Variable                                | Type   | Min Length | Dev        | Prod                 |
| --------------------------------------- | ------ | ---------- | ---------- | -------------------- |
| `DEVSUITE_GH_SERVICE_TOKEN`             | String | 16 chars   | ✓ Optional | ✗ **Required**       |
| `DEVSUITE_NOTION_SERVICE_TOKEN`         | String | 16 chars   | ✓ Optional | ✗ **Required**       |
| `DEVSUITE_GH_SERVICE_BACKEND_TOKEN`     | String | 16 chars   | ✓ Optional | ✓ ⚠️ (no validation) |
| `DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN` | String | 16 chars   | ✓ Optional | ✓ ⚠️ (no validation) |

### CORS Configuration

| Service        | Default                 | Production          | Validation        |
| -------------- | ----------------------- | ------------------- | ----------------- |
| gh-service     | `http://localhost:5173` | Must set explicitly | Whitelist-based ✓ |
| notion-service | `http://localhost:5173` | Must set explicitly | Whitelist-based ✓ |
| Convex         | `SITE_URL` env var      | Must set explicitly | From SITE_URL ✓   |

---

## Encryption & Key Management

### Token Cipher (gh-service & notion-service)

```typescript
Algorithm: AES-256-GCM
IV: 12 bytes (96 bits) — NIST spec ✓
Key: 32 bytes (256 bits) — validated ✓
Format: v1:base64(iv):base64(authTag):base64(ciphertext)
Integrity: Auth tag verified on decrypt ✓
```

### Key Rotation

**Current**: No rotation mechanism
**Gap**: If key is lost/rotated, old encrypted tokens are unrecoverable

**Recommendation**: Add key versioning

```typescript
// Future format: v2:keyVersion:base64(iv):base64(authTag):base64(ciphertext)
// Allows keeping old key for decryption while using new key for encryption
```

---

## Service Authentication

### Service → Service (gh-service → Convex HTTP)

```
Bearer Token: DEVSUITE_GH_SERVICE_BACKEND_TOKEN
Location: Authorization: Bearer <token>
Validation: apps/gh-service/src/auth.ts (assertServiceAuth)
```

**Issue**: Optional in config but critical for production

- Dev mode: Token not required (allows local testing)
- Prod mode: Must be set but no startup validation

### Web → Service (React SPA → gh-service)

```
Bearer Token: DEVSUITE_GH_SERVICE_TOKEN (if set)
Location: Authorization: Bearer <token>
Validation: apps/gh-service/src/auth.ts
CORS: Whitelist-based on origin header
```

**Issue**: No rate limiting on failed auth attempts

---

## Deployment Checklist

### Before Production Deployment

- [ ] Generate all encryption keys: `openssl rand -base64 32`
- [ ] Generate service tokens (min 16 chars): `openssl rand -base64 12`
- [ ] Set BETTER_AUTH_SECRET (min 32 chars): `openssl rand -base64 24`
- [ ] Verify CORS origins don't include localhost
- [ ] Set persistent volume for `DEVSUITE_GH_SERVICE_DATA_DIR` and `DEVSUITE_NOTION_SERVICE_DATA_DIR`
- [ ] Restrict file permissions on persistent volume (0700)
- [ ] Use reverse proxy or internal networking for microservices
- [ ] Configure SITE_URL to production domain
- [ ] Test end-to-end token encryption/decryption

### Environment Variables to Set

**Railway (recommended for $5/mo)**:

```bash
# gh-service
NODE_ENV=production
DEVSUITE_GH_SERVICE_TOKEN=$(openssl rand -base64 12)
DEVSUITE_GH_SERVICE_ENCRYPTION_KEY=$(openssl rand -base64 32)
DEVSUITE_GH_SERVICE_BACKEND_TOKEN=$(openssl rand -base64 12)
DEVSUITE_GH_SERVICE_CORS_ORIGINS=https://your-domain.com
DEVSUITE_CONVEX_SITE_URL=https://<deployment>.convex.site

# notion-service
NODE_ENV=production
DEVSUITE_NOTION_SERVICE_TOKEN=$(openssl rand -base64 12)
DEVSUITE_NOTION_SERVICE_ENCRYPTION_KEY=$(openssl rand -base64 32)
DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN=$(openssl rand -base64 12)
DEVSUITE_NOTION_SERVICE_CORS_ORIGINS=https://your-domain.com
DEVSUITE_CONVEX_SITE_URL=https://<deployment>.convex.site

# Convex (via: npx convex env set KEY VALUE)
BETTER_AUTH_SECRET=$(openssl rand -base64 24)
SITE_URL=https://your-domain.com
DEVSUITE_GH_SERVICE_BACKEND_TOKEN=<same as above>
DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN=<same as above>
DEVSUITE_WEB_PUSH_VAPID_PUBLIC_KEY=<from npx web-push generate-vapid-keys>
DEVSUITE_WEB_PUSH_VAPID_PRIVATE_KEY=<from npx web-push generate-vapid-keys>
```

---

## Validation Tests

### Test Secret Generation

```bash
# Encryption keys (32 bytes)
KEY=$(openssl rand -base64 32)
echo "$KEY" | base64 -d | wc -c  # Should output: 33 (includes newline)

# Service tokens (16+ chars)
TOKEN=$(openssl rand -base64 12)
echo -n "$TOKEN" | wc -c  # Should be ≥16

# BETTER_AUTH_SECRET (32+ chars)
SECRET=$(openssl rand -base64 24)
echo -n "$SECRET" | wc -c  # Should be ≥32
```

### Test Token Encryption/Decryption

```typescript
// In gh-service codebase
import { TokenCipher } from './apps/gh-service/src/token-cipher';

const cipher = TokenCipher.fromBase64(
  process.env.DEVSUITE_GH_SERVICE_ENCRYPTION_KEY!
);
const encrypted = cipher.encrypt('github_token_12345');
const decrypted = cipher.decrypt(encrypted);
console.assert(decrypted === 'github_token_12345'); // ✓
```

### Test CORS Validation

```bash
# From browser console on another origin
curl -X OPTIONS http://localhost:8790/health \
  -H "Origin: http://evil.com"
# Should NOT include: Access-Control-Allow-Origin

curl -X OPTIONS http://localhost:8790/health \
  -H "Origin: http://localhost:5173"
# Should include: Access-Control-Allow-Origin: http://localhost:5173
```

---

## Risk Matrix

| Issue                           | Severity  | Likelihood | Impact            | Mitigation                    |
| ------------------------------- | --------- | ---------- | ----------------- | ----------------------------- |
| Weak encryption key             | 🔴 High   | 🟠 Medium  | Total compromise  | Enforce key generation method |
| Lost encryption key             | 🔴 High   | 🟠 Medium  | All tokens lost   | Implement key versioning      |
| Weak BETTER_AUTH_SECRET         | 🟡 Medium | 🟠 Medium  | Session hijacking | Add validation min(32)        |
| Forgotten service token in prod | 🟡 Medium | 🟠 High    | Service exposed   | Add startup validation        |
| CORS misconfiguration           | 🟡 Medium | 🟠 Low     | CSRF possible     | Document production setup     |
| Brute force auth                | 🟠 Low    | 🟠 Medium  | Token guessing    | Implement rate limiting       |

---

## Related Documents

- [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md) — Full audit report
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Platform comparison and migration checklist
- [`.env.example`](./.env.example) — Environment variables reference

---

**Audit Date**: 2026-02-20  
**Scope**: Environment configuration, secrets management, encryption, deployment  
**Status**: 3 Critical + 4 High priority issues identified
