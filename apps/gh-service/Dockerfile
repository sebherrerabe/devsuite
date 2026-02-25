# DevSuite gh-service: Node.js + GitHub CLI (gh)
# Build context must be the monorepo root (not apps/gh-service).
# In Railway: set "Root Directory" to repo root, "Dockerfile Path" to apps/gh-service/Dockerfile.

FROM node:22-bookworm-slim

# Install GitHub CLI (gh) - required for device flow, PR discovery, notifications
ARG GH_VERSION=2.51.0
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
  && curl -sSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" | tar xz \
  && mv "gh_${GH_VERSION}_linux_amd64/bin/gh" /usr/local/bin/gh \
  && rm -rf "gh_${GH_VERSION}_linux_amd64" \
  && apt-get clean && rm -rf /var/lib/apt/lists/* \
  && gh --version

WORKDIR /app

# Copy workspace files for pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/gh-service ./apps/gh-service

# Install dependencies and build gh-service
RUN corepack enable pnpm \
  && pnpm install --frozen-lockfile \
  && pnpm --filter @devsuite/gh-service build

WORKDIR /app/apps/gh-service
EXPOSE 8790
CMD ["node", "dist/index.js"]
