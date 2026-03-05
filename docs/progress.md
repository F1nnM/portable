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

- `Tiltfile`: Builds images via k3d registry, deploys via Helm with dev overrides
- `deploy/dev-values.yaml`: Local k3d overrides (nip.io domain, dummy credentials, lower resources)
- `ctlptl-config.yaml`: Declarative k3d cluster + registry creation (replaces the earlier `scripts/dev-setup.sh`)

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

### Code review fixes

After the initial implementation, a code review pass addressed:

- Removed `live_update` blocks from Tiltfile (not needed with full image rebuilds)
- Cleaned up dead code in `pod-server/src/index.ts` (removed unused route handler, separated app definition into `app.ts`)
- Replaced `scripts/dev-setup.sh` with declarative `ctlptl-config.yaml` for cluster management
- Consolidated per-package `.dockerignore` files into a single root `.dockerignore`
- Fixed documentation inaccuracies in `docs/deployment.md` (ingress className default, cert-manager values)
- Added MIT License

### Phase 1 summary

Phase 1 established the complete development foundation: pnpm monorepo with three packages, mise for tool management, ESLint + Prettier with Husky pre-commit hooks, Vitest in all packages with smoke tests, multi-stage Dockerfiles for both containers, a full Helm chart with RBAC and Postgres, Tilt-based dev workflow with k3d and ctlptl, and comprehensive documentation. All infrastructure is ready for Phase 2 (Database and Auth).

---

## Phase 2: Database & Auth

**Status:** Complete

### Task 2.1: Database schema and Drizzle setup

Set up Drizzle ORM with `postgres.js` driver. Defined schema for `users`, `projects`, and `sessions` tables in `packages/app/server/db/schema.ts`. Created a `useDb()` singleton utility, a Drizzle Kit config for migration generation (`db:generate`) and direct push (`db:push`), and a Nitro plugin (`server/plugins/migrate.ts`) that automatically applies migrations on server startup. The projects table uses a `project_status` enum with states: stopped, starting, running, stopping, error. Slugs are unique per user (composite unique constraint on `user_id + slug`).

### Task 2.2: Credential encryption utility

Implemented AES-256-GCM encrypt/decrypt in `server/utils/crypto.ts` using Node.js `node:crypto`. Encrypts to a compact `iv:tag:ciphertext` format (base64-encoded components separated by colons). The encryption key is a 32-byte hex string from `NUXT_ENCRYPTION_KEY`. Tests cover round-trip encryption, different inputs producing different ciphertexts, tampered data detection, and invalid key handling.

### Task 2.3: GitHub OAuth flow

Implemented GitHub OAuth using Arctic in three route handlers: `GET /auth/github` (redirect with state cookie), `GET /auth/github/callback` (code exchange, user upsert, session creation, token encryption), and `POST /auth/logout` (session deletion, cookie clearing). Created `server/utils/auth.ts` with the GitHub client factory, session CRUD (`createSession`, `validateSession`, `deleteSession`), and the `SessionUser` interface. Server middleware (`server/middleware/auth.ts`) validates the `portable_session` cookie on every request and attaches the user to `event.context.user`. GitHub access tokens are encrypted with AES-256-GCM before storage.

### Task 2.4: Auth-guarded pages and layout

Created a `useAuth()` composable providing reactive user state, `refresh()`, and `logout()`. Added a global client-side route middleware that redirects unauthenticated users to `/login` and authenticated users away from `/login`. Built a mobile-first default layout with a sticky top bar (brand + user info + sign out) and a fixed bottom navigation bar (Dashboard, New, Settings) that hides on desktop. Created the login page with a dark theme, GitHub OAuth button, animated background effects, and Space Grotesk + JetBrains Mono fonts. Added placeholder pages for dashboard, settings, and new project. Implemented `GET /api/auth/me` to return the current user.

### Code review fixes

- Removed unused `email` field references from the schema (users table stores GitHub profile data, not email directly)
- Verified all encrypted fields use the `iv:tag:ciphertext` format consistently
- Confirmed session expiry cleanup works correctly (expired sessions are deleted on validation)

### Phase 2 summary

Phase 2 added the complete database and authentication layer: Drizzle ORM with auto-migrations, AES-256-GCM credential encryption, GitHub OAuth via Arctic with session management, and a mobile-first UI with auth guards and a responsive layout. The main app now has working login/logout, session validation on every request, and placeholder pages for all protected routes. Ready for Phase 3 (Project Management).
