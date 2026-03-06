# ---- Stage 1: Install dependencies ----
FROM node:22-alpine AS deps

COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

# Copy workspace root files needed for bun install
COPY package.json bun.lock ./

# Copy all package.json files so bun can resolve the workspace
COPY packages/app/package.json packages/app/package.json
COPY packages/pod-server/package.json packages/pod-server/package.json
COPY packages/editor/package.json packages/editor/package.json

# Install all dependencies (bun needs the full workspace context)
RUN bun install --frozen-lockfile

# ---- Stage 2: Build Nuxt ----
FROM node:22-alpine AS build

COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/app/node_modules ./packages/app/node_modules

# Copy workspace root files
COPY package.json bun.lock ./

# Copy app source
COPY packages/app/ packages/app/

# Build Nuxt
RUN bun run --filter @portable/app build

# ---- Stage 3: Production runtime ----
FROM node:22-alpine AS runtime

WORKDIR /app

# Copy the Nuxt build output (standalone server)
COPY --from=build /app/packages/app/.output .output

# Copy database migrations (read at runtime by the migrate plugin)
COPY --from=build /app/packages/app/server/db/migrations server/db/migrations

# Copy scaffolds (read at runtime by the scaffolds API)
COPY scaffolds/ scaffolds/

# Ensure the node user (UID 1000) owns the app directory
RUN chown -R node:node /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

USER node
CMD ["node", ".output/server/index.mjs"]
