# Progress Log

## Phase 1: Dev Environment, Tooling & Testing Infrastructure

**Status:** Complete

### Task 1.1: Monorepo structure and mise config

Set up the pnpm workspace monorepo with three packages (`app`, `pod-server`, `editor`), `.mise.toml` for tool management (Node.js 22, pnpm 10, kubectl, helm, k3d, tilt), and the base directory structure including `scaffolds/` and `deploy/`.

### Task 1.2: Linting, formatting, and shared config

Configured ESLint with `@antfu/eslint-config` (flat config, TypeScript + Vue support) and Prettier. Set up Husky pre-commit hooks with lint-staged to auto-fix and format staged files. ESLint stylistic rules are disabled in favor of Prettier.

### Task 1.3: Testing infrastructure

Set up Vitest in all three packages with smoke tests:

- `packages/app`: `@nuxt/test-utils` with real Nuxt server, tests `/api/health` and page rendering
- `packages/pod-server`: Direct Hono `app.request()` testing, tests `/health` and `/` routes
- `packages/editor`: `@vue/test-utils` with jsdom, tests App.vue component rendering

### Task 1.4: Dockerfiles

Created multi-stage Dockerfiles for both containers:

- `packages/app/Dockerfile`: Install deps, build Nuxt, slim Node.js Alpine runtime
- `packages/pod-server/Dockerfile`: Install deps, build pod-server + editor SPA, runtime with git/python3/make/g++

### Task 1.5: Helm chart (base)

Created the base Helm chart at `deploy/helm/portable/` with:

- Main app: Deployment, Service, wildcard Ingress
- Postgres: StatefulSet, Service, PVC
- RBAC: ServiceAccount, Role (pods/PVCs/services), RoleBinding
- Secret: GitHub OAuth, Postgres password, encryption key
- ConfigMap: Domain, pod resource defaults, pod server image

### Task 1.6: Tiltfile and dev setup

Created the Tilt development workflow:

- `Tiltfile`: Builds images via k3d registry, deploys via Helm with dev overrides, `live_update` for code syncing
- `deploy/dev-values.yaml`: Local k3d overrides (nip.io domain, dummy credentials, lower resources)
- `scripts/dev-setup.sh`: Idempotent script that creates k3d cluster, local registry, and installs ingress-nginx

### Task 1.7: Initial documentation

Created project documentation:

- `CLAUDE.md`: Codebase guide for AI agents and developers (structure, commands, conventions, testing)
- `README.md`: Project overview for potential users (features, quick start, tech stack)
- `docs/architecture.md`: System architecture with diagrams, component details, data flow, schema
- `docs/development.md`: Local dev setup guide (prerequisites, setup steps, workflow, testing)
- `docs/deployment.md`: Production deployment guide (Helm configuration reference, all values documented)
- `docs/api.md`: API route reference (planned endpoints with request/response formats)
- `docs/pod-server.md`: Pod server internals (architecture, endpoints, startup, supervisor, WebSocket protocol)
- `docs/progress.md`: This file
