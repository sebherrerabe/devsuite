# Tasks: GitHub Integration

## Task Breakdown

### TASK-12-001: Freeze Architecture and Security Contract

| Field            | Value                            |
| ---------------- | -------------------------------- |
| Assigned Persona | Product Manager                  |
| Status           | complete                         |
| Depends On       | none                             |
| Deliverable      | Approved contract + threat model |

**Description**:
Finalize v1 architecture decisions for service boundary, user identity verification, token handling, and routing model.

**Acceptance Criteria**:

- [x] API contract defined for connect, status, disconnect, sync, and PR discovery
- [x] Authz rules documented for web, service, Convex, and MCP surfaces
- [x] Threat model documented with mitigations

**Notes**:
This is the gate for implementation work.

---

### TASK-12-002: Scaffold GitHub Service App

| Field            | Value                      |
| ---------------- | -------------------------- |
| Assigned Persona | Backend Engineer           |
| Status           | complete                   |
| Depends On       | TASK-12-001                |
| Deliverable      | `apps/gh-service` baseline |

**Description**:
Create a standalone Node service with health endpoint, config loader, structured logging, and backend client wiring.

**Acceptance Criteria**:

- [x] Service boots locally and in deploy mode
- [x] Health/readiness endpoints available
- [x] Auth middleware skeleton and backend client initialized

**Notes**:
No GitHub commands yet in this task.

---

### TASK-12-003: Implement Browser-First GitHub Connect Flow

| Field            | Value                                           |
| ---------------- | ----------------------------------------------- |
| Assigned Persona | Backend Engineer                                |
| Status           | complete                                        |
| Depends On       | TASK-12-001, TASK-12-002                        |
| Deliverable      | `connect/start`, `connect/status`, `disconnect` |

**Description**:
Implement login initiation and completion from the web app without terminal access by the user.

**Acceptance Criteria**:

- [x] UI can start a login flow and receive verification URL + user code
- [x] UI can poll connection status until complete/failed/expired
- [x] Disconnect revokes local credentials and marks integration disconnected

**Notes**:
Persist user-scoped connection state server-side.

---

### TASK-12-004: Build Encrypted Credential Store

| Field            | Value                             |
| ---------------- | --------------------------------- |
| Assigned Persona | Backend Engineer                  |
| Status           | complete                          |
| Depends On       | TASK-12-003                       |
| Deliverable      | Encrypted token persistence layer |

**Description**:
Store GitHub credentials encrypted at rest and expose only minimal metadata.

**Acceptance Criteria**:

- [x] Tokens encrypted before persistence
- [x] Decryption only inside service runtime paths that require it
- [x] Logs/UI never include token values

**Notes**:
Include key-rotation compatibility in schema design.

---

### TASK-12-005: Implement User-Isolated `gh` Runner

| Field            | Value                        |
| ---------------- | ---------------------------- |
| Assigned Persona | Backend Engineer             |
| Status           | complete                     |
| Depends On       | TASK-12-004                  |
| Deliverable      | User-scoped command executor |

**Description**:
Implement execution layer for `gh` with strict per-user isolation and command allowlisting.

**Acceptance Criteria**:

- [x] Isolation strategy implemented (`GH_CONFIG_DIR` per user)
- [x] Only allowlisted commands can execute
- [x] Concurrent multi-user requests remain isolated
- [x] Audit trail contains actor, command class, and outcome

**Notes**:
No interactive shell access exposed.

---

### TASK-12-006: Company Org Mapping Settings

| Field            | Value                            |
| ---------------- | -------------------------------- |
| Assigned Persona | Fullstack Engineer               |
| Status           | complete                         |
| Depends On       | TASK-12-001                      |
| Deliverable      | Company-level GitHub org mapping |

**Description**:
Add company settings that define which GitHub org logins map notifications to that company.

**Acceptance Criteria**:

- [x] Company can store one or more org logins
- [x] Validation prevents duplicates and empty values
- [x] Access is company-scoped and audited

**Notes**:
Integration auth remains user-scoped; mapping is company-scoped.

---

### TASK-12-007: Notification Polling and Routing

| Field            | Value                             |
| ---------------- | --------------------------------- |
| Assigned Persona | Backend Engineer                  |
| Status           | complete                          |
| Depends On       | TASK-12-005, TASK-12-006          |
| Deliverable      | Polling worker + routing pipeline |

**Description**:
Poll GitHub notifications on a schedule and route them into company inboxes based on org mapping.

**Acceptance Criteria**:

- [x] Configurable polling interval and retry/backoff
- [x] Idempotent upsert into inbox records
- [x] Unmatched-org notifications handled by explicit policy
- [x] Last successful sync timestamp persisted

**Notes**:
MVP uses polling only.

---

### TASK-12-008: PR Discovery Endpoints for MCP

| Field            | Value                                 |
| ---------------- | ------------------------------------- |
| Assigned Persona | MCP Developer                         |
| Status           | complete                              |
| Depends On       | TASK-12-005                           |
| Deliverable      | PR discovery APIs + MCP tool adapters |

**Description**:
Expose repository PR listing and metadata for agent workflows, secured with user context.

**Acceptance Criteria**:

- [x] PR list retrieval works for user-authorized repos
- [x] Payload normalized for downstream review tool usage
- [x] Error modes are explicit (not connected, forbidden, rate limit)

**Notes**:
PR review execution remains on-demand.

---

### TASK-12-009: Integrations UI Implementation

| Field            | Value                            |
| ---------------- | -------------------------------- |
| Assigned Persona | Frontend Engineer                |
| Status           | complete                         |
| Depends On       | TASK-12-003, TASK-12-007         |
| Deliverable      | Production GitHub integration UX |

**Description**:
Implement UI for connect, status, reconnect/disconnect, and sync health.

**Acceptance Criteria**:

- [x] Connect flow is fully web-driven
- [x] Current connection state is always visible
- [x] Failures surface actionable messages

**Notes**:
No local command instructions in UI.

---

### TASK-12-010: Hardening, QA, and Rollout

| Field            | Value                                 |
| ---------------- | ------------------------------------- |
| Assigned Persona | Backend Engineer                      |
| Status           | complete                              |
| Depends On       | TASK-12-007, TASK-12-008, TASK-12-009 |
| Deliverable      | Test suite + runbook + rollout plan   |

**Description**:
Ship operational safeguards, tests, and deployment guidance.

**Acceptance Criteria**:

- [x] Integration smoke checklist covers connect, reconnect, polling, and PR discovery
- [x] Runbook includes incident paths (token revoked, rate limits, service restart)
- [x] Feature flag and staged rollout steps documented

**Notes**:
This task gates production launch.

## Task Dependency Graph

```text
TASK-12-001
├── TASK-12-002
│   └── TASK-12-003
│       └── TASK-12-004
│           └── TASK-12-005
│               ├── TASK-12-007
│               │   └── TASK-12-010
│               └── TASK-12-008
│                   └── TASK-12-010
├── TASK-12-006
│   └── TASK-12-007
└── TASK-12-009
    └── TASK-12-010
```

## Delegation Order

1. TASK-12-001
2. TASK-12-002
3. TASK-12-003, TASK-12-006
4. TASK-12-004
5. TASK-12-005
6. TASK-12-007, TASK-12-008, TASK-12-009
7. TASK-12-010
