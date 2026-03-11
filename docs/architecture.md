# Architecture

## High-Level Overview

```
                         +---------------------------+
                         |        Browser            |
                         |  (mobile / desktop)       |
                         +---------------------------+
                                    |
                           HTTPS (wildcard cert)
                                    |
                                    v
                    +-------------------------------+
                    |       Ingress (nginx)         |
                    |   *.example.com               |
                    +-------------------------------+
                                    |
                                    v
                    +-------------------------------+
                    |       Main App (Nuxt 3)       |
                    |                               |
                    |  - GitHub OAuth               |
                    |  - Project CRUD               |
                    |  - K8s pod lifecycle           |
                    |  - Editor UI (Nuxt pages)     |
                    |  - Pod API proxy              |
                    |  - Preview subdomain proxy    |
                    +-------------------------------+
                         |                    |
                         v                    v
              +----------------+    +-------------------+
              |   Postgres     |    |  Project Pod (N)  |
              |   (shared)     |    |                   |
              |                |    |  Hono server:3000 |
              |  - users       |    |  - File API       |
              |  - projects    |    |  - Sessions API   |
              |  - sessions    |    |  - Agent WS       |
              |  - per-project |    |  - Git API        |
              |    databases   |    |                   |
              +----------------+    |  Dev server:3001  |
                                    |  - Nuxt/Vite/etc  |
                                    |                   |
                                    |  PVC (5Gi)        |
                                    +-------------------+
```

## Components

### Main App (`packages/app`)

Nuxt 3 full-stack application. Serves all UI (project management, editor, onboarding) and acts as the single entry point for all traffic.

Key responsibilities:

- **Authentication:** GitHub OAuth via Arctic. Session cookies stored in the `sessions` table. Server middleware validates cookies on every request.
- **Project management:** CRUD operations on projects, stored in Postgres.
- **Editor UI:** Integrated Nuxt pages for chat, files, git, and preview. Uses composables (`useWebSocket`, `useSessions`, `useFiles`, `useGit`) that communicate with pods through the path-based pod proxy.
- **K8s lifecycle:** Creates/deletes pods, PVCs, and headless services via `@kubernetes/client-node`. Manages the full project lifecycle (start/stop/delete) with state transitions, error rollback, and retry-safe AlreadyExists handling. See `server/utils/k8s.ts` (low-level K8s operations), `server/utils/project-db.ts` (per-project database management), and `server/utils/project-lifecycle.ts` (orchestration).
- **GitHub integration:** Creates repos and pushes scaffold files via Octokit.
- **Pod API proxy:** Path-based routing (`/api/projects/:slug/pod/*`) proxies HTTP and WebSocket requests to the pod server. HTTP requests go through a catch-all route handler; WebSocket upgrades are intercepted by a Nitro plugin.
- **Preview subdomain proxy:** Parses the `Host` header to route preview subdomain traffic (`<slug>--preview--<appLabel>.domain`) to the pod's dev server (port 3001). HTTP via `httpxy`, WebSocket via `httpxy.proxyUpgrade`.
- **Credential encryption:** Stores GitHub tokens and Anthropic API keys encrypted with AES-256-GCM.
- **Auto-migration:** Drizzle ORM migrations run automatically on server startup via a Nitro plugin.

### Pod Server (`packages/pod-server`)

Hono HTTP/WebSocket server that runs inside each project pod. Built with `createApp()` factory in `src/app.ts`. Does not serve any static files -- all UI is handled by the main Nuxt app.

Endpoints:

- `GET /health` -- Setup-aware readiness probe: returns 503 with `{ status: "setting_up", phase }` during setup, 200 with `{ status: "ok", phase: "ready" }` when ready
- `GET /ws` -- WebSocket bridge between the browser and the Claude Agent SDK, delegating to the session manager for background query persistence
- `GET /api/files` -- File tree listing (via `fdir`, excludes `node_modules`, `.git`, and other build directories)
- `GET /api/files/:path` -- Read file content (with path traversal protection)
- `PUT /api/files/:path` -- Write file content (with path traversal protection, creates parent directories)
- `GET /api/sessions` -- List conversation sessions
- `GET /api/sessions/:id/messages` -- Retrieve messages for a session
- `DELETE /api/sessions/:id` -- Delete a session
- `GET /api/sessions/active` -- List SDK session IDs with active background queries
- `GET /api/git` -- Git status (branch, commits, staged/unstaged changes)
- `GET /api/git/diff/:path` -- File-level git diff (supports `?staged=true`)

The pod server also manages:

- **Session manager** (`src/session-manager.ts`): Manages background query persistence. Queries continue running after WebSocket clients disconnect, with a 30-second cleanup window. Multiple clients can attach to the same session with event replay on reconnection.
- **Dev server supervisor** (`src/dev-server.ts`): `DevServerSupervisor` class starts the project's dev server as a child process on port 3001. Auto-restarts on crash with exponential backoff (1s to 30s cap). Backoff resets after 10 seconds of stable running. Graceful shutdown via SIGTERM.
- **Setup phase tracking** (`src/setup-state.ts`): Tracks the current setup phase (`initializing` -> `cloning` -> `installing` -> `starting_server` -> `ready`) as module-level state. The health endpoint reads this to report progress.
- **Workspace setup** (`src/setup.ts`): Async function that clones the project's GitHub repo into the PVC if the workspace is empty (using `GITHUB_TOKEN` for authentication), and installs dependencies via `bun install` if `node_modules` is missing. Uses spawned child processes and calls `setPhase()` before each step.
- **Entrypoint** (`scripts/entrypoint.sh`): Exec's the Hono server directly. Workspace setup runs asynchronously within the server process, so the health endpoint is available immediately for progress polling.

### Design Tokens (`packages/design-tokens`)

CSS custom properties defining the visual design system. `tokens.css` provides a warm orange-on-stone palette with light and dark mode support (including system preference detection via `prefers-color-scheme`). Includes color tokens (backgrounds, text, borders, accent, semantic), typography (Plus Jakarta Sans, JetBrains Mono), spacing scale, border radii, transitions, and layout constants.

### Postgres

Single shared Postgres 16 instance. Deployed via the Helm chart as a StatefulSet with persistent storage.

Contains:

- **Main app tables:** `users`, `projects`, `sessions`
- **Per-project databases:** Each project gets its own database named `portable_<slug>`, created via `CREATE DATABASE` on project start (or project creation) and dropped on project delete. Connection strings are built by replacing the database name in the main `DATABASE_URL` and injected into pods as the `DATABASE_URL` environment variable.

## Pod Lifecycle

Project pods are managed through three lifecycle operations, each with defined state transitions:

### Start (`stopped` or `error` -> `starting` -> `running`)

1. Validate project is in a startable state
2. Set status to `starting`
3. Decrypt the user's GitHub token and Anthropic API key (project-level key takes precedence over user-level)
4. Create per-project Postgres database (`portable_<slug>`) if it does not already exist
5. Create PersistentVolumeClaim (5Gi ReadWriteOnce) -- idempotent, ignores AlreadyExists
6. Create pod with pod-server image, injecting `DATABASE_URL`, credential, and `GITHUB_TOKEN` -- idempotent
7. Create headless service (`clusterIP: None`) for DNS at `project-<slug>.<namespace>.svc.cluster.local` -- idempotent
8. Watch pod until Ready condition is true (300s timeout)
9. Set status to `running` with `podName`

On failure at any step: set status to `error`, attempt cleanup of pod and service, re-throw the error.

### Stop (`running`, `starting`, or `error` -> `stopping` -> `stopped`)

1. Set status to `stopping`
2. Delete pod (ignores 404)
3. Delete service (ignores 404)
4. Set status to `stopped`, clear `podName`

PVC is preserved so workspace data persists across restarts.

### Delete

1. Delete pod, service, and PVC (all ignore 404)
2. Drop per-project Postgres database
3. Delete the project record from the database

Does NOT delete the GitHub repository (user manages this manually).

## Reverse Proxy and Pod Access

The main app provides two mechanisms for accessing project pods: path-based pod proxying for the editor UI, and subdomain-based proxying for preview access. No per-pod Ingress resources are created.

### Path-Based Pod Proxy

The editor UI (integrated into the main Nuxt app) communicates with pods through path-based API routing:

- **HTTP Proxy (Route Handler):** `server/routes/api/projects/[slug]/pod/[...path].ts` is a catch-all route that proxies HTTP requests to the pod server. It validates the session, verifies project ownership and running status, then forwards the request to `http://project-<slug>.<ns>.svc.cluster.local:3000/<path>` via `h3.proxyRequest()`.
- **WebSocket Proxy (Plugin):** `server/plugins/proxy.ts` intercepts WebSocket upgrade requests matching `/api/projects/:slug/pod/ws`. It manually validates the session cookie, looks up the project, rewrites the URL from `/api/projects/:slug/pod/ws` to `/ws`, and proxies via `httpxy.proxyUpgrade()`.

### Preview Subdomain Proxy

Preview subdomains (`<slug>--preview--<appLabel>.domain`) route to the pod's dev server (port 3001). The same `server/plugins/proxy.ts` plugin handles this:

1. Hooks into the Nitro `request` event (fires before Vite's dev middleware)
2. Detects preview subdomain requests via `parseSubdomain()`
3. Validates the session cookie
4. Resolves the proxy target via `resolveProxyTarget()`
5. Proxies HTTP via `httpxy.web()` and WebSocket via `httpxy.proxyUpgrade()`

### Shared Utilities

- **`server/utils/proxy-shared.ts`** -- Pure utility functions (no DB dependencies): `getDomainFromBaseUrl`, `parseSubdomain` (only recognizes preview subdomains), `buildProxyTarget` (constructs K8s URL for port 3001), `parseCookie`.
- **`server/utils/proxy.ts`** -- DB-dependent logic: `lookupProject` (queries DB, verifies ownership), `resolveProxyTarget` (orchestrates auth + lookup + target building for preview subdomains). Returns null for main app domain requests. Throws 401/404/503 for errors.

## Data Flow

### User Request to Main App

```
Browser -> Ingress -> Main App (Nuxt)
                         |
                         +-> Serve dashboard/settings/onboarding/editor pages
                         +-> Handle API routes (/api/projects, /api/settings, /api/auth)
                         +-> Read/write Postgres
                         +-> Manage K8s resources
```

### Editor Request to Project Pod (Path-Based)

```
Browser -> Ingress -> Main App (route handler / plugin)
                         |
                         +-> Match /api/projects/:slug/pod/* path
                         +-> Validate session cookie
                         +-> Look up project by slug, verify ownership
                         +-> Proxy to pod: project-<slug>.default.svc.cluster.local:3000
```

### User Request to Project Preview (Subdomain-Based)

```
Browser -> Ingress -> Main App (proxy plugin)
                         |
                         +-> Parse Host header: <slug>--preview--portable.example.com
                         +-> Validate session cookie
                         +-> Look up project by slug
                         +-> Proxy to pod: project-<slug>.default.svc.cluster.local:3001
```

## Database Schema

Defined with Drizzle ORM in `packages/app/server/db/schema.ts`. Migrations are generated via `drizzle-kit generate` and applied automatically on server startup.

```sql
users
  id                       UUID PRIMARY KEY (default random)
  github_id                INTEGER UNIQUE NOT NULL
  username                 TEXT NOT NULL
  display_name             TEXT
  avatar_url               TEXT
  encrypted_github_token   TEXT           -- AES-256-GCM encrypted (iv:tag:ciphertext format)
  encrypted_anthropic_key  TEXT           -- AES-256-GCM encrypted (user-level default credential)
  created_at               TIMESTAMPTZ (default now)
  updated_at               TIMESTAMPTZ (default now)

projects
  id                      UUID PRIMARY KEY (default random)
  user_id                 UUID REFERENCES users(id) NOT NULL
  name                    TEXT NOT NULL
  slug                    TEXT NOT NULL
  scaffold_id             TEXT NOT NULL (default 'nuxt-postgres')
  status                  project_status NOT NULL (default 'stopped')
                          -- enum: 'stopped' | 'creating' | 'starting' | 'running' | 'stopping' | 'error'
  encrypted_anthropic_key TEXT           -- AES-256-GCM encrypted
  pod_name                TEXT
  repo_url                TEXT
  created_at              TIMESTAMPTZ (default now)
  updated_at              TIMESTAMPTZ (default now)
  UNIQUE(user_id, slug)

sessions
  id                      TEXT PRIMARY KEY (random 32-byte hex token)
  user_id                 UUID REFERENCES users(id) NOT NULL
  expires_at              TIMESTAMPTZ NOT NULL
  created_at              TIMESTAMPTZ (default now)
```

Encrypted fields use a `iv:tag:ciphertext` format where all three components are base64-encoded, separated by colons. The encryption key is a 32-byte hex string set via `NUXT_ENCRYPTION_KEY`.

## Authentication Flow

```
Browser                          Main App (Nuxt)                    GitHub
  |                                   |                                |
  |-- GET /auth/github ------------>  |                                |
  |                                   |-- generate state cookie        |
  |  <---- 302 Redirect ------------- |                                |
  |                                   |                                |
  |-- Follow redirect --------------------------------------------->  |
  |                                   |                                |
  |  <---- 302 Redirect (with code) --------------------------------  |
  |                                   |                                |
  |-- GET /auth/github/callback --->  |                                |
  |                                   |-- validate code + state        |
  |                                   |-- exchange code for token ---> |
  |                                   |  <---- access token ---------- |
  |                                   |-- fetch /user profile -------> |
  |                                   |  <---- user data ------------- |
  |                                   |-- encrypt token (AES-256-GCM)  |
  |                                   |-- upsert user in DB            |
  |                                   |-- create session (30-day)      |
  |                                   |-- set portable_session cookie  |
  |  <---- 302 Redirect to / -------  |                                |
```

### Session Validation

Every request passes through a server middleware (`server/middleware/auth.ts`) that:

1. Reads the `portable_session` cookie
2. Looks up the session in the `sessions` table (joined with `users`)
3. Checks expiration (expired sessions are deleted)
4. Attaches `event.context.user` (or `null` if invalid/missing)

### Client-Side Auth Guard

A global Nuxt route middleware (`middleware/auth.global.ts`) uses the `useAuth()` composable to:

- Redirect unauthenticated users to `/login` for protected routes
- Redirect authenticated users away from `/login` to `/`
- Fetch auth state via `GET /api/auth/me` on first load

## Routing

A single wildcard Ingress resource (`*.example.com`) sends all traffic to the main app.

| Request pattern                                 | Action                                      |
| ----------------------------------------------- | ------------------------------------------- |
| `portable.example.com` (bare domain)            | Serve main app UI (dashboard, editor, etc.) |
| `portable.example.com/api/projects/:slug/pod/*` | Proxy to pod server (port 3000)             |
| `<slug>--preview--portable.example.com`         | Proxy to pod dev server (port 3001)         |

The editor UI is served as Nuxt pages from the main app domain. Pod communication uses path-based routing (`/api/projects/:slug/pod/*`) instead of subdomain routing. Only preview subdomains remain.

Each project pod gets a headless Service (`clusterIP: None`) named `project-<slug>` for stable DNS resolution at `project-<slug>.<namespace>.svc.cluster.local`.

No per-pod Ingress resources are created. The main app is the single gateway.

## RBAC

The main app's ServiceAccount has a Role granting:

- `pods`: create, get, list, watch, delete
- `persistentvolumeclaims`: create, get, list, watch, delete
- `services`: create, get, list, watch, delete

This is scoped to the namespace where Portable is deployed.

## Pod Environment Variables

When a project pod is created, these environment variables are injected:

- `DATABASE_URL` -- Connection string for the project's dedicated Postgres database
- `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` -- User's Anthropic credential (decrypted from storage)
- `GITHUB_TOKEN` -- User's GitHub access token (from OAuth)

## Resource Defaults

| Resource | Request | Limit |
| -------- | ------- | ----- |
| CPU      | 500m    | 2000m |
| Memory   | 512Mi   | 4Gi   |
| PVC      | --      | 5Gi   |

These are configurable via `NUXT_POD_RESOURCE_*` and `NUXT_POD_STORAGE_SIZE` environment variables (set via the Helm chart's `pod.resources` and `pod.storage` values).
