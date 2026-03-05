# ---- Stage 1: Install dependencies ----
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace root files needed for pnpm install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy all package.json files so pnpm can resolve the workspace
COPY packages/app/package.json packages/app/package.json
COPY packages/pod-server/package.json packages/pod-server/package.json
COPY packages/editor/package.json packages/editor/package.json

# Install all dependencies (pnpm needs the full workspace context)
RUN pnpm install --frozen-lockfile

# ---- Stage 2: Build Nuxt ----
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/app/node_modules ./packages/app/node_modules

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy app source
COPY packages/app/ packages/app/

# Build Nuxt
RUN pnpm --filter @portable/app build

# ---- Stage 3: Production runtime ----
FROM node:22-alpine AS runtime

WORKDIR /app

# Copy the Nuxt build output (standalone server)
COPY --from=build /app/packages/app/.output .output

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
