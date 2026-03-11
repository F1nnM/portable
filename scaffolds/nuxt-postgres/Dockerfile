# ---- Stage 1: Install dependencies ----
FROM node:22-alpine AS deps

COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- Stage 2: Build Nuxt ----
FROM node:22-alpine AS build

COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# ---- Stage 3: Production runtime ----
FROM node:22-alpine AS runtime

WORKDIR /app

# Copy the Nuxt build output (standalone server)
COPY --from=build /app/.output .output

# Copy database migrations (read at runtime by the migrate plugin)
COPY --from=build /app/server/db/migrations server/db/migrations

RUN chown -R node:node /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

USER node
CMD ["node", ".output/server/index.mjs"]
