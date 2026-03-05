# Development Guide

## Prerequisites

- **Docker** -- Required for building container images and running k3d. Install from https://docs.docker.com/get-docker/
- **mise** -- Tool version manager. Install from https://mise.jdx.dev/

mise manages all other tools (Node.js, pnpm, kubectl, helm, k3d, tilt) via the `.mise.toml` file in the repo root.

## Initial Setup

```bash
# 1. Install tools via mise
mise install

# 2. Install Node.js dependencies
pnpm install

# 3. Create the k3d cluster with local registry and ingress-nginx
./scripts/dev-setup.sh

# 4. Start the development environment
tilt up
```

After `tilt up`, open http://portable.127.0.0.1.nip.io in your browser. Tilt builds the Docker images, pushes them to the local k3d registry, deploys via Helm, and watches for code changes.

## How the Dev Environment Works

Everything runs inside the k3d Kubernetes cluster -- the main app, Postgres, and any project pods. No processes run on the host outside of K8s. This is a deliberate architectural constraint to keep networking simple and avoid discrepancies between local and production environments.

- **k3d** creates a lightweight K3s cluster in Docker with a local container registry at `k3d-portable-registry.localhost:5000`
- **ingress-nginx** is installed by `dev-setup.sh` and listens on ports 80/443 of the host
- **nip.io** provides wildcard DNS: `*.127.0.0.1.nip.io` resolves to `127.0.0.1`, so subdomains like `myproject.portable.127.0.0.1.nip.io` work without any `/etc/hosts` configuration
- **Tilt** watches source files, rebuilds Docker images, pushes to the k3d registry, and updates deployments. `live_update` rules sync code changes without full image rebuilds when possible

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
    server/            Nitro server routes and middleware
      api/             API endpoints (REST)
      middleware/       Server middleware (auth, proxy)
      plugins/         Server plugins (migrations, WebSocket)
    pages/             Vue pages (dashboard, settings, new project, login)
    tests/             Vitest tests
    Dockerfile         Multi-stage production build
    nuxt.config.ts     Nuxt configuration
    vitest.config.ts   Test configuration

  pod-server/          Hono server for project pods
    src/               Source code
      index.ts         Server entry point
      app.ts           Hono app definition and routes
    tests/             Vitest tests
    Dockerfile         Multi-stage build (includes editor SPA + dev tools)
    tsup.config.ts     Build configuration

  editor/              Vue 3 SPA for in-pod editor UI
    src/               Source code
      App.vue          Root component
    tests/             Vitest tests
    vite.config.ts     Vite build configuration
```

## Useful Commands

```bash
# Tear down dev resources (keeps cluster)
tilt down

# Delete the entire k3d cluster
k3d cluster delete portable

# Re-create the cluster from scratch
./scripts/dev-setup.sh

# Type-check all packages
pnpm typecheck

# Build a specific package
pnpm build:app
pnpm build:pod-server
pnpm build:editor
```
