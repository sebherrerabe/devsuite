# Tasks: Notion Integration

## Task Breakdown

### TASK-15-001: Finalize Auth + Capability Contract

| Field            | Value                                         |
| ---------------- | --------------------------------------------- |
| Assigned Persona | Product Manager + Backend                     |
| Status           | in-progress                                   |
| Depends On       | none                                          |
| Deliverable      | Signed-off auth permissions and tenancy model |

**Description**:
Finalize the Notion auth contract and permission boundaries before implementation.

**Acceptance Criteria**:

- [ ] Confirm OAuth Authorization Code flow as the only pairing path (UI-driven).
- [ ] Confirm minimum capabilities for MVP (`read content`, `read comments`).
- [ ] Decide whether `user information without email` is included in MVP.
- [x] Decide connection tenancy model: one company maps to one Notion workspace.
- [ ] Document security requirements for encrypted token storage and revoke semantics.

---

### TASK-15-002: Implement Notion OAuth Connection Backend

| Field            | Value                                        |
| ---------------- | -------------------------------------------- |
| Assigned Persona | Backend Engineer                             |
| Status           | complete                                     |
| Depends On       | TASK-15-001                                  |
| Deliverable      | Provider endpoints + token lifecycle manager |

**Description**:
Implement Notion connection endpoints and token management aligned with existing integration service patterns.

**Acceptance Criteria**:

- [x] Add endpoints/actions for `connect/start`, `connect/callback`, `connect/status`, `disconnect`.
- [x] Exchange auth code for tokens and store token material encrypted at rest.
- [x] Implement refresh-token flow and invalid-token normalization.
- [x] Add introspect/reachability checks for status responses.
- [x] Add provider-specific error mapping for UI-safe messages.

---

### TASK-15-003: Implement Integrations UI Pairing Flow

| Field            | Value                                |
| ---------------- | ------------------------------------ |
| Assigned Persona | Frontend Engineer                    |
| Status           | complete                             |
| Depends On       | TASK-15-002                          |
| Deliverable      | Notion card in Integrations settings |

**Description**:
Add a Notion integration card to the settings UI with full OAuth pairing lifecycle.

**Acceptance Criteria**:

- [x] Add Notion `Connect`, `Refresh`, and `Disconnect` actions.
- [x] Show connection state badge, workspace/account metadata, and last checked time.
- [x] Handle OAuth callback completion and failure states in UI.
- [x] Surface actionable errors (not connected, expired token, missing config).
- [x] Keep UX parity with existing GitHub integration controls.

---

### TASK-15-004: Implement Task Link Validation + Title Resolution

| Field            | Value                                              |
| ---------------- | -------------------------------------------------- |
| Assigned Persona | Backend Engineer + Frontend Engineer               |
| Status           | complete                                           |
| Depends On       | TASK-15-002                                        |
| Deliverable      | Notion link validation flow in task external links |

**Description**:
Validate Notion URLs and resolve page titles when integration access is available.

**Acceptance Criteria**:

- [x] Parse Notion URL into stable page identifier where possible.
- [x] Validate page accessibility using authenticated Notion API calls.
- [x] Resolve and store display title while preserving reference-only storage rules.
- [x] Handle inaccessible/unshared pages with clear user guidance.
- [x] Avoid storing page body/content in DevSuite.

---

### TASK-15-005: Implement Webhook Ingestion to Inbox

| Field            | Value                                  |
| ---------------- | -------------------------------------- |
| Assigned Persona | Backend Engineer                       |
| Status           | complete                               |
| Depends On       | TASK-15-001, TASK-15-002               |
| Deliverable      | Verified webhook ingest + inbox upsert |

**Description**:
Ingest Notion webhook events and map them into company-scoped inbox notifications.

**Acceptance Criteria**:

- [x] Add HTTP webhook endpoint with signature verification.
- [x] Map selected Notion events to inbox item `type` and metadata schema.
- [x] Ensure dedupe/idempotency by external event/thread identifier.
- [x] Handle out-of-order and retry deliveries safely.
- [x] Keep ingestion reference-only (IDs/URLs/title snippets), no content mirroring.

---

### TASK-15-006: Validation + Operational Hardening

| Field            | Value                                 |
| ---------------- | ------------------------------------- |
| Assigned Persona | QA / Validation                       |
| Status           | in-progress                           |
| Depends On       | TASK-15-003, TASK-15-004, TASK-15-005 |
| Deliverable      | Test matrix + launch checklist        |

**Description**:
Validate auth flow, link behavior, and notification reliability under realistic failure scenarios.

**Acceptance Criteria**:

- [ ] Test connect/disconnect/token-refresh edge cases.
- [ ] Test link validation for shared vs unshared vs revoked resources.
- [ ] Test webhook retries, duplicates, and delayed delivery ordering.
- [ ] Test company isolation across multi-company user setups.
- [x] Run `pnpm lint` and `pnpm typecheck` with all Notion changes.

## Task Dependency Graph

```text
TASK-15-001
├── TASK-15-002
│   ├── TASK-15-003
│   └── TASK-15-004
└── TASK-15-005
    └── TASK-15-006
```

## Delegation Order

1. TASK-15-001 (can start immediately)
2. TASK-15-002 (after 001)
3. TASK-15-003, TASK-15-004, TASK-15-005 (parallel, after 002; 005 also depends on 001)
4. TASK-15-006 (after 003, 004, and 005)
