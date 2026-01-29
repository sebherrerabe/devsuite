# Scope: Project Scaffolding

## In Scope

### Monorepo Structure

- Root `package.json` with workspace configuration
- pnpm workspace setup (`pnpm-workspace.yaml`)
- Folder structure: `apps/`, `packages/`, `convex/`, `docs/`

### TypeScript Configuration

- Root `tsconfig.json` with project references
- Base config for shared settings
- Per-package tsconfig extending base

### Code Quality Tooling

- ESLint with TypeScript support
- Prettier for formatting
- Shared config packages or root configs

### Git Hooks

- husky for git hooks
- lint-staged for pre-commit checks
- Commit message validation (optional)

### Development Scripts

- `pnpm dev` - start all development servers
- `pnpm build` - build all packages
- `pnpm lint` - lint all packages
- `pnpm typecheck` - type check all packages
- `pnpm clean` - clean build artifacts

### Documentation

- Root README with:
  - Project overview
  - Setup instructions
  - Development workflow
  - Package structure explanation

### Placeholder Packages

- `apps/web/` - empty Vite app placeholder
- `apps/mcp/` - empty Node.js placeholder
- `packages/shared/` - empty package placeholder
- `convex/` - empty Convex placeholder

## Out of Scope

- Actual application code (covered by: subsequent projects)
- Convex schema or functions (covered by: 02-convex-foundation)
- React components or UI (covered by: 03-frontend-foundation)
- MCP implementation (covered by: 09-mcp-server)
- CI/CD pipeline configuration (deferred - can be added later)
- Docker configuration (not planned for MVP)
- Production deployment setup (deferred)

## Boundaries

### Package Placeholders vs Real Implementation

This project creates placeholder packages with minimal setup (package.json, tsconfig.json, entry point). Actual implementation is delegated to specific feature projects.

### Tooling Configuration vs Usage

This project configures tools (ESLint, Prettier, TypeScript) but does not define application-specific rules. Feature projects may extend these configs as needed.

### Development vs Production

Focus is on development experience. Production build optimization and deployment are out of scope.

## Assumptions

- pnpm is the package manager (per architecture spec)
- TypeScript is used throughout (per architecture spec)
- Node.js 20+ is available
- Git is initialized (already done per workspace info)

## Open Questions

- [ ] Should we use Turborepo or similar for build orchestration? (owner: @infra-devops)
- [ ] Specific ESLint rule preferences? (owner: @human-review)
- [ ] Node.js version requirement (18 vs 20 vs 22)? (owner: @human-review)
