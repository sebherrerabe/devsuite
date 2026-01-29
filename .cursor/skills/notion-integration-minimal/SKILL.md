---
name: notion-integration-minimal
description: Implement minimal Notion integration for DevSuite: link validation, notification polling, and inbox item creation. This is NOT a full Notion sync—only explicit linking and notification forwarding. Use when implementing Notion integration, linking tasks to Notion pages, or syncing Notion notifications to inbox.
---

# Notion Integration (Minimal)

## Intent
This skill guides implementation of DevSuite's minimal Notion integration that enables task-to-Notion-page linking and notification forwarding to the inbox. The integration is read-only, company-scoped, and does not mirror Notion content—only references it.

## Non-Goals
- Full Notion workspace sync
- Mirroring Notion databases or pages
- Two-way synchronization
- Notion content editing from DevSuite
- Complex Notion API operations (only page metadata and notifications)

## Inputs to Read First
- Repo: `projects/15-notion-integration/PROJECT.md` (integration requirements)
- Repo: `projects/_conventions.md` (spec standards)
- Repo: `/dev_suite_conceptual_architecture_business_vs_tech.md` (section 6, external links)
- Repo: `projects/11-inbox-module/PROJECT.md` (inbox integration)
- Docs (Context7): "Notion API authentication integration token rate limits"

## Workflow

### 1) Set Up Notion API Client
- Install `@notionhq/client` package in `apps/mcp/` (or shared package if used by frontend)
- Create Notion client wrapper in `apps/mcp/integrations/notion/client.ts`:

```typescript
import { Client } from "@notionhq/client";

export function createNotionClient(apiKey: string) {
  return new Client({ auth: apiKey });
}

export async function validateNotionPage(
  client: Client,
  pageId: string
): Promise<{ valid: boolean; title?: string; url?: string }> {
  try {
    const page = await client.pages.retrieve({ page_id: pageId });
    // Extract title from page properties
    const title = extractPageTitle(page);
    return {
      valid: true,
      title,
      url: page.url,
    };
  } catch (error) {
    if (error.code === "object_not_found") {
      return { valid: false };
    }
    throw error;
  }
}
```

### 2) Store Notion Configuration
- Add to Convex schema (`convex/schema.ts`):

```typescript
notionIntegrations: defineTable({
  companyId: v.id("companies"),
  apiKey: v.string(), // Encrypted/stored securely
  enabled: v.boolean(),
  lastSyncAt: v.optional(v.number()),
  createdAt: v.number(),
  deletedAt: v.optional(v.number()),
})
  .index("by_company", ["companyId"]);
```

- Store API key securely (consider encryption or environment variable per company)
- One integration per company

### 3) Implement Link Validation
- When user links a task to a Notion page:
  - Extract Notion page ID from URL (format: `https://notion.so/page-name-PAGE_ID`)
  - Call Notion API to verify page exists
  - Fetch page title for display
  - Store link metadata in task's external links array

- Convex action (runs in MCP or server context):

```typescript
export const validateNotionLink = action({
  args: { pageId: v.string(), companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const integration = await getNotionIntegration(ctx, args.companyId);
    if (!integration?.enabled) {
      throw new Error("Notion integration not enabled");
    }

    const client = createNotionClient(integration.apiKey);
    const result = await validateNotionPage(client, args.pageId);

    return result;
  },
});
```

### 4) Implement Notification Polling
- Poll Notion API for page updates (runs periodically, e.g., every 15 minutes)
- MCP server action or scheduled Convex function:

```typescript
export const syncNotionNotifications = action({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const integration = await getNotionIntegration(ctx, args.companyId);
    if (!integration?.enabled) return;

    const client = createNotionClient(integration.apiKey);

    // Get pages linked to tasks for this company
    const linkedPages = await getLinkedNotionPages(ctx, args.companyId);

    for (const page of linkedPages) {
      const updates = await checkPageUpdates(client, page.notionPageId);
      if (updates.hasUpdates) {
        await ctx.runMutation(api.inboxItems.create, {
          companyId: args.companyId,
          type: "notion_page_update",
          source: "notion",
          externalId: page.notionPageId,
          title: updates.title,
          linkUrl: updates.url,
          metadata: {
            pageId: page.notionPageId,
            updatedBy: updates.updatedBy,
          },
        });
      }
    }

    await ctx.runMutation(api.notionIntegrations.updateLastSync, {
      companyId: args.companyId,
      lastSyncAt: Date.now(),
    });
  },
});
```

### 5) Handle Rate Limiting
- Notion API rate limits: ~3 requests per second, burst to ~100 requests per minute
- Implement exponential backoff on 429 errors
- Track request rate per company
- Queue requests if approaching limits

```typescript
async function withRateLimit<T>(
  fn: () => Promise<T>,
  companyId: string
): Promise<T> {
  const rateLimiter = getRateLimiter(companyId);
  await rateLimiter.waitIfNeeded();

  try {
    return await fn();
  } catch (error) {
    if (error.status === 429) {
      const retryAfter = error.headers["retry-after"] || 60;
      await delay(retryAfter * 1000);
      return await fn();
    }
    throw error;
  }
}
```

### 6) Task Link UI
- In task detail/edit form:
  - "Link to Notion page" button
  - Input field for Notion URL
  - Validate on blur/submit
  - Show linked pages with:
    - Notion icon
    - Page title (fetched from API)
    - Link to open in Notion
    - Remove link button

### 7) Company-Specific Configuration
- Settings page for Notion integration:
  - Enable/disable toggle
  - API key input (masked)
  - Test connection button
  - Last sync timestamp
  - Sync frequency setting

### 8) Error Handling
- Handle common errors gracefully:
  - Invalid API key → Show error, disable integration
  - Page not found → Remove invalid link, notify user
  - Rate limited → Queue for retry, show warning
  - Network error → Retry with backoff

## Deliverables Checklist
- [ ] Notion API client wrapper implemented
- [ ] Notion integration schema (company-scoped)
- [ ] Link validation function (verify page exists, fetch title)
- [ ] Notification polling logic
- [ ] Rate limiting handling
- [ ] Task link UI (add/remove Notion links)
- [ ] Inbox item creation for Notion updates
- [ ] Company settings page for Notion integration
- [ ] Error handling for common failure cases
- [ ] Company scoping enforced

## Notion API Patterns

### Extracting Page ID from URL
Notion URLs format: `https://www.notion.so/Page-Title-PAGE_ID`
- Extract the last segment (after final `-`)
- Page ID format: 32-character hex string
- May need to remove hyphens and convert format

### Fetching Page Title
```typescript
async function extractPageTitle(page: Page): Promise<string> {
  const props = page.properties;
  // Title is usually in a "title" property
  const titleProp = Object.values(props).find(
    (p) => p.type === "title"
  );
  if (titleProp?.type === "title") {
    return titleProp.title
      .map((richText) => richText.plain_text)
      .join("");
  }
  return "Untitled";
}
```

### Checking for Updates
- Store last checked timestamp per page
- Compare `last_edited_time` from Notion API
- If newer, create inbox item

## Rate Limiting Strategy
- **Per-company rate limiting**: Track requests per company
- **Burst handling**: Allow short bursts, then throttle
- **Queue system**: Queue requests when approaching limits
- **Retry logic**: Exponential backoff on 429 errors
- **Sync frequency**: Default to 15-minute intervals, configurable

## References
- `projects/15-notion-integration/PROJECT.md` - Integration requirements
- `projects/_conventions.md` - Spec standards
- `/dev_suite_conceptual_architecture_business_vs_tech.md` - Section 6
- `inbox-aggregation-and-item-types` skill - Inbox integration
- Notion API docs: https://developers.notion.com/
