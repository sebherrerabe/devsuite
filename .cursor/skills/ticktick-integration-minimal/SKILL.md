---
name: ticktick-integration-minimal
description: Implement optional TickTick integration for explicit task linking. This is NOT task mirroring—only linking DevSuite tasks to TickTick tasks for reference. Use when implementing TickTick integration, linking tasks to TickTick, or displaying TickTick task metadata.
---

# TickTick Integration (Minimal)

## Intent
This skill guides implementation of DevSuite's optional TickTick integration that enables linking DevSuite tasks to TickTick tasks. The integration is read-only, uses OAuth2 authentication, and does not mirror TickTick content—only references it.

## Non-Goals
- Full TickTick task sync
- Two-way synchronization
- Creating TickTick tasks from DevSuite
- Mirroring TickTick projects/lists
- Complex TickTick API operations (only task linking and metadata)

## Inputs to Read First
- Repo: `projects/16-ticktick-integration/PROJECT.md` (integration requirements)
- Repo: `projects/_conventions.md` (spec standards)
- Repo: `/dev_suite_conceptual_architecture_business_vs_tech.md` (section 6, external links)
- Repo: `projects/07-task-module/PROJECT.md` (task linking)
- Docs (Context7): "TickTick Open API authentication flow"

## Workflow

### 1) Set Up OAuth2 Flow
TickTick uses OAuth2 for authentication. Implement the flow:

**Step 1: Redirect to Authorization**
- User clicks "Connect TickTick" in settings
- Redirect to: `https://ticktick.com/oauth/authorize?scope=tasks:read&client_id=YOUR_CLIENT_ID&state=STATE&redirect_uri=REDIRECT_URI&response_type=code`
- Store `state` parameter for CSRF protection

**Step 2: Handle Callback**
- Receive `code` and `state` in callback
- Verify `state` matches stored value
- Exchange code for access token

**Step 3: Exchange Code for Token**
```typescript
async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await fetch("https://ticktick.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      scope: "tasks:read",
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}
```

### 2) Store TickTick Configuration
- Add to Convex schema (`convex/schema.ts`):

```typescript
ticktickIntegrations: defineTable({
  companyId: v.id("companies"),
  userId: v.string(), // TickTick user ID
  accessToken: v.string(), // Encrypted/stored securely
  refreshToken: v.string(), // Encrypted/stored securely
  tokenExpiresAt: v.number(),
  enabled: v.boolean(),
  createdAt: v.number(),
  deletedAt: v.optional(v.number()),
})
  .index("by_company", ["companyId"]);
```

- Store tokens securely (encrypted or environment variable)
- One integration per company
- Handle token refresh when expired

### 3) Implement Token Refresh
- Check token expiration before API calls
- Refresh if expired:

```typescript
async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const response = await fetch("https://ticktick.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}
```

### 4) Implement Link Validation
- When user links a task to TickTick task:
  - Extract TickTick task ID from URL or input
  - Call TickTick API to verify task exists
  - Fetch task metadata (title, status) for display
  - Store link in task's external links array

- Convex action:

```typescript
export const validateTickTickLink = action({
  args: { taskId: v.string(), companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const integration = await getTickTickIntegration(ctx, args.companyId);
    if (!integration?.enabled) {
      throw new Error("TickTick integration not enabled");
    }

    const token = await ensureValidToken(ctx, integration);
    const task = await fetchTickTickTask(token, args.taskId);

    return {
      valid: true,
      title: task.title,
      status: task.status,
      url: `https://ticktick.com/webapp/#task/${args.taskId}`,
    };
  },
});
```

### 5) Fetch Task Metadata
- TickTick API endpoint: `GET /open/v1/task/{taskId}`
- Requires `Authorization: Bearer {accessToken}` header
- Returns task details:

```typescript
interface TickTickTask {
  id: string;
  title: string;
  status: "NORMAL" | "COMPLETED" | "ARCHIVED";
  // ... other fields
}

async function fetchTickTickTask(
  accessToken: string,
  taskId: string
): Promise<TickTickTask> {
  const response = await fetch(
    `https://api.ticktick.com/open/v1/task/${taskId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Task not found");
    }
    throw new Error(`TickTick API error: ${response.statusText}`);
  }

  return await response.json();
}
```

### 6) Task Link UI
- In task detail/edit form:
  - "Link to TickTick task" button
  - Input field for TickTick task ID or URL
  - Validate on blur/submit
  - Show linked TickTick tasks with:
    - TickTick icon
    - Task title (fetched from API)
    - Task status badge
    - Link to open in TickTick
    - Remove link button

### 7) Company-Specific Configuration
- Settings page for TickTick integration:
  - "Connect TickTick" button (initiates OAuth flow)
  - Disconnect button (revokes tokens)
  - Status indicator (connected/disconnected)
  - Last sync timestamp (if applicable)

### 8) Error Handling
- Handle common errors gracefully:
  - Invalid task ID → Show error, don't create link
  - Token expired → Refresh automatically, retry
  - OAuth error → Show user-friendly message
  - API unavailable → Show warning, allow graceful degradation

### 9) Graceful Degradation
- If TickTick integration is disabled or unavailable:
  - Still allow tasks to exist
  - Show placeholder for TickTick links
  - Don't block task operations

## Deliverables Checklist
- [ ] OAuth2 flow implemented (authorize → callback → token exchange)
- [ ] TickTick integration schema (company-scoped, tokens stored securely)
- [ ] Token refresh logic
- [ ] Link validation function (verify task exists, fetch metadata)
- [ ] Task metadata fetching (title, status)
- [ ] Task link UI (add/remove TickTick links)
- [ ] Company settings page for TickTick integration
- [ ] Error handling for common failure cases
- [ ] Graceful degradation when integration unavailable
- [ ] Company scoping enforced

## TickTick API Patterns

### Task ID Format
- TickTick task IDs are strings (UUIDs or similar)
- Can be extracted from TickTick web URLs
- Format: `https://ticktick.com/webapp/#task/{taskId}`

### API Request Pattern
```typescript
async function callTickTickAPI<T>(
  accessToken: string,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`https://api.ticktick.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`TickTick API error: ${response.statusText}`);
  }

  return await response.json();
}
```

### Task Status Mapping
- TickTick statuses: `NORMAL`, `COMPLETED`, `ARCHIVED`
- Map to DevSuite display:
  - `NORMAL` → Active badge
  - `COMPLETED` → Completed badge (green)
  - `ARCHIVED` → Archived badge (gray)

## OAuth2 Flow Details

### Required Scopes
- `tasks:read` - Read task information

### Redirect URI
- Must be registered in TickTick developer portal
- Format: `https://your-app.com/auth/ticktick/callback`
- Must match exactly (including protocol and path)

### State Parameter
- Generate random string
- Store in session/cookie
- Verify on callback to prevent CSRF

## References
- `projects/16-ticktick-integration/PROJECT.md` - Integration requirements
- `projects/_conventions.md` - Spec standards
- `/dev_suite_conceptual_architecture_business_vs_tech.md` - Section 6
- `projects/07-task-module/PROJECT.md` - Task linking
- TickTick Developer docs: https://developer.ticktick.com/
