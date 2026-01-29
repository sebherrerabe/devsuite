# Dependencies: Shared Types & Schemas

## Required Inputs

### From 00-scaffolding
- [ ] `packages/shared/` folder exists
- [ ] TypeScript configured with strict mode
- [ ] Package can be imported as `@devsuite/shared`

### From Architecture Spec
- [ ] Entity definitions from business spec
- [ ] Relationship definitions
- [ ] Data integrity rules (no hard deletes, company scoping)

## Produced Outputs

### For 02-convex-foundation
- [ ] Entity types for schema definition
- [ ] Validation schemas for mutation inputs
- [ ] ID types for references

### For 03-frontend-foundation
- [ ] Entity types for UI state
- [ ] Validation schemas for forms
- [ ] Utility types for API responses

### For 04-company-module and all feature modules
- [ ] Company type and schema
- [ ] CompanyId branded type

### For 09-mcp-server
- [ ] Entity types for tool parameters
- [ ] Validation schemas for tool inputs

## External Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| zod | Runtime validation | ^3.x |
| typescript | Type system | ^5.x (from root) |

## Blocking Issues
- Waiting on 00-scaffolding completion
