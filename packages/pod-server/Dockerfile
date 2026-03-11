# Pod server Dockerfile
# Must be built from the REPO ROOT so it can access packages/pod-server/.
#
# Example: docker build -f packages/pod-server/Dockerfile .

# ---- Stage 1: Install dependencies ----
FROM node:22-alpine AS deps

COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /build

# Copy workspace root files needed for bun install
COPY package.json bun.lock ./

# Copy all package.json files so bun can resolve the workspace
COPY packages/app/package.json packages/app/package.json
COPY packages/pod-server/package.json packages/pod-server/package.json
COPY packages/design-tokens/package.json packages/design-tokens/package.json

# Install all dependencies
RUN bun install --frozen-lockfile

# ---- Stage 2: Build pod-server ----
FROM node:22-alpine AS build

COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /build

# Copy installed node_modules from deps stage
COPY --from=deps /build/node_modules ./node_modules
COPY --from=deps /build/packages/pod-server/node_modules ./packages/pod-server/node_modules

# Copy workspace root files
COPY package.json bun.lock ./

# Copy pod-server source
COPY packages/pod-server/ packages/pod-server/

# Build pod-server
RUN bun run --filter @portable/pod-server build

# ---- Stage 3: Production runtime ----
FROM node:22-alpine AS runtime

# Install runtime dependencies needed inside project pods:
#   git       - clone repos into the PVC
#   python3   - required by some npm native modules (node-gyp)
#   make, g++ - compile native npm addons
RUN apk add --no-cache git python3 make g++ bash

# Install bun for fast dependency installation in user projects
COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /srv

# Copy pod-server build output (all dependencies are bundled by bun build)
COPY --from=build /build/packages/pod-server/dist ./dist
COPY --from=build /build/packages/pod-server/package.json ./package.json

# Copy entrypoint script
COPY packages/pod-server/scripts/entrypoint.sh ./scripts/entrypoint.sh
RUN chmod +x ./scripts/entrypoint.sh

# Create writable home directory for the non-root user
RUN mkdir -p /home/node/.claude && chown -R node:node /home/node

# Project workspace will be mounted here via PVC
RUN mkdir -p /workspace && chown node:node /workspace
VOLUME /workspace

ENV NODE_ENV=production
ENV PORT=3000
ENV HOME=/home/node

USER node

EXPOSE 3000
EXPOSE 3001

CMD ["./scripts/entrypoint.sh"]
