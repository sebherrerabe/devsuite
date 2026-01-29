---
name: github-cli-integration
description: Implement GitHub integration via GitHub CLI (gh) in the MCP server. Handle PR discovery, metadata fetching, notification sync, rate limiting, and authentication. Use when building GitHub-related MCP tools, handling gh CLI operations, or implementing rate limit strategies.
---

# GitHub CLI Integration (DevSuite)

## Intent

This skill covers implementing GitHub integration through the GitHub CLI (`gh`) in the MCP server. Focus on read-only operations, proper rate limiting, authentication handling, and surfacing GitHub data in DevSuite.

## Non-Goals

- GitHub OAuth setup (we use gh CLI authentication only)
- Writing to GitHub (read-only integration)
- PR review generation (covered by `pr-review-artifact-persistence`)
- GitHub webhook setup (not in scope)

## Inputs to Read First

- Repo: `projects/12-github-integration/PROJECT.md`, `projects/05-repository-module/PROJECT.md`
- GitHub CLI docs: `https://cli.github.com/manual/`
- GitHub API rate limits: `https://docs.github.com/rest/using-the-rest-api/rate-limits-for-the-rest-api`

## Workflow

### 1) GitHub CLI Prerequisites

- Verify `gh` CLI is installed: `gh --version`
- Verify authentication: `gh auth status`
- Document setup requirements in README
- Handle missing CLI gracefully with clear error messages

### 2) CLI Wrapper Implementation

- Create wrapper module: `apps/mcp/src/github/cli.ts`
- Use `child_process.exec` or `execa` to run `gh` commands
- Parse JSON output from `gh` commands
- Handle command failures gracefully
- Return structured errors

### 3) Rate Limiting Strategy

Implement rate limit handling:

- **Track rate limit state**: Monitor `x-ratelimit-remaining` headers
- **Respect limits**: Check remaining before making requests
- **Exponential backoff**: On 429 errors, wait with exponential backoff
- **Request queuing**: Queue requests when near limit
- **Avoid polling**: Prefer webhooks or manual triggers over polling

Rate limit guidelines:

- Authenticated: 5,000 requests/hour
- Unauthenticated: 60 requests/hour
- Secondary limits: Wait 1 second between mutative requests (not applicable for read-only)
- On 429: Wait `retry-after` seconds or until `x-ratelimit-reset`

### 4) Core GitHub Operations

Implement these operations as MCP tools or internal functions:

**PR Discovery**:

- `listOpenPRs(repo: string)`: List open PRs for a repository
- Use: `gh pr list --repo <owner/repo> --json number,title,author,createdAt`
- Parse and return structured data

**PR Metadata**:

- `getPRDetails(repo: string, prNumber: number)`: Get PR details
- Use: `gh pr view <number> --repo <owner/repo> --json ...`
- Return: title, body, author, state, labels, files changed, etc.

**Repository Info**:

- `getRepoInfo(repo: string)`: Get repository metadata
- Use: `gh repo view <owner/repo> --json name,description,defaultBranch`

**Link Generation**:

- `getPRLink(repo: string, prNumber: number)`: Generate GitHub web URL
- Format: `https://github.com/{owner}/{repo}/pull/{number}`

### 5) Error Handling

- **Authentication errors**: Clear message if `gh auth status` fails
- **Rate limit errors**: Return structured error with retry-after info
- **Not found errors**: Handle 404s for missing repos/PRs
- **Network errors**: Retry with backoff for transient failures
- **Parse errors**: Handle malformed JSON from gh CLI

### 6) MCP Tool Integration

Create MCP tools that wrap GitHub operations:

- `github_listPRs`: List open PRs for a repository
- `github_getPRDetails`: Get detailed PR information
- `github_getRepoInfo`: Get repository information

All tools must:

- Require `companyId` for scoping
- Validate repository format (`owner/repo`)
- Handle rate limiting transparently
- Return structured, consistent responses

### 7) Notification Sync (Future)

Design for inbox integration:

- Polling-based initially (can be replaced with webhooks later)
- Sync GitHub notifications to DevSuite inbox
- Scope by company/repository
- Mark as read when processed

### 8) Testing and Verification

- Test with authenticated gh CLI
- Test rate limit handling (use test account if needed)
- Test error cases: missing repo, missing PR, auth failure
- Verify JSON parsing works correctly
- Test link generation

## Deliverables Checklist

- [ ] GitHub CLI wrapper module implemented
- [ ] Rate limiting strategy implemented and tested
- [ ] PR discovery tool working (`listOpenPRs`)
- [ ] PR metadata tool working (`getPRDetails`)
- [ ] Repository info tool working (`getRepoInfo`)
- [ ] Link generation working correctly
- [ ] Error handling covers all cases
- [ ] MCP tools integrated and documented
- [ ] Rate limit handling tested
- [ ] Setup requirements documented

## Rate Limiting Implementation Pattern

```typescript
class RateLimiter {
  private remaining: number = 5000;
  private resetTime: number = Date.now() + 3600000;
  private queue: Array<() => Promise<any>> = [];

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.remaining <= 10) {
      const waitTime = Math.max(0, this.resetTime - Date.now());
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    try {
      const result = await fn();
      // Update remaining from response headers
      this.remaining--;
      return result;
    } catch (error) {
      if (error.status === 429) {
        const retryAfter = error.headers['retry-after'] || 60;
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return this.execute(fn); // Retry
      }
      throw error;
    }
  }
}
```

## GitHub CLI Command Patterns

### List Open PRs

```bash
gh pr list --repo owner/repo --json number,title,author,createdAt,state
```

### Get PR Details

```bash
gh pr view <number> --repo owner/repo --json number,title,body,author,state,labels,files
```

### Get Repository Info

```bash
gh repo view owner/repo --json name,description,defaultBranch,url
```

## Error Response Pattern

```typescript
{
  success: false,
  error: {
    code: "RATE_LIMIT_EXCEEDED" | "AUTH_ERROR" | "NOT_FOUND" | "NETWORK_ERROR",
    message: "Human-readable message",
    retryAfter?: number, // seconds, for rate limit errors
  }
}
```

## References

- GitHub CLI Manual: `https://cli.github.com/manual/`
- GitHub API Rate Limits: `https://docs.github.com/rest/using-the-rest-api/rate-limits-for-the-rest-api`
- Best Practices: `https://docs.github.com/rest/guides/best-practices-for-using-the-rest-api`
- DevSuite GitHub Integration: `projects/12-github-integration/PROJECT.md`
