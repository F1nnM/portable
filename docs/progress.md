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

---

## Phase 7: Pod Server

**Status:** Complete

### Task 7.1: Hono server with file API

Refactored the pod-server into a `createApp()` factory pattern in `src/app.ts` to support WebSocket upgrade injection and test isolation. Created `src/routes/files.ts` with three endpoints: `GET /api/files` (file tree via `fdir` with exclusions for `node_modules`, `.git`, `.nuxt`, `dist`, etc.), `GET /api/files/:path` (read file content as UTF-8), and `PUT /api/files/:path` (write file content, auto-creating parent directories). All file operations are scoped to `WORKSPACE_DIR` with path traversal protection. Added `fdir` as a dependency.

### Task 7.2: Agent SDK WebSocket bridge

Created `src/routes/ws.ts` implementing a WebSocket bridge between the browser and the Claude Agent SDK. Uses `query()` from `@anthropic-ai/claude-agent-sdk` with `permissionMode: "bypassPermissions"` and `settingSources: ["project"]`. The bridge forwards SDK streaming events to the browser as JSON. Supports `user_message` (start query), `interrupt` (cancel active query), and automatic interrupt-and-requeue when a new message arrives during an active query. Connection cleanup calls `query.close()` on disconnect. Added `@anthropic-ai/claude-agent-sdk` and `@types/ws` as dependencies.

### Task 7.3: Pod startup and dev server supervisor

Created three modules:

- `src/dev-server.ts` -- `DevServerSupervisor` class that manages the project's dev server as a child process on port 3001. Auto-restarts on crash with exponential backoff (1s to 30s cap). Backoff resets after 10 seconds of stable running. Graceful shutdown via SIGTERM.
- `src/setup.ts` -- `setupWorkspace()` function that clones the GitHub repo into the workspace if empty (with `GITHUB_TOKEN` injection for auth), then installs dependencies if `node_modules` is missing. Auto-detects the package manager (pnpm/yarn/npm) from lock files. Ignores `lost+found` on empty PVCs.
- `scripts/entrypoint.sh` -- Pod entrypoint that runs workspace setup then exec's the Hono server.

Updated `src/index.ts` to wire the dev server supervisor (starts after Hono begins listening, stops on SIGTERM/SIGINT). Changed the default port from 8080 to 3000. Updated the Dockerfile to enable pnpm via corepack in the runtime stage and use the entrypoint script as CMD.

### Code review fixes

- Verified path traversal protection covers all edge cases (resolved path must start with workspace dir + separator or equal workspace dir exactly)
- Confirmed WebSocket bridge properly cleans up SDK queries on disconnect and error
- Fixed dev server supervisor to handle both spawn errors and exit events correctly
- Ensured Dockerfile runtime stage includes pnpm for projects that use it

### Phase 7 summary

Phase 7 implemented the complete pod server: a file API for workspace file access with path traversal protection, a WebSocket bridge to the Claude Agent SDK with streaming events and interrupt support, a dev server supervisor with exponential backoff restart, and a workspace setup module for git clone and dependency installation. The Hono server listens on port 3000 and the dev server on port 3001, matching the main app proxy routing. The pod entrypoint script orchestrates workspace setup before starting the server. Ready for Phase 8 (Editor SPA).

---

## Phase 8: Editor SPA (Mobile-First UI)

**Status:** Complete

### Task 8.1: Editor SPA scaffolding and navigation

Set up Vue Router with `/chat`, `/files`, and `/preview` routes. Built a bottom tab bar with SVG icons (chat bubble, folder, monitor) and an active state with a top border indicator. Established dark theme CSS variables (`#0d1117` background, `#58a6ff` accent) and a mobile-first `100dvh` layout. Created placeholder views with `data-testid` attributes. Covered by 2 smoke tests and 4 navigation tests.

### Task 8.2: Chat view

Implemented the full chat interface with WebSocket connectivity to the pod server's `/ws` endpoint. Created three modules:

- `useWebSocket` composable: Manages connection lifecycle, sends `user_message` and `interrupt` messages, processes `query_start`, `sdk_event`, `query_end`, and `error` events. Auto-reconnects after 2 seconds on disconnect.
- `ChatMessage` component: Renders user and assistant messages with collapsible tool use blocks (showing tool name and input).
- `ChatInput` component: Auto-growing textarea with send/interrupt buttons. Enter sends, Shift+Enter inserts newlines. Shows interrupt button during active queries.

Also includes auto-scroll on new messages and a streaming indicator with pulsing dots. Covered by 17 tests.

### Task 8.3: Files view

Built the file browsing and editing interface. Created three modules:

- `useFiles` composable: Fetches flat file list from the pod server's file API, builds a nested tree structure, reads and writes file content.
- `FileTree` component: Recursive tree rendering with expand/collapse directories, indent guides, and dimmed file extensions.
- `CodeViewer` component: CodeMirror 6 editor with One Dark theme and language detection (JS, TS, JSON, CSS, HTML, Vue, Markdown). Read-only by default with edit toggle and save button. Back navigation returns to the file tree.

Covered by 6 tests.

### Task 8.4: Preview view

Implemented a full-screen iframe pointing to `preview.<hostname>` with subdomain URL construction from `window.location.hostname`. Added a thin header bar with a "Preview" label, URL display, and refresh button. Includes a loading state overlay. Covered by 7 tests.

### Code review fixes

- Fixed file tree state management to properly reset when navigating between views
- Ensured WebSocket cleanup on component unmount to prevent memory leaks
- Verified CodeMirror language detection covers all scaffold file extensions

### Phase 8 summary

Phase 8 implemented the complete editor SPA: a Vue 3 single-page application with Vue Router, dark theme, and mobile-first layout. The Chat view provides a full WebSocket chat interface with streaming messages, tool use blocks, and auto-reconnect. The Files view offers workspace browsing with a recursive file tree and a CodeMirror 6 code editor supporting multiple languages. The Preview view embeds the project's dev server in a full-screen iframe via subdomain URL construction. New dependencies: vue-router and CodeMirror 6 with language extensions and the One Dark theme. 36 total tests across the editor package (2 smoke + 4 navigation + 17 chat + 6 files + 7 preview). Ready for Phase 9 (Helm Chart Finalization).

---

## Phase 9: Helm Chart Finalization

**Status:** Complete

### Task 9.1: Complete Helm chart

Finalized the Helm chart at `deploy/helm/portable/`:

- Created `templates/certificate.yaml` -- A cert-manager Certificate resource, conditional on `certManager.enabled`. Requests TLS certificates for both the bare domain and wildcard (`*.domain`) via the configured issuer. The certificate secret is named `<release>-tls`.
- Created `templates/NOTES.txt` -- Post-install instructions displayed after `helm install`. Shows the access URL, TLS status, DNS configuration requirements (bare + wildcard records for project and preview subdomains), next steps (OAuth, encryption key, Anthropic API key), and useful `kubectl` commands for checking status.
- Added comprehensive documentation comments to `values.yaml` explaining all configurable values, their defaults, and usage notes. No value changes were made.

### Phase 9 summary

Phase 9 finalized the Helm chart with production-readiness improvements: a conditional cert-manager Certificate resource for automatic wildcard TLS, post-install NOTES.txt with setup instructions, and thorough values.yaml documentation. All nine implementation phases are now complete.

---

## Post-Phase 9 Review Fixes

**Status:** Complete

A comprehensive review pass after Phase 9 addressed hardening, CI/CD, documentation accuracy, and operational improvements across the entire codebase.

### 1. GITHUB_REPO_URL injected into project pods

The `GITHUB_REPO_URL` environment variable was not being passed to project pods, so workspace cloning did not work. Fixed `server/utils/k8s.ts` to include `GITHUB_REPO_URL` in the pod container env.

### 2. NUXT_APP_BASE_URL protocol derived from certManager.enabled

The Helm chart previously required `NUXT_PUBLIC_DOMAIN` and hardcoded `https://` for `NUXT_APP_BASE_URL`. The protocol is now derived from `certManager.enabled` (https when TLS is enabled, http otherwise), and `NUXT_PUBLIC_DOMAIN` was removed from the ConfigMap.

### 3. Security contexts on all containers

Added security contexts (`runAsNonRoot`, `readOnlyRootFilesystem`, `allowPrivilegeEscalation: false`, `drop: ALL` capabilities) to the main app Deployment, the Postgres StatefulSet, and dynamically created project pods. Both Dockerfiles were updated to create and run as a non-root user.

### 4. development.md project structure updated

Updated `docs/development.md` to reflect the actual directory structure and test descriptions, correcting stale references from earlier phases.

### 5. deployment.md image build instructions

Added container image build and push instructions to `docs/deployment.md` for both the main app and pod-server images.

### 6. WebSocket annotations as defaults in values.yaml

Moved the nginx WebSocket/proxy annotations (`proxy-read-timeout`, `proxy-send-timeout`, `proxy-buffering`) from optional overrides to the default `ingress.annotations` in `values.yaml`, so WebSocket connections work out of the box.

### 7. NetworkPolicy for project pod isolation

Added `deploy/helm/portable/templates/networkpolicy.yaml` that restricts project pod traffic: ingress only from the main app, egress only for DNS and internet. Pod-to-pod communication between different projects is denied.

### 8. Health endpoint verifies DB connectivity

`GET /api/health` now executes `SELECT 1` against the database and returns 503 when the database is unavailable, instead of always returning 200.

### 9. Lint fixes (ESLint/Prettier conflicts resolved)

Resolved all ESLint and Prettier formatting conflicts across the codebase. Fixed invalid markdown lint warnings in documentation files.

### 10. CLAUDE_CODE_OAUTH_TOKEN added to CLAUDE.md

Added the `CLAUDE_CODE_OAUTH_TOKEN` environment variable to the Pod Server Environment Variables table in CLAUDE.md. Also removed a stale phase reference and corrected a K8s Secret comment.

### 11. Tiltfile live_update with dev stages in Dockerfiles

Added `live_update` blocks to the Tiltfile so file changes sync directly into running containers without a full image rebuild. Both Dockerfiles gained dev-specific stages, and `entrypoint-dev.sh` was added to the pod-server for the dev workflow.

### 12. GitHub Actions CI and release workflows

Added `.github/workflows/ci.yml` (runs lint, typecheck, and tests on every push and PR) and `.github/workflows/release.yml` (builds and pushes container images on version tags).

### 13. Liveness probe uses TCP

Changed the Kubernetes liveness probe from HTTP (`/api/health`) to TCP socket check. This prevents pod restarts when the database is temporarily unavailable -- only the readiness probe (HTTP) removes the pod from service endpoints.

### 14. entrypoint.sh/entrypoint-dev.sh: setupWorkspace() properly awaited

Fixed `setupWorkspace()` calls in both entrypoint scripts to be properly awaited. Previously the promise was not awaited, so the server could start before workspace setup completed.
