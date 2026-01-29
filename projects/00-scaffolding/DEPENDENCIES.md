# Dependencies: Project Scaffolding

## Required Inputs

### From External
- [ ] Node.js 20+ installed
- [ ] pnpm installed globally
- [ ] Git repository initialized (confirmed: yes)

### From Human
- [ ] Confirmation on Node.js version requirement
- [ ] Any specific ESLint/Prettier preferences

## Produced Outputs

### For 01-shared-types
- [ ] `packages/shared/` folder exists with package.json
- [ ] TypeScript configured for shared package
- [ ] Build script available

### For 02-convex-foundation
- [ ] `convex/` folder exists
- [ ] TypeScript configured for Convex
- [ ] Development scripts support Convex

### For 03-frontend-foundation
- [ ] `apps/web/` folder exists with package.json
- [ ] TypeScript configured for web app
- [ ] `pnpm dev` script pattern established

### For 09-mcp-server
- [ ] `apps/mcp/` folder exists with package.json
- [ ] TypeScript configured for Node.js app
- [ ] Development scripts support MCP server

### For All Projects
- [ ] Consistent code style via ESLint/Prettier
- [ ] Type checking via `pnpm typecheck`
- [ ] Documented development workflow

## External Dependencies

### Required
| Package | Purpose | Version |
|---------|---------|---------|
| typescript | Type system | ^5.x |
| eslint | Linting | ^9.x |
| prettier | Formatting | ^3.x |
| husky | Git hooks | ^9.x |
| lint-staged | Pre-commit | ^15.x |

### Optional (Decision Pending)
| Package | Purpose | Notes |
|---------|---------|-------|
| turbo | Build orchestration | May add later if needed |
| @changesets/cli | Version management | May add later if needed |

## Blocking Issues
None - this is the first project with no dependencies.
