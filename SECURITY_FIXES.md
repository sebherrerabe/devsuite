# Security Fixes — Implementation Guide

## Actionable Changes to Address Critical & High-Priority Issues

This document contains specific code changes needed to resolve the security audit findings.

---

## 1. CRITICAL: Add BETTER_AUTH_SECRET Validation

### Issue

`BETTER_AUTH_SECRET` has no minimum length validation. Comments recommend 32+ chars, but code doesn't enforce it.

### Location

`convex/betterAuth/auth.ts`

### Current Code

```typescript
const siteUrl = process.env.SITE_URL!;

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
    appName: 'DevSuite',
    secret: process.env.BETTER_AUTH_SECRET!, // ❌ No validation
    trustedOrigins: [siteUrl],
    // ...
  };
};
```

### Required Fix

Add validation to ensure secret is strong:

```typescript
const siteUrl = process.env.SITE_URL!;

function validateBetterAuthSecret(secret: string | undefined): string {
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET environment variable is required');
  }
  if (secret.length < 32) {
    throw new Error(
      `BETTER_AUTH_SECRET must be at least 32 characters. Got ${secret.length} chars. ` +
        `Generate with: openssl rand -base64 24`
    );
  }
  return secret;
}

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
    appName: 'DevSuite',
    secret: validateBetterAuthSecret(process.env.BETTER_AUTH_SECRET),
    trustedOrigins: [siteUrl],
    // ...
  };
};
```

### Testing

```bash
# This should fail
export BETTER_AUTH_SECRET="short"
npx convex dev

# This should succeed
export BETTER_AUTH_SECRET=$(openssl rand -base64 24)
npx convex dev
```

---

## 2. CRITICAL: Enforce Backend Token in Production

### Issue

`DEVSUITE_GH_SERVICE_BACKEND_TOKEN` and `DEVSUITE_NOTION_SERVICE_BACKEND_TOKEN` are optional, but critical in production. Can be accidentally skipped.

### Location

`apps/gh-service/src/config.ts` and `apps/notion-service/src/config.ts`

### Current Code (gh-service)

```typescript
if (parsed.NODE_ENV === 'production' && !parsed.DEVSUITE_GH_SERVICE_TOKEN) {
  throw new Error('Missing DEVSUITE_GH_SERVICE_TOKEN in production');
}
// ❌ Missing check for DEVSUITE_GH_SERVICE_BACKEND_TOKEN
```

### Required Fix

```typescript
if (parsed.NODE_ENV === 'production' && !parsed.DEVSUITE_GH_SERVICE_TOKEN) {
  throw new Error('Missing DEVSUITE_GH_SERVICE_TOKEN in production');
}

if (
  parsed.NODE_ENV === 'production' &&
  parsed.DEVSUITE_CONVEX_SITE_URL &&
  !parsed.DEVSUITE_GH_SERVICE_BACKEND_TOKEN
) {
  throw new Error(
    'DEVSUITE_GH_SERVICE_BACKEND_TOKEN is required in production ' +
      'when DEVSUITE_CONVEX_SITE_URL is configured'
  );
}
```

### Apply to Both Files

- `apps/gh-service/src/config.ts` (after line 65)
- `apps/notion-service/src/config.ts` (after line 61)

---

## 3. CRITICAL: Document & Validate Encryption Key Generation

### Issue

Encryption keys must be exactly 32 bytes, but `.env.example` doesn't clearly explain the requirement.

### Location

`.env.example` and both `config.ts` files

### Current Code

```
# .env.example line 62
# Base64-encoded 32-byte key for encrypting GitHub tokens at rest.
# Generate with: openssl rand -base64 32
DEVSUITE_GH_SERVICE_ENCRYPTION_KEY=
```

✅ Already documented, but could be stronger

### Recommended Enhancement

**In `.env.example`**:

```
# Base64-encoded 32-byte encryption key (44 chars when base64-encoded).
# MUST be generated securely. Do not reuse or guess.
# Generate with:
#   openssl rand -base64 32
#
# Test that key is correct length:
#   echo "$DEVSUITE_GH_SERVICE_ENCRYPTION_KEY" | base64 -d | wc -c
#   (should output 33 = 32 bytes + newline)
DEVSUITE_GH_SERVICE_ENCRYPTION_KEY=
```

**In config.ts** - add stronger validation:

```typescript
export function loadConfig(
  rawEnv: Record<string, string | undefined> = process.env
): GhServiceConfig {
  const parsed = envSchema.parse(rawEnv);

  // Validate encryption key strength
  if (parsed.DEVSUITE_GH_SERVICE_ENCRYPTION_KEY.length < 40) {
    // Base64-encoded 32 bytes should be ~44 chars
    console.warn(
      'WARNING: DEVSUITE_GH_SERVICE_ENCRYPTION_KEY appears to be too short. ' +
        'Generate with: openssl rand -base64 32'
    );
  }

  // ... rest of validation
}
```

---

## 4. HIGH: Validate Encryption Key Decodes to 32 Bytes

### Issue

Current code only validates that key is >= 1 char. Should validate it's exactly 32 bytes when decoded.

### Location

`apps/gh-service/src/token-cipher.ts` (already good!)
`apps/notion-service/src/token-cipher.ts` (already good!)

### Current Code ✅

```typescript
static fromBase64(encodedKey: string): TokenCipher {
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'DEVSUITE_GH_SERVICE_ENCRYPTION_KEY must decode to exactly 32 bytes'
    );
  }
  return new TokenCipher(key);
}
```

**Status**: ✅ Already correct. No change needed.

---

## 5. HIGH: CORS Production Validation

### Issue

CORS defaults to localhost. Production must explicitly set origins, but there's no validation that localhost isn't included in production.

### Location

`apps/gh-service/src/config.ts` and `apps/notion-service/src/config.ts`

### Current Code

```typescript
const corsOrigins = parsed.DEVSUITE_GH_SERVICE_CORS_ORIGINS.split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
```

### Required Fix

```typescript
const corsOrigins = parsed.DEVSUITE_GH_SERVICE_CORS_ORIGINS.split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// Validate CORS origins in production
if (parsed.NODE_ENV === 'production') {
  const hasLocalhost = corsOrigins.some(
    origin => origin.includes('localhost') || origin.includes('127.0.0.1')
  );
  if (hasLocalhost) {
    throw new Error(
      'CORS origins must not include localhost in production. ' +
        `Got: ${corsOrigins.join(', ')}`
    );
  }
  if (corsOrigins.length === 0) {
    throw new Error(
      'DEVSUITE_GH_SERVICE_CORS_ORIGINS must be configured in production'
    );
  }
}
```

### Apply to Both Files

- `apps/gh-service/src/config.ts` (after line 71)
- `apps/notion-service/src/config.ts` (after line 65)

---

## 6. HIGH: Add Rate Limiting to Token Auth

### Issue

No protection against brute force attacks on 16-character service tokens.

### Location

`apps/gh-service/src/server.ts` and `apps/notion-service/src/server.ts`

### Current Code (gh-service)

```typescript
function assertServiceAuth(req, config) {
  if (!config.serviceToken) return;

  const token = parseBearerToken(req);
  if (!token || token !== config.serviceToken) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid service token');
  }
}
```

### Required Fix - Add Simple In-Memory Rate Limiting

```typescript
interface RateLimitEntry {
  failures: number;
  lastFailureTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_FAILURES_PER_WINDOW = 5;

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientId);

  if (!entry || now - entry.lastFailureTime > RATE_LIMIT_WINDOW_MS) {
    // Window expired, reset
    rateLimitMap.set(clientId, { failures: 0, lastFailureTime: now });
    return true;
  }

  if (entry.failures >= MAX_FAILURES_PER_WINDOW) {
    return false; // Rate limited
  }

  return true;
}

function recordFailure(clientId: string): void {
  const entry = rateLimitMap.get(clientId) ?? {
    failures: 0,
    lastFailureTime: Date.now(),
  };
  entry.failures++;
  rateLimitMap.set(clientId, entry);
}

function assertServiceAuth(req, config) {
  if (!config.serviceToken) return;

  const clientId = (req.socket.remoteAddress ?? 'unknown') as string;

  if (!checkRateLimit(clientId)) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many failed token attempts');
  }

  const token = parseBearerToken(req);
  if (!token || token !== config.serviceToken) {
    recordFailure(clientId);
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid service token');
  }
}
```

**Note**: For production at scale, use Redis-based rate limiting instead of in-memory.

---

## 7. HIGH: Add Notion OAuth Secrets Validation

### Issue

Notion OAuth secrets lack minimum length requirements.

### Location

`apps/notion-service/src/config.ts`

### Current Code

```typescript
DEVSUITE_NOTION_OAUTH_CLIENT_ID: z.string().trim().min(1).optional(),
DEVSUITE_NOTION_OAUTH_CLIENT_SECRET: z.string().trim().min(1).optional(),
```

### Required Fix

```typescript
DEVSUITE_NOTION_OAUTH_CLIENT_ID: z.string().trim().min(20).optional(), // Typical OAuth client IDs
DEVSUITE_NOTION_OAUTH_CLIENT_SECRET: z.string().trim().min(40).optional(), // Typical OAuth secrets
```

### Plus Add Validation Logic

```typescript
if (
  (parsed.DEVSUITE_NOTION_OAUTH_CLIENT_ID &&
    !parsed.DEVSUITE_NOTION_OAUTH_CLIENT_SECRET) ||
  (!parsed.DEVSUITE_NOTION_OAUTH_CLIENT_ID &&
    parsed.DEVSUITE_NOTION_OAUTH_CLIENT_SECRET)
) {
  throw new Error(
    'Both DEVSUITE_NOTION_OAUTH_CLIENT_ID and DEVSUITE_NOTION_OAUTH_CLIENT_SECRET ' +
      'must be set together for Notion OAuth'
  );
}
```

---

## 8. MEDIUM: Add Key Rotation Support (Future-Proof)

### Issue

No mechanism for encrypting keys, so if a key is compromised, all tokens are lost.

### Location

`apps/gh-service/src/token-cipher.ts` and `apps/notion-service/src/token-cipher.ts`

### Current Implementation ✅

```typescript
const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
```

### Future Enhancement (Not Required Now)

```typescript
const CURRENT_VERSION = 'v2'; // Bump when adding key versioning

// Format: v2:keyVersion:iv:authTag:ciphertext
// - keyVersion = index of key used (0=current, 1=previous, etc.)
// - On rotation:
//   - Store old key at index 1
//   - Load new key at index 0
//   - Periodically re-encrypt all tokens with new key

// This requires:
// 1. Storing multiple keys (current + previous)
// 2. Re-encryption job for old tokens
// 3. Gradual migration strategy

// NOT REQUIRED for Phase 1, but design ahead
```

---

## 9. MEDIUM: Add MCP_TOKEN Validation

### Issue

MCP_TOKEN has no specification. Should either require it or enforce minimum if used.

### Location

`.env.example` and MCP server implementation (if applicable)

### Update `.env.example`

```
# ============================================================================
# MCP Server Configuration
# ============================================================================
# Static token for securing MCP server access (32+ characters recommended).
# Required if MCP server is exposed over network.
# For local stdio mode (Cursor integration), token is not needed.
# Generate with: openssl rand -base64 24
MCP_TOKEN=
```

---

## Implementation Checklist

### Phase 1: Critical (Before Production) — 2-3 Hours

- [ ] Add `validateBetterAuthSecret()` to `convex/betterAuth/auth.ts`
- [ ] Add backend token validation to both service `config.ts` files
- [ ] Enhance `.env.example` documentation for encryption keys
- [ ] Add CORS production validation to both service `config.ts` files
- [ ] Add Notion OAuth secrets validation to `apps/notion-service/src/config.ts`

### Phase 2: High Priority (Before First Production Deployment) — 2-3 Hours

- [ ] Implement rate limiting in both service `server.ts` files
- [ ] Update `.env.example` for MCP_TOKEN
- [ ] Run full test suite
- [ ] Deploy to staging environment for validation

### Phase 3: Medium Priority (Next Sprint) — 4-5 Hours

- [ ] Design key versioning strategy document
- [ ] Implement key rotation CLI tool
- [ ] Add telemetry for failed auth attempts
- [ ] Create runbook for secret rotation procedures

---

## Testing Strategy

### Unit Tests

```typescript
// Test BETTER_AUTH_SECRET validation
test('validateBetterAuthSecret rejects short secrets', () => {
  expect(() => validateBetterAuthSecret('short')).toThrow(
    'must be at least 32 characters'
  );
});

test('validateBetterAuthSecret accepts 32+ char secrets', () => {
  const secret = 'x'.repeat(32);
  expect(validateBetterAuthSecret(secret)).toBe(secret);
});

// Test CORS validation
test('production CORS rejects localhost', () => {
  const config = loadConfig({
    NODE_ENV: 'production',
    DEVSUITE_GH_SERVICE_CORS_ORIGINS: 'http://localhost:5173',
  });
  expect(() => config).toThrow('must not include localhost');
});

// Test rate limiting
test('rate limiting blocks after 5 failures', () => {
  for (let i = 0; i < 5; i++) {
    expect(checkRateLimit('client-1')).toBe(true);
    recordFailure('client-1');
  }
  expect(checkRateLimit('client-1')).toBe(false);
});
```

### Integration Tests

```bash
# Test token encryption/decryption
npm test -- --grep "token cipher"

# Test config validation
NODE_ENV=production npm test -- --grep "config"

# Test rate limiting
npm test -- --grep "rate limit"
```

### Manual Validation

```bash
# 1. Test with production config
export NODE_ENV=production
export DEVSUITE_GH_SERVICE_TOKEN=$(openssl rand -base64 12)
export DEVSUITE_GH_SERVICE_ENCRYPTION_KEY=$(openssl rand -base64 32)
export DEVSUITE_GH_SERVICE_BACKEND_TOKEN=$(openssl rand -base64 12)
export DEVSUITE_GH_SERVICE_CORS_ORIGINS=https://example.com
npm run build && npm start

# 2. Test with localhost in CORS (should fail)
export DEVSUITE_GH_SERVICE_CORS_ORIGINS=http://localhost:5173
npm start  # Should throw error

# 3. Test missing backend token (should fail if DEVSUITE_CONVEX_SITE_URL is set)
unset DEVSUITE_GH_SERVICE_BACKEND_TOKEN
npm start  # Should throw error
```

---

## Deployment Pre-Flight Checklist

- [ ] All encryption keys generated with `openssl rand -base64 32`
- [ ] All service tokens generated with `openssl rand -base64 12`
- [ ] BETTER_AUTH_SECRET is 32+ characters
- [ ] No localhost in CORS origins for production
- [ ] Backend tokens set in both Railway services and Convex
- [ ] Persistent volumes configured with 0700 permissions
- [ ] Test token encryption/decryption works
- [ ] Test CORS validation rejects unauthorized origins
- [ ] Test rate limiting blocks brute force attempts
- [ ] Run full test suite: `pnpm lint && pnpm typecheck && pnpm test`

---

**Timeline**: 4-6 hours to implement all Phase 1 + Phase 2 items  
**Risk**: Low (all changes are non-breaking validations)  
**Dependencies**: None (can be implemented independently)
