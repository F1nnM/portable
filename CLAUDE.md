# Portable -- Codebase Guide

## Project Overview

Portable is a mobile-first web application for using Claude Code remotely. Users create projects from scaffolds, each running in an isolated Kubernetes pod with Claude Code, a dev server, and a file browser -- all accessible through a mobile-optimized web UI.

## Repository Structure

```
portable/
  packages/
    app/              Nuxt 3 full-stack main app (auth, project management, proxy)
    pod-server/       Hono server that runs inside each project pod
    editor/           Vue 3 SPA served by the pod server (chat, files, preview)
  scaffolds/
    nuxt-postgres/    Project template: Nuxt 3 + Postgres (Drizzle)
  deploy/
    helm/portable/    Helm chart for Kubernetes deployment
    dev-values.yaml   Development overrides for local k3d
  ctlptl-config.yaml  Declares k3d cluster + registry for ctlptl
  docs/               Architecture, development, deployment, and API docs
  Tiltfile            Live development via Tilt (builds, deploys, watches)
```

## Tech Stack

- **Main app:** Nuxt 3, Drizzle ORM, `@kubernetes/client-node`, Octokit, Arctic (GitHub OAuth)
- **Pod server:** Hono, `@hono/node-server`, `@hono/node-ws`, Claude Agent SDK
- **Editor SPA:** Vue 3, Vite, CodeMirror 6
- **Infrastructure:** Kubernetes, Helm, k3d (local), Tilt (live dev), Postgres 16
- **Tooling:** mise (tool management), pnpm (package manager), Node.js 22

## Commands

### Root-level commands (run from repo root)

```bash
pnpm install          # Install all dependencies across the monorepo
pnpm build            # Build all packages
pnpm test             # Run tests in all packages
pnpm lint             # Lint all files (ESLint)
pnpm lint:fix         # Lint and auto-fix
pnpm format           # Format all files (Prettier)
pnpm format:check     # Check formatting without writing
pnpm typecheck        # Type-check all packages
```

### Package-specific commands

```bash
# Main app (packages/app)
pnpm dev:app                           # Run Nuxt dev server
pnpm build:app                         # Build Nuxt for production
pnpm --filter @portable/app test       # Run app tests

# Pod server (packages/pod-server)
pnpm dev:pod-server                    # Run pod server with tsx watch
pnpm build:pod-server                  # Build with tsup
pnpm --filter @portable/pod-server test  # Run pod-server tests

# Editor SPA (packages/editor)
pnpm dev:editor                        # Run Vite dev server
pnpm build:editor                      # Build with Vite
pnpm --filter @portable/editor test    # Run editor tests
```

### Local development (K8s)

```bash
mise install                          # Install Node.js, pnpm, kubectl, helm, k3d, tilt
ctlptl apply -f ctlptl-config.yaml   # Create k3d cluster + registry
tilt up                               # Build images, deploy via Helm, watch for changes
# Open http://portable.127.0.0.1.nip.io
tilt down                             # Tear down dev resources
```

## Testing

- **Framework:** Vitest across all packages
- **Methodology:** Test-driven development (red-green-refactor)
- **App tests:** `@nuxt/test-utils` for server route testing, `happy-dom` as environment
- **Pod server tests:** Direct Hono `app.request()` invocation
- **Editor tests:** `@vue/test-utils` with `jsdom`

Test files live in `tests/` directories within each package. Name test files `*.test.ts`.

Run all tests: `pnpm test`

## Code Conventions

- **Language:** TypeScript everywhere (strict mode)
- **Module system:** ESM (`"type": "module"` in all packages)
- **Linting:** ESLint with `@antfu/eslint-config` (flat config), Vue + TypeScript support, Prettier for formatting
- **Formatting:** Prettier with double quotes, semicolons, trailing commas, 100 char print width
- **Imports:** Use `type` keyword for type-only imports (`import { type Foo } from ...`)
- **Unused variables:** Prefix with `_` to suppress warnings
- **Pre-commit:** Husky + lint-staged runs ESLint fix and Prettier on staged files

## Architecture Summary

The main app (Nuxt) handles authentication (GitHub OAuth), project CRUD, Kubernetes pod lifecycle, and acts as an auth-checking reverse proxy. Each project gets its own K8s pod running the pod server (Hono) which serves the editor SPA, provides file access APIs, and bridges WebSocket connections to the Claude Agent SDK. Subdomain routing: `<project>.domain` goes to the editor, `preview.<project>.domain` goes to the dev server.

See `docs/architecture.md` for the full architecture diagram and component details.

## Key Design Decisions

- Everything runs inside K8s (even locally via k3d) -- no host processes outside the cluster
- Single wildcard ingress on the main app handles all subdomain routing
- Pods have no auth logic; all requests are validated by the main app proxy
- Per-project Postgres databases are created in the shared instance
- Credentials (Anthropic API keys) are stored AES-256-GCM encrypted
