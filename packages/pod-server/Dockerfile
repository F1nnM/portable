# Pod server Dockerfile
# Must be built from the REPO ROOT so it can access both
# packages/pod-server/ (server) and packages/editor/ (SPA dist).
#
# Example: docker build -f packages/pod-server/Dockerfile .

# ---- Stage 1: Install dependencies ----
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /build

# Copy workspace root files needed for pnpm install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy all package.json files so pnpm can resolve the workspace
COPY packages/app/package.json packages/app/package.json
COPY packages/pod-server/package.json packages/pod-server/package.json
COPY packages/editor/package.json packages/editor/package.json

# Install all dependencies
RUN pnpm install --frozen-lockfile

# ---- Stage 2: Build pod-server and editor ----
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /build

# Copy installed node_modules from deps stage
COPY --from=deps /build/node_modules ./node_modules
COPY --from=deps /build/packages/pod-server/node_modules ./packages/pod-server/node_modules
COPY --from=deps /build/packages/editor/node_modules ./packages/editor/node_modules

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy pod-server source
COPY packages/pod-server/ packages/pod-server/

# Copy editor source
COPY packages/editor/ packages/editor/

# Build both packages
RUN pnpm --filter @portable/pod-server build && pnpm --filter @portable/editor build

# ---- Stage 3: Production runtime ----
FROM node:22-alpine AS runtime

# Install runtime dependencies needed inside project pods:
#   git       - clone repos into the PVC
#   python3   - required by some npm native modules (node-gyp)
#   make, g++ - compile native npm addons
RUN apk add --no-cache git python3 make g++

# Install bun for fast dependency installation in user projects
COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun

# Enable pnpm so projects using pnpm can run dev scripts
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /srv

# Copy pod-server build output and its production dependencies
COPY --from=build /build/packages/pod-server/dist ./dist
COPY --from=build /build/packages/pod-server/node_modules ./node_modules
COPY --from=build /build/packages/pod-server/package.json ./package.json

# Copy editor SPA dist into a known location the pod-server can serve
COPY --from=build /build/packages/editor/dist ./public

# Copy entrypoint script
COPY packages/pod-server/scripts/entrypoint.sh ./scripts/entrypoint.sh
RUN chmod +x ./scripts/entrypoint.sh

# Project workspace will be mounted here via PVC
RUN mkdir -p /workspace

# Use the existing 'node' user (uid 1000) from the base image
RUN chown -R node:node /srv /workspace
VOLUME /workspace

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
EXPOSE 3001

USER node
CMD ["./scripts/entrypoint.sh"]
