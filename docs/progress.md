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

---

## Phase 3: Project Management

**Status:** Complete

### Task 3.1: Anthropic credential management

Added `encryptedAnthropicKey` column to the `users` table for storing a user-level default Anthropic credential. Created `PUT /api/settings/credential` (encrypts and stores the key with AES-256-GCM) and `GET /api/settings/credential` (returns `{ hasCredential: true/false }` without exposing the key). Updated the settings page with a functional credential management form. Generated the first Drizzle migration (`0000_useful_wallow.sql`).

### Task 3.2: Project CRUD API

Built the full project CRUD layer. Created a slug utility (`server/utils/slug.ts`) that generates URL-safe slugs (lowercase, hyphens, special character removal, 50-char max). Implemented five endpoints: `POST /api/projects` (create with auto-slug), `GET /api/projects` (list user's projects), `PATCH /api/projects/[slug]` (rename), `DELETE /api/projects/[slug]` (delete). Added `POST /api/projects/[slug]/start` and `POST /api/projects/[slug]/stop` as 501 placeholders for K8s integration in Phase 5. Extracted the shared `Project` interface to `types/project.ts`.

### Task 3.3: Dashboard UI

Built the dashboard page with a project list supporting loading, error, and empty states. Created the `ProjectCard` component with status badges (color-coded by project status), start/stop buttons, rename via bottom sheet dialog, and delete with confirmation. The dashboard fetches projects from the API and provides full CRUD interactions.

### Code review fixes

- Added auth guards to start/stop placeholder endpoints (were missing 401 checks)
- Extracted shared `Project` interface to `types/project.ts` (was duplicated between components)
- Added 100-character max length validation on project names in create and rename endpoints

### Phase 3 summary

Phase 3 added project management: Anthropic credential storage (encrypted at rest on the users table), a complete project CRUD API with slug generation, and a dashboard UI with project cards. The settings page now supports credential management. Start/stop endpoints are 501 placeholders pending K8s integration in Phase 5. Ready for Phase 4 (Scaffold System & GitHub Integration).

---

## Phase 4: Scaffold System & GitHub Integration

**Status:** Complete

### Task 4.1: nuxt-postgres scaffold

Created the `scaffolds/nuxt-postgres/` directory with 15 files forming a complete Nuxt 3 + Postgres + Drizzle todo application. Includes `CLAUDE.md` with dev server instructions for Claude Code, Drizzle ORM config, server API routes for todo CRUD, a single-page UI, `.env.example`, `.gitignore`, and `tsconfig.json`. Covered by 19 filesystem-based tests validating scaffold structure and file contents.

### Task 4.2: GitHub repo creation and scaffold push

Created `server/utils/github.ts` with five functions: `listScaffolds()` reads scaffold directories and parses metadata, `readScaffoldFiles()` reads all files from a scaffold directory, `getDecryptedGithubToken()` decrypts the user's stored GitHub token, `createGitHubRepo()` creates a repository via the Octokit REST API, and `pushScaffoldToRepo()` pushes scaffold files as an initial commit via the Git Data API (no local git binary needed). Added `GET /api/scaffolds` endpoint (public, no auth required) that returns available scaffolds. Modified `POST /api/projects` to create a GitHub repo and push the scaffold on project creation using a create-then-update pattern (project record is created first, then repo URL is updated after successful GitHub operations). Added the `octokit` dependency. Covered by 10 tests.

### Task 4.3: New project page UI

Built the `/new` page with a scaffold picker (radio buttons for available scaffolds loaded from the API), a project name input with live slug preview matching the server-side `generateSlug()` logic, and a create button. Includes loading state with a spinner, error display, and automatic redirect to the dashboard on success. Covered by 2 tests.

### Code review fixes

- Added `scaffoldId` validation against available scaffolds in `POST /api/projects` to prevent path traversal
- Fixed client-side slug preview in `pages/new.vue` to match server-side `generateSlug()` behavior
- Added `repoUrl` field to the `Project` type interface and all API response shapes
- Added `updatedAt` to `POST /api/projects` response for consistency

### Phase 4 summary

Phase 4 added the scaffold system and GitHub integration: a complete nuxt-postgres scaffold template, server-side GitHub repo creation and scaffold push via the Git Data API, a scaffolds listing endpoint, and a new project creation page with scaffold selection. Project creation now creates a GitHub repository and pushes the selected scaffold as the initial commit. Ready for Phase 5 (Kubernetes Integration).

---

## Phase 5: Kubernetes Integration

**Status:** Complete

### Task 5.1: K8s client and pod management

Created `packages/app/server/utils/k8s.ts` with `@kubernetes/client-node`. Provides six functions: `createProjectPod` (creates a pod with the pod-server image, env vars, resource limits, and PVC mount), `createProjectService` (creates a headless service with `clusterIP: None`), `createProjectPVC` (creates a 5Gi ReadWriteOnce PVC), `waitForPodReady` (watches pod until Ready condition is true with 120s timeout), `deleteProjectPod`, `deleteProjectService`, and `deleteProjectPVC` (all ignore 404 for idempotency). Configuration is read from `NUXT_POD_*` environment variables with defaults. Resources are named `project-<slug>` and labeled with `app.kubernetes.io/managed-by: portable` and `portable.dev/project: <slug>`.

### Task 5.2: Wire K8s into project lifecycle

Created two new server utilities:

- `server/utils/project-db.ts` -- Per-project Postgres database management. `createProjectDatabase` creates a database named `portable_<slug>` (idempotent, ignores "already exists"). `deleteProjectDatabase` terminates active connections and drops the database. `buildProjectDatabaseUrl` constructs the connection string for the per-project database.
- `server/utils/project-lifecycle.ts` -- High-level orchestration of start, stop, and delete operations. `startProject` validates state, creates the per-project DB, PVC, pod (with `DATABASE_URL`, Anthropic credential, and `GITHUB_TOKEN`), and service, waits for ready, and updates status. `stopProject` deletes pod and service (preserves PVC). `deleteProject` cleans up all K8s resources, drops the per-project database, and deletes the DB row (does NOT delete the GitHub repo).

Modified all four project endpoints: `POST /api/projects` now creates the per-project database on project creation. `POST /api/projects/:slug/start` and `POST /api/projects/:slug/stop` delegate to the lifecycle functions (no longer return 501). `DELETE /api/projects/:slug` uses the lifecycle delete function for full resource cleanup.

### Code review fixes

- Fixed async watch handling in `waitForPodReady` to properly abort the watch when the promise settles before the watch is established
- Used parameterized SQL in `deleteProjectDatabase` for defense-in-depth
- Added AlreadyExists (409) handling in `startProject` for pod, service, and PVC creation to support retries after partial failures

### Phase 5 summary

Phase 5 added full Kubernetes integration: a K8s client utility for managing pods, services, and PVCs; per-project Postgres database management; and a project lifecycle orchestrator that ties everything together. Project start creates a database, PVC, pod, and headless service, then waits for the pod to become ready. Project stop tears down the pod and service while preserving the PVC. Project delete cleans up all resources including the per-project database. All operations handle partial failures gracefully with AlreadyExists and 404 tolerance. Ready for Phase 6 (Reverse Proxy).

---

## Phase 6: Reverse Proxy

**Status:** Complete

### Task 6.1: Subdomain-based auth proxy

Created the reverse proxy layer that routes subdomain traffic to project pods. Three new files:

- `server/utils/proxy.ts` -- Shared proxy resolution logic with five functions: `getDomainFromBaseUrl` (extracts hostname from the configured base URL), `parseSubdomain` (parses Host header to extract project slug and access type -- editor or preview), `buildProxyTarget` (constructs the internal K8s service URL), `lookupProject` (queries the DB for the project, verifying ownership), and `resolveProxyTarget` (orchestrates auth, lookup, status check, and target building). Returns null for main app domain requests. Throws 401 for unauthenticated requests, 404 for unknown projects, 503 for non-running projects.
- `server/middleware/proxy.ts` -- Nitro HTTP middleware that intercepts subdomain requests and proxies them via `h3.proxyRequest`. Forwards the original path and sets `x-forwarded-host`. Runs after the auth middleware (alphabetical ordering ensures `event.context.user` is populated).
- `server/plugins/ws-proxy.ts` -- Nitro plugin that hooks into the `request` event to intercept WebSocket upgrade requests. Manually parses the session cookie and validates it (plugins run outside the middleware chain). Proxies WebSocket connections via `httpxy.proxyUpgrade`. Destroys the socket on auth/project errors.

Subdomain routing: `<slug>.domain` proxies to port 3000 (editor), `preview.<slug>.domain` proxies to port 3001 (dev server). Pods are addressed via K8s service DNS at `project-<slug>.<namespace>.svc.cluster.local`.

Also renamed `baseUrl` to `appBaseUrl` in the Nuxt runtime config to avoid collision with Nuxt's built-in `app.baseURL`. Added `httpxy` as a dependency for WebSocket proxying.

### Code review fixes

- Fixed proxy path forwarding to append `event.path` to the target URL (was originally proxying only to the base target without preserving the request path)
- Fixed stale `NUXT_BASE_URL` reference in README.md to use the renamed `NUXT_APP_BASE_URL`

### Phase 6 summary

Phase 6 added the subdomain-based reverse proxy that completes the request path from browser to project pod. HTTP requests are proxied via h3's `proxyRequest`, WebSocket connections via httpxy's `proxyUpgrade`. All proxy requests require authentication and verify project ownership and running status. The proxy layer reuses the auth middleware for HTTP requests and handles its own auth for WebSocket upgrades. Ready for Phase 7 (Pod Server).
