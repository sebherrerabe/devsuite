# Dependencies: Convex Foundation

## Required Inputs

### From 00-scaffolding

- [ ] `convex/` folder exists
- [ ] TypeScript configured
- [ ] Package scripts support Convex dev server

### From 01-shared-types

- [ ] Entity type definitions
- [ ] Enum definitions (TaskStatus, etc.)
- [ ] ID type patterns

### From External

- [ ] Convex account/project setup
- [ ] Self-hosted Convex configuration (if applicable)

## Produced Outputs

### For 04-company-module

- [ ] `companies` table schema
- [ ] Base company CRUD functions
- [ ] Company scoping helpers

### For 05-repository-module

- [ ] `repositories` table schema
- [ ] Repository-company relationship

### For 06-project-module

- [ ] `projects` table schema
- [ ] Project-company, project-repository relationships

### For 07-task-module

- [ ] `tasks` table schema with hierarchy support
- [ ] Task-project relationship
- [ ] External links storage pattern

### For 08-session-module

- [ ] `sessions` table schema
- [ ] `sessionTasks` junction table
- [ ] Session-company relationship

### For 09-mcp-server

- [ ] Convex client configuration
- [ ] Function endpoints for MCP to call

### For All Feature Modules

- [ ] Company scoping pattern
- [ ] Soft delete pattern
- [ ] Realtime subscription pattern

## External Dependencies

| Package | Purpose          | Version |
| ------- | ---------------- | ------- |
| convex  | Backend platform | ^1.x    |

## Blocking Issues

- Waiting on 00-scaffolding completion
- Waiting on 01-shared-types completion
