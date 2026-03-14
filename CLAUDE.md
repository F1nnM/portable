# Portable -- Codebase Guide

## Project Overview

Portable is a mobile-first web application for using Claude Code remotely. Users create projects from scaffolds or by importing an existing GitHub repository, each running in an isolated Kubernetes pod with Claude Code, a dev server, and a file browser -- all accessible through a mobile-optimized web UI.

## Repository Structure

```
portable/
  packages/
    app/              Nuxt 3 full-stack main app (auth, project management, proxy, editor UI)
      server/
        api/          API endpoints (health, auth/me, settings/credential+age-key, projects CRUD, projects status, scaffolds, github/repos)
        routes/       Route handlers (auth/github, auth/logout, pod proxy)
        middleware/   Server middleware (session auth)
        db/           Drizzle schema and migrations
        plugins/      Nitro plugins (auto-migration, subdomain proxy, startup recovery)
        utils/        Shared server utilities (db, auth, crypto, slug, github, k8s, project-db, project-lifecycle, proxy, proxy-shared, creation-phase)
      composables/    Vue composables (useAuth, useWebSocket, useSessions, useFiles, useGit)
      components/     Vue components (ProjectCard)
      middleware/     Client-side route middleware (auth guard)
      layouts/        App layouts (default with topbar + bottom nav, project with tabbed nav)
      pages/          Vue pages (login, dashboard, settings, onboarding, new, projects/[slug])
      types/          Shared TypeScript interfaces (Project)
    design-tokens/    Shared CSS custom properties (warm orange-on-stone palette)
      tokens.css      Light/dark mode color tokens, typography, spacing, layout
    pod-server/       Hono server that runs inside each project pod
      src/
        routes/       API routes (files, sessions, active-sessions, git, health, rebuild, ws)
        session-manager.ts  Background query persistence and multi-client broadcasting
        app.ts        Hono app factory (createApp)
        index.ts      Entrypoint (server + async setup + dev server supervisor)
        dev-server.ts DevServerSupervisor class
        setup.ts      Workspace setup (async git clone, dependency install, post-commit hook)
        setup-state.ts Setup phase tracking (initializing -> cloning -> installing -> building -> starting_server -> ready)
        build-state.ts Build state tracking (lastBuiltCommit, isBuilding, lastBuildError)
        record-initial-commit.ts Records HEAD commit as initial built commit after setup
        spawn-async.ts Shared async spawn utility
      scripts/
        entrypoint.sh    Pod startup script (exec's server directly)
        entrypoint-dev.sh Dev startup script (used by Tilt live_update)
  scaffolds/
    nuxt-postgres/    Project template: Nuxt 3 + Postgres (Drizzle)
  deploy/
    helm/portable/    Helm chart for Kubernetes deployment
      templates/      K8s resource templates (deployment, service, ingress, postgres, RBAC, certificate, networkpolicy, NOTES.txt)
      values.yaml     Chart values with comprehensive documentation comments
    dev-values.yaml   Development overrides for local k3d
  docs/               Architecture, development, deployment, and API docs
  ctlptl-config.yaml  Declares k3d cluster + registry for ctlptl
  Tiltfile            Live development via Tilt (builds, deploys, watches)
  .github/
    workflows/        CI and release workflows (ci.yml, release.yml)
  .dockerignore       Shared Docker ignore for both container builds
```

## Tech Stack

- **Main app:** Nuxt 3, Drizzle ORM, `@kubernetes/client-node`, Octokit, Arctic (GitHub OAuth), httpxy (WebSocket proxying), CodeMirror 6 (JS/TS/JSON/CSS/HTML/Vue/Markdown language support, One Dark theme)
- **Pod server:** Hono, `@hono/node-server`, `@hono/node-ws`, `@anthropic-ai/claude-agent-sdk`, fdir
- **Design tokens:** CSS custom properties in `packages/design-tokens/tokens.css` (warm orange-on-stone palette with light/dark mode)
- **Infrastructure:** Kubernetes, Helm, k3d (local), Tilt (live dev), Postgres 16
- **Tooling:** mise (tool management), bun (package manager/runtime), Node.js 22

## Commands

### Root-level commands (run from repo root)

```bash
bun install           # Install all dependencies across the monorepo
bun run build         # Build all packages
bun run test          # Run tests in all packages
bun run lint          # Lint all files (ESLint)
bun run lint:fix      # Lint and auto-fix
bun run format        # Format all files (Prettier)
bun run format:check  # Check formatting without writing
bun run typecheck     # Type-check all packages
```

### Database commands (packages/app)

```bash
bun run --filter @portable/app db:generate   # Generate Drizzle migrations from schema
bun run --filter @portable/app db:push       # Push schema directly to database (dev)
```

Migrations run automatically on server startup via a Nitro plugin (`server/plugins/migrate.ts`). Use `db:generate` after changing `server/db/schema.ts` to create new migration files, or `db:push` for quick iteration during development.

### Package-specific commands

```bash
# Main app (packages/app)
bun run dev:app                              # Run Nuxt dev server
bun run build:app                            # Build Nuxt for production
bun run --filter @portable/app test          # Run app tests

# Pod server (packages/pod-server)
bun run dev:pod-server                       # Run pod server with tsx watch
bun run build:pod-server                     # Build with tsup
bun run --filter @portable/pod-server test   # Run pod-server tests
```

### Local development (K8s)

```bash
mise install                          # Install Node.js, bun, kubectl, helm, k3d, tilt, ctlptl
mise start                            # Create cluster, install ingress, tilt up
# Open http://portable.127.0.0.1.nip.io
mise stop                             # Tear down cluster
```

## Testing

- **Framework:** Vitest across all packages
- **Methodology:** Test-driven development (red-green-refactor)
- **App tests:** `@nuxt/test-utils` for server route testing, `happy-dom` as environment
- **Pod server tests:** Direct Hono `app.request()` invocation

Test files live in `tests/` directories within each package. Name test files `*.test.ts`.

Run all tests: `bun run test`

## Code Conventions

- **Language:** TypeScript everywhere (strict mode)
- **Module system:** ESM (`"type": "module"` in all packages)
- **Linting:** ESLint with `@antfu/eslint-config` (flat config), Vue + TypeScript support, Prettier for formatting
- **Formatting:** Prettier with double quotes, semicolons, trailing commas, 100 char print width
- **Imports:** Use `type` keyword for type-only imports (`import { type Foo } from ...`)
- **Unused variables:** Prefix with `_` to suppress warnings
- **Pre-commit:** Husky + lint-staged runs ESLint fix and Prettier on staged files

## Authentication and Sessions

The main app uses GitHub OAuth via Arctic for authentication:

- **OAuth flow:** `GET /auth/github` redirects to GitHub, `GET /auth/github/callback` handles the callback (upserts user, creates session, sets cookie), `POST /auth/logout` destroys the session
- **Session management:** Sessions are stored in the `sessions` table with a 30-day expiry. A server middleware (`server/middleware/auth.ts`) validates the `portable_session` cookie on every request and attaches the user to `event.context.user`
- **Client-side auth:** The `useAuth()` composable provides reactive `user` state, `refresh()`, and `logout()`. A global route middleware (`middleware/auth.global.ts`) redirects unauthenticated users to `/login` and authenticated users away from `/login`
- **API auth check:** `GET /api/auth/me` returns the current user or 401

## Database

- **ORM:** Drizzle ORM with `postgres.js` driver
- **Schema:** Defined in `packages/app/server/db/schema.ts` (tables: `users`, `projects`, `sessions`)
- **Migrations:** Generated via `drizzle-kit generate`, stored in `server/db/migrations/`, applied automatically on startup
- **Connection:** `useDb()` utility in `server/utils/db.ts` creates a singleton Drizzle instance from `DATABASE_URL`

## Runtime Config (Environment Variables)

The Nuxt app uses `runtimeConfig` for server-only configuration. Set these via `NUXT_` prefixed env vars:

| Environment Variable               | Runtime Config Key         | Description                                                         |
| ---------------------------------- | -------------------------- | ------------------------------------------------------------------- |
| `DATABASE_URL`                     | (direct env)               | Postgres connection string                                          |
| `NUXT_GITHUB_CLIENT_ID`            | `githubClientId`           | GitHub OAuth App client ID                                          |
| `NUXT_GITHUB_CLIENT_SECRET`        | `githubClientSecret`       | GitHub OAuth App client secret                                      |
| `NUXT_ENCRYPTION_KEY`              | `encryptionKey`            | 32-byte hex key for AES-256-GCM encryption                          |
| `NUXT_BASE_URL`                    | `baseUrl`                  | Public URL of the app (for OAuth callbacks)                         |
| `NUXT_POD_NAMESPACE`               | `podNamespace`             | K8s namespace for project pods (default: `default`)                 |
| `NUXT_POD_SERVER_IMAGE`            | `podServerImage`           | Docker image for pod-server (default: `portable/pod-server:latest`) |
| `NUXT_POD_RESOURCE_CPU_REQUEST`    | `podResourceCpuRequest`    | Pod CPU request (default: `500m`)                                   |
| `NUXT_POD_RESOURCE_CPU_LIMIT`      | `podResourceCpuLimit`      | Pod CPU limit (default: `2000m`)                                    |
| `NUXT_POD_RESOURCE_MEMORY_REQUEST` | `podResourceMemoryRequest` | Pod memory request (default: `512Mi`)                               |
| `NUXT_POD_RESOURCE_MEMORY_LIMIT`   | `podResourceMemoryLimit`   | Pod memory limit (default: `4Gi`)                                   |
| `NUXT_POD_STORAGE_SIZE`            | `podStorageSize`           | PVC size for project workspaces (default: `5Gi`)                    |
| `NUXT_ALLOWED_USERS`               | `allowedUsers`             | Comma-separated GitHub usernames allowed to sign up (empty = all)   |

## Credential Encryption

Sensitive credentials (GitHub tokens, Anthropic API keys) are encrypted at rest using AES-256-GCM. The `encrypt()` and `decrypt()` functions in `server/utils/crypto.ts` use a 32-byte hex key from `NUXT_ENCRYPTION_KEY`. Encrypted values are stored as `iv:tag:ciphertext` (base64-encoded components).

## Kubernetes Integration

The main app manages project pods via `@kubernetes/client-node`. All K8s utilities are in `server/utils/`:

- **`k8s.ts`** -- Low-level K8s operations: `createProjectPod`, `createProjectService`, `createProjectPVC`, `waitForPodReady` (300s timeout), `deleteProjectPod`, `deleteProjectService`, `deleteProjectPVC`. Reads config from `NUXT_POD_*` env vars with sensible defaults. Uses `KubeConfig.loadFromCluster()` (expects to run inside K8s). Resources are named `project-<slug>` and labeled with `app.kubernetes.io/managed-by: portable` and `portable.dev/project: <slug>`.
- **`project-db.ts`** -- Per-project Postgres database management: `createProjectDatabase` creates a database named `portable_<slug>`, `deleteProjectDatabase` drops it. Uses the main `DATABASE_URL` connection to run admin SQL. `buildProjectDatabaseUrl` constructs the per-project connection string.
- **`project-lifecycle.ts`** -- High-level orchestration: `createProject` (creates per-project DB; for scaffold projects: creates GitHub repo, pushes scaffold files; for imported repos: skips repo creation since `repoUrl` is already set), `startProject` (validates state, creates DB + PVC + pod + service, waits for ready, sets status to running), `stopProject` (deletes pod + service, keeps PVC, sets status to stopped), `deleteProject` (cleans up all K8s resources + per-project DB + DB row, does NOT delete GitHub repo). Handles AlreadyExists errors for retry safety and rolls back on failure.

### Per-Project Databases

Each project gets its own Postgres database in the shared instance, named `portable_<slug>`. The connection string is injected into the pod as `DATABASE_URL`. Databases are created on project start and dropped on project delete.

### Project Creation API

Projects can be created in two ways via `POST /api/projects`:

- **From scaffold:** `{ name, scaffoldId }` -- Creates a new GitHub repo, pushes scaffold template files, then marks the project as stopped. The `scaffoldId` references a template from the `scaffolds/` directory.
- **Import existing repo:** `{ name, repoUrl }` -- Imports an existing GitHub repository. Only creates the per-project database (skips GitHub repo creation and scaffold push). The `repoUrl` is stored on the project row and passed to the pod as `GITHUB_REPO_URL` on start.

The `scaffoldId` column in the `projects` table is nullable: `null` indicates an imported repository.

`GET /api/github/repos` lists the authenticated user's GitHub repositories (up to 100, sorted by most recently updated). Supports a `search` query parameter for client-side filtering by name, full name, or description. Returns `{ repos: [{ name, fullName, description, isPrivate, language, defaultBranch, url }] }`.

## Reverse Proxy and Pod Access

### Path-Based Pod Proxy

The editor UI (now part of the main Nuxt app) accesses pod APIs through path-based routing:

- **`server/routes/api/projects/[slug]/pod/[...path].ts`** -- Catch-all route handler that proxies HTTP requests to the pod server. Validates auth, verifies project ownership and running status, then proxies to `http://project-<slug>.<ns>.svc.cluster.local:3000/<path>`. Used for file API, sessions API, git API, etc.
- **`server/plugins/proxy.ts`** -- Nitro plugin that intercepts WebSocket upgrade requests at `/api/projects/:slug/pod/ws` and proxies them to the pod's `/ws` endpoint via `httpxy`. Also handles preview subdomain proxying (both HTTP and WebSocket).

| Path/Host pattern                        | Target                                                         |
| ---------------------------------------- | -------------------------------------------------------------- |
| `/api/projects/:slug/pod/*` (HTTP)       | Pod server at `project-<slug>.<ns>.svc.cluster.local:3000`     |
| `/api/projects/:slug/pod/ws` (WebSocket) | Pod WebSocket at `project-<slug>.<ns>.svc.cluster.local:3000`  |
| `<slug>--preview--portable.example.com`  | Pod dev server at `project-<slug>.<ns>.svc.cluster.local:3001` |

### Preview Subdomain Proxy

Preview subdomains route to the pod's dev server (port 3001). The proxy layer consists of:

- **`server/utils/proxy-shared.ts`** -- Pure utility functions: `getDomainFromBaseUrl`, `parseSubdomain` (parses Host header, only recognizes preview subdomains), `buildProxyTarget` (constructs K8s service URL for port 3001), `parseCookie`.
- **`server/utils/proxy.ts`** -- DB-dependent proxy logic: `lookupProject` (queries the DB for the project), `resolveProxyTarget` (orchestrates auth + lookup + target building). Returns null for main app domain requests. Throws 401 for unauthenticated requests, 404 for unknown projects, 503 for non-running projects.
- **`server/plugins/proxy.ts`** -- Nitro plugin that hooks into the `request` event to intercept preview subdomain requests before Vite's dev middleware. Manually validates session cookies and proxies both HTTP and WebSocket connections via `httpxy`.

### Startup Recovery

The `server/plugins/recovery.ts` plugin runs on server startup and resets any projects stuck in transitional states (`creating`, `starting`, `stopping`) -- typically caused by a previous server crash. It cleans up orphaned K8s resources and resets project status to `stopped` or `error`.

## Pod Server

The pod server (`packages/pod-server`) is a Hono HTTP/WebSocket server that runs inside each project pod. It provides file access, session management, git operations, and a WebSocket bridge to the Claude Agent SDK. The pod server does not serve any static files -- all UI is served by the main Nuxt app. It is built with `createApp()` in `src/app.ts`, which returns the Hono app and a `registerWsRoute` function for injecting the WebSocket upgrade helper.

### File API

`src/routes/files.ts` provides three endpoints for workspace file access:

- `GET /api/files` -- Returns a sorted list of relative file paths in the workspace, crawled with `fdir`. Excludes `node_modules`, `.git`, `.nuxt`, `.output`, `dist`, `coverage`, and other build directories.
- `GET /api/files/:path` -- Returns the UTF-8 content of a single file. Returns 404 for missing files, 400 for directories, 403 for path traversal attempts.
- `PUT /api/files/:path` -- Writes the request body to a file. Creates parent directories if needed. Returns 403 for path traversal attempts.

All file operations are scoped to `WORKSPACE_DIR` (default `/workspace`). Path traversal is prevented by resolving the path and checking it starts with the workspace directory.

### Sessions API

`src/routes/sessions.ts` provides three endpoints for conversation session management, powered by the Claude Agent SDK:

- `GET /api/sessions` -- Lists all conversation sessions stored in the workspace, sorted by most recent first. Each session includes `sessionId`, `title` (derived from custom title, summary, or first prompt), `lastModified` (Unix timestamp), and `firstPrompt` (the initial user message or null).
- `GET /api/sessions/:id/messages` -- Retrieves all messages in a session, filtered to user and assistant messages only. Each message includes `role` (`"user"` or `"assistant"`), `content` (concatenated text blocks), and optional `toolUse` array containing tool calls with `name` and `input` (JSON-formatted). Extracts and structures content from the Claude Agent SDK message format.
- `DELETE /api/sessions/:id` -- Deletes a session file. Validates the session ID format (UUID) and checks that the session exists before deletion. Returns 204 on success, 400 if the ID is invalid, or 404 if the session is not found.

### Active Sessions API

`src/routes/active-sessions.ts` provides an endpoint for checking which sessions have active background queries:

- `GET /api/sessions/active` -- Returns `{ activeSessionIds: [...] }` containing the SDK session IDs of all sessions currently running a query. Used by the editor to show activity indicators on the session list.

Session data is stored in `~/.claude/projects/<project-name>/<sessionId>.jsonl` (or `$CLAUDE_CONFIG_DIR/projects/...` if configured). The API searches across all project directories to locate session files by ID. All operations use the Claude Agent SDK's `listSessions()` and `getSessionMessages()` functions.

### Session Manager

`src/session-manager.ts` manages background query persistence and multi-client broadcasting. Key features:

- **Background queries:** Queries continue running even after all WebSocket clients disconnect. A 30-second cleanup timer allows reconnection without losing the active query.
- **Multi-client broadcasting:** Multiple WebSocket clients can attach to the same session. SDK events are broadcast to all connected clients.
- **Event buffering:** Events from the current query are buffered so reconnecting clients receive a replay of events they missed (sent between `replay_start` and `replay_end` markers).
- **Session lookup:** Sessions are indexed by both an internal ID and the SDK session ID, allowing reconnection by SDK session ID.

### WebSocket Bridge

`src/routes/ws.ts` is a thin WebSocket bridge that delegates to the session manager at `GET /ws`.

**Connection URL:** `GET /ws` or `GET /ws?session=<sessionId>` to resume or reconnect to a session. If a background session with the given SDK session ID exists, the client reconnects to it. Otherwise a new session is created (with the SDK session ID passed for resume mode).

**Inbound messages (browser to server):**

- `{ "type": "user_message", "content": "..." }` -- Delegates to `sendMessage()` on the session manager. If a query is active, it is interrupted and the new message is queued.
- `{ "type": "interrupt" }` -- Delegates to `interruptQuery()` on the session manager.

**Outbound messages (server to browser):**

- `{ "type": "query_start" }` -- Sent when a query begins.
- `{ "type": "sdk_event", "event": ... }` -- Claude Agent SDK streaming events (text deltas, tool use, etc.).
- `{ "type": "query_end" }` -- Sent when a query finishes.
- `{ "type": "session_info", "sessionId": "..." }` -- Sent after the first query completes. Contains the SDK session ID for persistence and reconnection.
- `{ "type": "replay_start" }` / `{ "type": "replay_end" }` -- Bracket replayed events when a client reconnects to a session with buffered events.
- `{ "type": "error", "message": "..." }` -- Error messages (invalid JSON, SDK errors, unknown message types).

The SDK is invoked via `query()` from `@anthropic-ai/claude-agent-sdk` with `permissionMode: "bypassPermissions"` and `settingSources: ["project"]`. The working directory is set to `WORKSPACE_DIR`.

### Git API

`src/routes/git.ts` provides two endpoints for workspace git state:

- `GET /api/git` -- Returns the current git status of the workspace. Response includes `branch` (current branch name), `commits` (last 50 commits with `hash`, `shortHash`, `message`, `author`, `date`), `staged` (files staged in the index with `path` and `status`), and `unstaged` (modified/untracked files with `path` and `status`). Status labels are human-readable: `modified`, `added`, `deleted`, `renamed`, `copied`, `untracked`. Returns 500 if the workspace is not a git repository.
- `GET /api/git/diff/:path` -- Returns the git diff for a specific file. Accepts a `?staged=true` query parameter to show staged changes instead of unstaged. For untracked files, generates a diff against `/dev/null`. Returns 404 if no changes exist for the file.

### Rebuild API

`src/routes/rebuild.ts` provides build management with debounce support:

- `POST /api/rebuild` -- Triggers a workspace build (`bun run build`). On success, records the HEAD commit via `setLastBuiltCommit()`, clears errors, and restarts the dev server supervisor. On failure, stores the error message. Returns `200 { status: "ok" }` on success, `500 { status: "error", message }` on failure. Accepts optional `?debounce=<ms>` query parameter: with debounce, resets a server-side timer and returns `202 { status: "scheduled" }`. If a build is already in progress, queues a pending rebuild and returns `202 { status: "queued" }`.
- `GET /api/rebuild/status` -- Returns build state: `{ lastBuiltCommit, currentHead, isDirty, isBuilding, lastBuildError, unbuiltCommitCount }`. Uses `git rev-parse HEAD`, `git status --porcelain`, and `git rev-list --count` to compute values.

Build state is tracked in `src/build-state.ts` (module-level state, same pattern as `setup-state.ts`).

### Git Post-Commit Hook

`src/setup.ts` exports `installPostCommitHook()`, called during workspace setup after `.gitignore` setup. Installs `.git/hooks/post-commit` that triggers a debounced rebuild (`curl -s -X POST http://localhost:3000/api/rebuild?debounce=3000 &`) and auto-pushes (`git push &`). Idempotent: skips if hook already contains `/api/rebuild`.

### Dev Server Supervisor

`src/dev-server.ts` exports the `DevServerSupervisor` class, which manages the project's dev server (e.g., Nuxt, Vite) as a child process.

- **Auto-restart:** Automatically restarts the dev server if it crashes.
- **Exponential backoff:** Restart delay starts at 1 second and doubles on each consecutive crash, capped at 30 seconds. Backoff resets after the process runs stably for 10 seconds.
- **Graceful shutdown:** On `stop()`, sends SIGTERM to the child process and cancels any pending restart timer.
- **Port injection:** Sets `PORT=3001` in the child process environment.

The supervisor is started in `src/index.ts` after the Hono server begins listening and async workspace setup completes. The startup order is: start HTTP server (health endpoint available immediately), run async setup (cloning, installing), set phase to `starting_server`, start dev server supervisor, set phase to `ready`. The command defaults to `DEV_SERVER_COMMAND` env var (or `bun run dev`).

### Setup Phase Tracking

`src/setup-state.ts` maintains the current setup phase as module-level state. The `getPhase()` and `setPhase()` functions track progress through six phases: `initializing`, `cloning`, `installing`, `building`, `starting_server`, and `ready`. The health endpoint reads the current phase to report setup progress.

### Workspace Setup

`src/setup.ts` exports `setupWorkspace()`, which is an async function that runs these steps using spawned child processes (not synchronous exec):

1. **Git clone** -- If the workspace directory is empty (ignoring `lost+found`) and `GITHUB_REPO_URL` is set, calls `setPhase("cloning")` and clones the repo. If `GITHUB_TOKEN` is available, it is injected into the clone URL for authentication.
2. **Gitignore + post-commit hook** -- Ensures `.claude/` is in `.gitignore`, then installs the git post-commit hook for auto-rebuild and push.
3. **Dependency install** -- If `node_modules` is missing, calls `setPhase("installing")` and runs `bun install`. Bun natively reads all lockfile formats (package-lock.json, yarn.lock, pnpm-lock.yaml, bun.lock).
4. **Build** -- Runs the configured build command (default: `bun run build`), sets phase to `building`.

After setup, `recordInitialBuiltCommit()` runs `git rev-parse HEAD` and stores the result as the initial built commit in build state.

### Entrypoint

`scripts/entrypoint.sh` is the pod container entrypoint. It exec's `node dist/index.js` directly -- workspace setup is handled asynchronously by the server process itself (in `src/index.ts`), not by the entrypoint script.

### Pod Server Environment Variables

| Variable                  | Description                                     | Default       |
| ------------------------- | ----------------------------------------------- | ------------- |
| `WORKSPACE_DIR`           | Path to the project workspace                   | `/workspace`  |
| `GITHUB_REPO_URL`         | Git repo URL for initial clone                  | (none)        |
| `GITHUB_TOKEN`            | GitHub token for authenticated clone            | (none)        |
| `DEV_SERVER_COMMAND`      | Command to start the project's dev server       | `bun run dev` |
| `PORT`                    | Hono server listen port                         | `3000`        |
| `DATABASE_URL`            | Connection string for the project's Postgres DB | (none)        |
| `ANTHROPIC_API_KEY`       | User's Anthropic API key (injected by main app) | (none)        |
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token for Claude (alternative to API key) | (none)        |

## Editor UI (Integrated in Main App)

The editor UI is integrated into the main Nuxt app as pages and composables under `packages/app`. When a project is running, the `/projects/[slug]` page renders a project layout with a bottom tab bar for navigating between Chat, Files, Git, and App views. All pod communication goes through the path-based pod proxy (`/api/projects/:slug/pod/*`). The app uses a warm orange-on-stone design with CSS custom properties from `packages/design-tokens/tokens.css`.

### Project Layout

The `layouts/project.vue` layout provides the project chrome: a top bar with project name and back button, plus a bottom tab bar with four tabs (Chat, Files, Git, App). The App tab (globe icon) shows the app URL, an Open button, build status indicators (polling every 5s), and a Rebuild button. The layout is used by the `pages/projects/[slug].vue` parent page, which handles project lifecycle states (loading, stopped, creating, starting, error) and renders child pages via `<NuxtPage />` when the project is running.

### Composables

All editor composables live in `packages/app/composables/`:

- **`useWebSocket.ts`** -- Manages WebSocket connection to the pod via `/api/projects/:slug/pod/ws`. Sends `user_message` and `interrupt` messages, processes incoming events (`query_start`, `sdk_event`, `query_end`, `session_info`, `replay_start`, `replay_end`, `error`). Reconnects automatically on disconnect. Supports session resumption by passing a `sessionId` query parameter.
- **`useSessions.ts`** -- Fetches and manages conversation sessions via `/api/projects/:slug/pod/api/sessions`. Provides reactive `sessions` array, `fetchSessions()`, `loadMessages(sessionId)`, `deleteSession(sessionId)`, and active session detection.
- **`useFiles.ts`** -- Workspace file operations via `/api/projects/:slug/pod/api/files`. Fetches flat file list, builds nested tree structure, reads and writes file content.
- **`useGit.ts`** -- Git state via `/api/projects/:slug/pod/api/git`. Provides branch, staged/unstaged changes, commit history, and file diffs via `/api/projects/:slug/pod/api/git/diff/:path`.

### Onboarding

The `/onboarding` page provides a wizard for first-time setup of the Anthropic API key and AGE encryption key, required before creating projects.

## Architecture Summary

The main app (Nuxt) handles authentication (GitHub OAuth), project CRUD, Kubernetes pod lifecycle, the editor UI, and acts as a reverse proxy. The editor UI is served as Nuxt pages within the main app, communicating with pods through path-based API proxying (`/api/projects/:slug/pod/*`). Each project gets its own K8s pod running the pod server (Hono), which provides file access APIs, session management with background query persistence, and a WebSocket bridge to the Claude Agent SDK. Preview subdomains (`<project>--preview--<appLabel>.domain`) route to the pod's dev server.

See `docs/architecture.md` for the full architecture diagram and component details.

## Health Checks

**Main app:** `GET /api/health` verifies database connectivity by running `SELECT 1`. Returns `{ status: "ok" }` on success or 503 when the database is unavailable. The Helm deployment uses two distinct probes:

- **Liveness probe:** TCP socket check on the HTTP port. This avoids restarting the pod when only the database is temporarily unavailable.
- **Readiness probe:** HTTP GET to `/api/health`. Removes the pod from service endpoints when the database is unreachable, so traffic is not routed to an unhealthy instance.

**Pod server:** `GET /health` reports the pod's setup phase. During setup, returns 503 with `{ status: "setting_up", phase: "<current_phase>" }` where phase is one of `initializing`, `cloning`, `installing`, or `starting_server`. Once setup completes, returns 200 with `{ status: "ok", phase: "ready" }`. The HTTP server starts immediately on pod creation (before workspace setup), so the health endpoint is available throughout the entire startup process. This enables the main app to poll for setup progress and display it on the dashboard.

**Startup progress on dashboard:** The main app exposes `GET /api/projects/:slug/status` which queries the pod's `/health` endpoint and returns the current setup phase. The `ProjectCard` component polls this endpoint every 2 seconds when a project's status is `starting`, displaying human-readable phase text (e.g., "Cloning repository...", "Installing dependencies...").

## Security

All containers run with security contexts that drop all Linux capabilities, set a read-only root filesystem, and prevent privilege escalation (`allowPrivilegeEscalation: false`, `runAsNonRoot: true`). This applies to the main app deployment, the Postgres StatefulSet, and dynamically created project pods. The Dockerfiles for both the main app and pod-server create and switch to a non-root user.

A NetworkPolicy (`deploy/helm/portable/templates/networkpolicy.yaml`) isolates project pods: they can only receive ingress from the main app pod and can only make DNS queries and egress to the internet. Pod-to-pod traffic between different projects is denied.

## Key Design Decisions

- Everything runs inside K8s (even locally via k3d) -- no host processes outside the cluster
- Single wildcard ingress on the main app handles all subdomain routing
- Pods have no auth logic; all requests are validated by the main app proxy
- Per-project Postgres databases are created in the shared instance
- Credentials (Anthropic API keys) are stored AES-256-GCM encrypted
