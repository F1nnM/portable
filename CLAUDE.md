# Portable -- Codebase Guide

## Project Overview

Portable is a mobile-first web application for using Claude Code remotely. Users create projects from scaffolds, each running in an isolated Kubernetes pod with Claude Code, a dev server, and a file browser -- all accessible through a mobile-optimized web UI.

## Repository Structure

```
portable/
  packages/
    app/              Nuxt 3 full-stack main app (auth, project management, proxy)
      server/
        api/          API endpoints (health, auth/me, settings/credential, projects CRUD, projects status, scaffolds)
        routes/       Route handlers (auth/github, auth/logout)
        middleware/   Server middleware (session auth, subdomain proxy)
        db/           Drizzle schema and migrations
        plugins/      Nitro plugins (auto-migration on startup, WebSocket proxy)
        utils/        Shared server utilities (db, auth, crypto, slug, github, k8s, project-db, project-lifecycle, proxy)
      composables/    Vue composables (useAuth)
      components/     Vue components (ProjectCard)
      middleware/     Client-side route middleware (auth guard)
      layouts/        App layouts (default with topbar + bottom nav)
      pages/          Vue pages (login, dashboard, settings, new)
      types/          Shared TypeScript interfaces (Project)
    pod-server/       Hono server that runs inside each project pod
      src/
        routes/       API routes (files, sessions, health, ws)
        app.ts        Hono app factory (createApp)
        index.ts      Entrypoint (server + async setup + dev server supervisor)
        dev-server.ts DevServerSupervisor class
        setup.ts      Workspace setup (async git clone, dependency install)
        setup-state.ts Setup phase tracking (initializing -> cloning -> installing -> starting_server -> ready)
      scripts/
        entrypoint.sh    Pod startup script (exec's server directly)
        entrypoint-dev.sh Dev startup script (used by Tilt live_update)
    editor/           Vue 3 SPA served by the pod server (chat, files, preview)
      src/
        views/        Route views (ChatView, FilesView, PreviewView)
        components/   UI components (ChatMessage, ChatInput, FileTree, CodeViewer)
        composables/  Vue composables (useWebSocket, useSessions, useFiles)
        router.ts     Vue Router with /chat, /files, /preview routes
        App.vue       Root layout with bottom tab bar navigation
        main.ts       Entrypoint (creates Vue app with router)
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

- **Main app:** Nuxt 3, Drizzle ORM, `@kubernetes/client-node`, Octokit, Arctic (GitHub OAuth), httpxy (WebSocket proxying)
- **Pod server:** Hono, `@hono/node-server`, `@hono/node-ws`, `@anthropic-ai/claude-agent-sdk`, fdir
- **Editor SPA:** Vue 3, Vue Router, Vite, CodeMirror 6 (JS/TS/JSON/CSS/HTML/Markdown language support, One Dark theme)
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

# Editor SPA (packages/editor)
bun run dev:editor                           # Run Vite dev server
bun run build:editor                         # Build with Vite
bun run --filter @portable/editor test       # Run editor tests
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
- **Editor tests:** `@vue/test-utils` with `jsdom`

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

## Credential Encryption

Sensitive credentials (GitHub tokens, Anthropic API keys) are encrypted at rest using AES-256-GCM. The `encrypt()` and `decrypt()` functions in `server/utils/crypto.ts` use a 32-byte hex key from `NUXT_ENCRYPTION_KEY`. Encrypted values are stored as `iv:tag:ciphertext` (base64-encoded components).

## Kubernetes Integration

The main app manages project pods via `@kubernetes/client-node`. All K8s utilities are in `server/utils/`:

- **`k8s.ts`** -- Low-level K8s operations: `createProjectPod`, `createProjectService`, `createProjectPVC`, `waitForPodReady` (300s timeout), `deleteProjectPod`, `deleteProjectService`, `deleteProjectPVC`. Reads config from `NUXT_POD_*` env vars with sensible defaults. Uses `KubeConfig.loadFromCluster()` (expects to run inside K8s). Resources are named `project-<slug>` and labeled with `app.kubernetes.io/managed-by: portable` and `portable.dev/project: <slug>`.
- **`project-db.ts`** -- Per-project Postgres database management: `createProjectDatabase` creates a database named `portable_<slug>`, `deleteProjectDatabase` drops it. Uses the main `DATABASE_URL` connection to run admin SQL. `buildProjectDatabaseUrl` constructs the per-project connection string.
- **`project-lifecycle.ts`** -- High-level orchestration: `startProject` (validates state, creates DB + PVC + pod + service, waits for ready, sets status to running), `stopProject` (deletes pod + service, keeps PVC, sets status to stopped), `deleteProject` (cleans up all K8s resources + per-project DB + DB row, does NOT delete GitHub repo). Handles AlreadyExists errors for retry safety and rolls back on failure.

### Per-Project Databases

Each project gets its own Postgres database in the shared instance, named `portable_<slug>`. The connection string is injected into the pod as `DATABASE_URL`. Databases are created on project start and dropped on project delete.

## Reverse Proxy

The main app acts as a reverse proxy for all subdomain traffic. The proxy layer consists of three files:

- **`server/utils/proxy.ts`** -- Shared proxy logic: `getDomainFromBaseUrl` (extracts hostname from the configured base URL), `parseSubdomain` (parses the Host header to extract project slug and access type), `buildProxyTarget` (constructs the K8s service URL), `lookupProject` (queries the DB for the project), `resolveProxyTarget` (orchestrates auth + lookup + target building). Returns null for main app domain requests so Nuxt handles them normally. Throws 401 for unauthenticated subdomain requests, 404 for unknown projects, 503 for non-running projects.
- **`server/middleware/proxy.ts`** -- Nitro HTTP middleware that intercepts subdomain requests and proxies them via `h3.proxyRequest`. Runs after the auth middleware (which attaches `event.context.user`), so session validation is already done. Forwards the original path and sets `x-forwarded-host`.
- **`server/plugins/ws-proxy.ts`** -- Nitro plugin that hooks into the `request` event to intercept WebSocket upgrade requests before the normal HTTP pipeline. Manually parses the session cookie and validates it (since the auth middleware does not run for WebSocket upgrades in Nitro plugins). Uses `httpxy.proxyUpgrade` to proxy the WebSocket connection to the pod. Destroys the socket on auth/project errors.

### Subdomain Routing

| Host pattern                           | Target                                                         |
| -------------------------------------- | -------------------------------------------------------------- |
| `portable.example.com` (bare domain)   | Main app (Nuxt handles normally)                               |
| `<slug>.portable.example.com`          | Pod editor at `project-<slug>.<ns>.svc.cluster.local:3000`     |
| `<slug>--preview.portable.example.com` | Pod dev server at `project-<slug>.<ns>.svc.cluster.local:3001` |

### Middleware Ordering

The auth middleware (`server/middleware/auth.ts`) runs before the proxy middleware (`server/middleware/proxy.ts`) due to Nitro's alphabetical middleware ordering. This ensures `event.context.user` is populated before the proxy middleware checks authentication. The WebSocket proxy plugin handles its own auth since Nitro plugins run outside the middleware chain.

## Pod Server

The pod server (`packages/pod-server`) is a Hono HTTP/WebSocket server that runs inside each project pod. It is built with `createApp()` in `src/app.ts`, which returns the Hono app and a `registerWsRoute` function for injecting the WebSocket upgrade helper.

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

Session data is stored in `~/.claude/projects/<project-name>/<sessionId>.jsonl` (or `$CLAUDE_CONFIG_DIR/projects/...` if configured). The API searches across all project directories to locate session files by ID. All operations use the Claude Agent SDK's `listSessions()` and `getSessionMessages()` functions.

### WebSocket Bridge

`src/routes/ws.ts` bridges the browser to the Claude Agent SDK via WebSocket at `GET /ws`.

**Connection URL:** `GET /ws` or `GET /ws?session=<sessionId>` to resume a previous session. When a `sessionId` query parameter is provided, the first query on the connection uses `resume` mode to restore the session state.

**Inbound messages (browser to server):**

- `{ "type": "user_message", "content": "..." }` -- Starts a new Claude query. If a query is already active, the current query is interrupted and the new message is queued as a pending prompt.
- `{ "type": "interrupt" }` -- Interrupts the current active query.

**Outbound messages (server to browser):**

- `{ "type": "query_start" }` -- Sent when a query begins.
- `{ "type": "sdk_event", "event": ... }` -- Claude Agent SDK streaming events (text deltas, tool use, etc.).
- `{ "type": "query_end" }` -- Sent when a query finishes.
- `{ "type": "session_info", "sessionId": "..." }` -- Sent after the first query completes (if a session was created or resumed). Contains the session ID for resuming future conversations.
- `{ "type": "error", "message": "..." }` -- Error messages (invalid JSON, SDK errors, unknown message types).

**Session handling:** The connection tracks session state internally. The first query uses `resume` mode if a `sessionId` was provided in the URL query parameter, or starts fresh otherwise. Subsequent queries on the same connection use `continue` mode to extend the conversation history within the session. The `session_info` message is sent after the first query completes, containing the session ID for persistence and future resumption.

The SDK is invoked via `query()` from `@anthropic-ai/claude-agent-sdk` with `permissionMode: "bypassPermissions"` and `settingSources: ["project"]`. The working directory is set to `WORKSPACE_DIR`.

### Dev Server Supervisor

`src/dev-server.ts` exports the `DevServerSupervisor` class, which manages the project's dev server (e.g., Nuxt, Vite) as a child process.

- **Auto-restart:** Automatically restarts the dev server if it crashes.
- **Exponential backoff:** Restart delay starts at 1 second and doubles on each consecutive crash, capped at 30 seconds. Backoff resets after the process runs stably for 10 seconds.
- **Graceful shutdown:** On `stop()`, sends SIGTERM to the child process and cancels any pending restart timer.
- **Port injection:** Sets `PORT=3001` in the child process environment.

The supervisor is started in `src/index.ts` after the Hono server begins listening and async workspace setup completes. The startup order is: start HTTP server (health endpoint available immediately), run async setup (cloning, installing), set phase to `starting_server`, start dev server supervisor, set phase to `ready`. The command defaults to `DEV_SERVER_COMMAND` env var (or `bun run dev`).

### Setup Phase Tracking

`src/setup-state.ts` maintains the current setup phase as module-level state. The `getPhase()` and `setPhase()` functions track progress through five phases: `initializing`, `cloning`, `installing`, `starting_server`, and `ready`. The health endpoint reads the current phase to report setup progress.

### Workspace Setup

`src/setup.ts` exports `setupWorkspace()`, which is an async function that runs two steps using spawned child processes (not synchronous exec):

1. **Git clone** -- If the workspace directory is empty (ignoring `lost+found`) and `GITHUB_REPO_URL` is set, calls `setPhase("cloning")` and clones the repo. If `GITHUB_TOKEN` is available, it is injected into the clone URL for authentication.
2. **Dependency install** -- If `node_modules` is missing, calls `setPhase("installing")` and runs `bun install`. Bun natively reads all lockfile formats (package-lock.json, yarn.lock, pnpm-lock.yaml, bun.lock).

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

## Editor SPA

The editor SPA (`packages/editor`) is a Vue 3 single-page application served by the pod server at the root URL. It provides three views accessible via a bottom tab bar: Chat, Files, and Preview. The app uses a dark theme with CSS variables (`#0d1117` background, `#58a6ff` accent) and a mobile-first `100dvh` layout.

### Routing

Vue Router with three routes: `/chat` (default), `/files`, and `/preview`. The bottom tab bar shows SVG icons for each tab with an active state indicator (top border highlight). Navigation is handled via `<router-link>`.

### Chat View

The chat tab has two states: a session list (default) and an active chat conversation.

**Session list state:**

- **SessionList component:** Displays saved conversation sessions in a scrollable list sorted by most recent. Each session shows the title (derived from custom title or first prompt), last modified time in relative format (e.g., "2m ago"), and a delete button. A "Conversations" header with a "+" button allows starting a new conversation. Empty state shows "No conversations yet" with a call-to-action button.

**Chat state:**

- **WebSocket composable (`composables/useWebSocket.ts`):** Manages connection lifecycle to the pod server's WebSocket bridge at `/ws`. Sends `user_message` and `interrupt` messages, processes incoming `query_start`, `sdk_event`, `query_end`, `session_info`, and `error` messages. Reconnects automatically after 2 seconds on disconnect. Accepts optional `sessionId` and `initialMessages` parameters to resume previous conversations. Exposes reactive `sessionId` ref that updates when the server responds with session info.
- **Sessions composable (`composables/useSessions.ts`):** Fetches and manages conversation sessions via the pod server's sessions API. Provides `sessions` reactive array (sorted by most recent), `fetchSessions()` to load sessions, `loadMessages(sessionId)` to retrieve messages from a specific session, and `deleteSession(sessionId)` to remove a session. Each session includes `sessionId`, `title` (derived from custom title or first prompt), `lastModified` timestamp, and `firstPrompt` (initial user message or null).
- **ChatMessage component:** Renders user messages and assistant messages. Assistant messages include collapsible tool use blocks (showing tool name + input). Distinguishes between text content and tool use events from the SDK stream.
- **ChatInput component:** Auto-growing `<textarea>` with send and interrupt buttons. Enter sends the message (Shift+Enter for newlines). Shows interrupt button during active queries.
- **Back button:** Top-left button returns to the session list, closes the WebSocket connection, and clears messages.
- **Auto-scroll:** Scrolls to the bottom on new messages. Streaming indicator shows pulsing dots while the assistant is responding.

### Files View

The files view provides workspace file browsing and editing via the `useFiles` composable and the pod server's file API.

- **File API composable (`composables/useFiles.ts`):** Fetches the flat file list from `GET /api/files`, builds a tree structure (nested directories and files), reads file content from `GET /api/files/:path`, and writes via `PUT /api/files/:path`.
- **FileTree component:** Recursive tree rendering with expand/collapse for directories, indent guides, and dimmed file extensions. Clicking a file selects it and triggers content loading.
- **CodeViewer component:** CodeMirror 6 editor with the One Dark theme. Supports language detection for JavaScript, TypeScript, JSON, CSS, HTML, Vue, and Markdown files. Defaults to read-only mode with an edit toggle button. Save button appears in edit mode and calls the file write API. Back navigation returns to the file tree.

### Preview View

Full-screen iframe that loads the project's dev server. The preview hostname is constructed by appending `--preview` to the project slug in the current hostname (e.g., `my-project.domain` becomes `my-project--preview.domain`). This keeps the preview within a single subdomain level so the wildcard ingress matches. Includes a thin header bar with a "Preview" label, the preview URL, and a refresh button. Shows a loading overlay while the iframe is loading.

## Architecture Summary

The main app (Nuxt) handles authentication (GitHub OAuth), project CRUD, Kubernetes pod lifecycle, and acts as an auth-checking reverse proxy. Each project gets its own K8s pod running the pod server (Hono) which serves the editor SPA, provides file access APIs, and bridges WebSocket connections to the Claude Agent SDK. Subdomain routing: `<project>.domain` goes to the editor, `<project>--preview.domain` goes to the dev server.

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
