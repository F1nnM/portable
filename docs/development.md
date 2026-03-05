# Development Guide

## Prerequisites

- **Docker** -- Required for building container images and running k3d. Install from https://docs.docker.com/get-docker/
- **mise** -- Tool version manager. Install from https://mise.jdx.dev/
- **ctlptl** -- Declarative cluster management. Install from https://github.com/tilt-dev/ctlptl

mise manages Node.js, pnpm, kubectl, helm, k3d, and tilt via the `.mise.toml` file in the repo root. ctlptl is installed separately.

## Initial Setup

```bash
# 1. Install tools via mise
mise install

# 2. Install Node.js dependencies
pnpm install

# 3. Create the k3d cluster with local registry
ctlptl apply -f ctlptl-config.yaml

# 4. Install ingress-nginx into the cluster
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# 5. Start the development environment
tilt up
```

After `tilt up`, open http://portable.127.0.0.1.nip.io in your browser. Tilt builds the Docker images, pushes them to the local k3d registry, deploys via Helm, and watches for code changes.

## Environment Variables

The main app requires these environment variables. In the k3d dev environment, they are set via `deploy/dev-values.yaml` and injected by the Helm chart.

| Variable                    | Description                                           | Dev Default                        |
| --------------------------- | ----------------------------------------------------- | ---------------------------------- |
| `DATABASE_URL`              | Postgres connection string                            | Set by Helm chart                  |
| `NUXT_GITHUB_CLIENT_ID`     | GitHub OAuth App client ID                            | `dev-client-id`                    |
| `NUXT_GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret                        | `dev-client-secret`                |
| `NUXT_ENCRYPTION_KEY`       | 32-byte hex key for AES-256-GCM credential encryption | `aabb...` (dummy 64 hex)           |
| `NUXT_APP_BASE_URL`         | Public URL of the app (for OAuth callback URLs)       | `http://portable.127.0.0.1.nip.io` |

To use real GitHub OAuth locally, create a GitHub OAuth App (homepage: `http://portable.127.0.0.1.nip.io`, callback: `http://portable.127.0.0.1.nip.io/auth/github/callback`) and override the values in `deploy/dev-values.yaml`.

## Database

The shared Postgres instance runs inside the k3d cluster as a StatefulSet. Drizzle ORM migrations run automatically when the main app starts (via `server/plugins/migrate.ts`).

To manually manage the schema during development:

```bash
# Generate migration files from schema changes
pnpm --filter @portable/app db:generate

# Push schema directly to database (skips migration files, useful for rapid iteration)
pnpm --filter @portable/app db:push
```

The schema is defined in `packages/app/server/db/schema.ts` using Drizzle ORM. The Drizzle Kit config is in `packages/app/drizzle.config.ts`.

## How the Dev Environment Works

Everything runs inside the k3d Kubernetes cluster -- the main app, Postgres, and any project pods. No processes run on the host outside of K8s. This is a deliberate architectural constraint to keep networking simple and avoid discrepancies between local and production environments.

- **k3d** creates a lightweight K3s cluster in Docker with a local container registry at `k3d-portable-registry.localhost:5000`. Traefik is disabled via `ctlptl-config.yaml` in favor of ingress-nginx.
- **ctlptl** declaratively manages the k3d cluster and registry from `ctlptl-config.yaml`
- **ingress-nginx** is installed into the cluster (step 4 above) and listens on port 80 of the host
- **nip.io** provides wildcard DNS: `*.127.0.0.1.nip.io` resolves to `127.0.0.1`, so subdomains like `myproject.portable.127.0.0.1.nip.io` work without any `/etc/hosts` configuration
- **Tilt** watches source files, rebuilds Docker images, pushes to the k3d registry, and updates deployments

## Development Workflow

1. Start the environment: `tilt up`
2. Make code changes in `packages/app/`, `packages/pod-server/`, or `packages/editor/`
3. Tilt detects changes and syncs/rebuilds as needed
4. Check the Tilt UI (press `s` in the terminal, or open http://localhost:10350) for build status and logs
5. Run tests locally: `pnpm test`
6. When done: `tilt down`

## Running Tests

```bash
# Run all tests across all packages
pnpm test

# Run tests for a specific package
pnpm --filter @portable/app test
pnpm --filter @portable/pod-server test
pnpm --filter @portable/editor test

# Run tests in watch mode (useful during development)
pnpm --filter @portable/app exec vitest
pnpm --filter @portable/pod-server exec vitest
pnpm --filter @portable/editor exec vitest
```

### Test setup per package

- **`packages/app`**: Uses `@nuxt/test-utils` which boots a real Nuxt server. Tests use `$fetch` to make HTTP requests. The vitest config has a 30-second timeout due to Nuxt server startup time.
- **`packages/pod-server`**: Tests import the Hono `app` directly and use `app.request()` to test routes without starting a server.
- **`packages/editor`**: Tests use `@vue/test-utils` with `jsdom` to mount and test Vue components.

## Linting and Formatting

```bash
# Lint (ESLint)
pnpm lint              # Check for issues
pnpm lint:fix          # Fix auto-fixable issues

# Format (Prettier)
pnpm format            # Format all files
pnpm format:check      # Check without writing
```

Pre-commit hooks (Husky + lint-staged) automatically run ESLint fix and Prettier on staged files.

## Project Structure

```
packages/
  app/                 Nuxt 3 main app
    composables/
      useAuth.ts       Auth state composable (user, refresh, logout)
    layouts/
      default.vue      Main layout (topbar, bottom nav, content area)
    middleware/
      auth.global.ts   Client-side auth guard (redirects to /login)
    pages/
      login.vue        Login page (GitHub OAuth button, no layout)
      index.vue        Dashboard (placeholder)
      settings.vue     Settings page (placeholder)
      new.vue          New project page (placeholder)
    server/
      api/             API endpoints (health, auth/me)
      routes/          Route handlers (auth/github, auth/github/callback, auth/logout)
      middleware/
        auth.ts        Session validation middleware (attaches user to context)
      db/
        schema.ts      Drizzle ORM schema (users, projects, sessions)
        migrations/    Generated Drizzle migrations
      plugins/
        migrate.ts     Auto-migrate on server startup
      utils/
        db.ts          Database connection singleton
        auth.ts        GitHub OAuth client, session CRUD
        crypto.ts      AES-256-GCM encrypt/decrypt
    drizzle.config.ts  Drizzle Kit configuration
    tests/             Vitest tests
    Dockerfile         Multi-stage production build
    nuxt.config.ts     Nuxt configuration (runtimeConfig, CSS, fonts)
    vitest.config.ts   Test configuration

  pod-server/          Hono server for project pods
    src/
      index.ts         Server entry point (Hono + node-ws)
      app.ts           Hono app definition and routes (/health, /)
    tests/             Vitest tests (smoke.test.ts)
    Dockerfile         Multi-stage build (includes editor SPA + dev tools)
    tsup.config.ts     Build configuration
    vitest.config.ts   Test configuration

  editor/              Vue 3 SPA for in-pod editor UI
    src/
      main.ts          Vue app entry point
      App.vue          Root component
    tests/             Vitest tests (smoke.test.ts)
    vite.config.ts     Vite build configuration
    vitest.config.ts   Test configuration
```

## Useful Commands

```bash
# Tear down dev resources (keeps cluster)
tilt down

# Delete the entire k3d cluster
k3d cluster delete portable

# Re-create the cluster from scratch
ctlptl apply -f ctlptl-config.yaml

# Type-check all packages
pnpm typecheck

# Build a specific package
pnpm build:app
pnpm build:pod-server
pnpm build:editor
```
