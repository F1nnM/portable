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
                    |   *.portable.example.com      |
                    +-------------------------------+
                                    |
                                    v
                    +-------------------------------+
                    |       Main App (Nuxt 3)       |
                    |                               |
                    |  - GitHub OAuth               |
                    |  - Project CRUD               |
                    |  - K8s pod lifecycle           |
                    |  - Auth-checking proxy         |
                    +-------------------------------+
                         |                    |
                         v                    v
              +----------------+    +-------------------+
              |   Postgres     |    |  Project Pod (N)  |
              |   (shared)     |    |                   |
              |                |    |  Hono server:3000 |
              |  - users       |    |  - Editor SPA     |
              |  - projects    |    |  - File API       |
              |  - sessions    |    |  - Agent WS       |
              |  - per-project |    |                   |
              |    databases   |    |  Dev server:3001  |
              +----------------+    |  - Nuxt/Vite/etc  |
                                    |                   |
                                    |  PVC (5Gi)        |
                                    +-------------------+
```

## Components

### Main App (`packages/app`)

Nuxt 3 full-stack application. Serves the project management UI (dashboard, settings, new project page) and acts as the single entry point for all traffic.

Key responsibilities:

- **Authentication:** GitHub OAuth via Arctic. Session cookies stored in the `sessions` table. Server middleware validates cookies on every request.
- **Project management:** CRUD operations on projects, stored in Postgres.
- **K8s lifecycle:** Creates/deletes pods, PVCs, and headless services via `@kubernetes/client-node`. Manages the full project lifecycle (start/stop/delete) with state transitions, error rollback, and retry-safe AlreadyExists handling. See `server/utils/k8s.ts` (low-level K8s operations), `server/utils/project-db.ts` (per-project database management), and `server/utils/project-lifecycle.ts` (orchestration).
- **GitHub integration:** Creates repos and pushes scaffold files via Octokit.
- **Reverse proxy:** Parses the `Host` header to route subdomain traffic to the correct pod. All requests are authenticated before proxying. HTTP via `h3.proxyRequest`, WebSocket via `httpxy`.
- **Credential encryption:** Stores GitHub tokens and Anthropic API keys encrypted with AES-256-GCM.
- **Auto-migration:** Drizzle ORM migrations run automatically on server startup via a Nitro plugin.

### Pod Server (`packages/pod-server`)

Hono HTTP/WebSocket server that runs inside each project pod. Built with `createApp()` factory in `src/app.ts`.

Endpoints:

- `GET /` -- Serves the editor SPA (static files from `packages/editor` dist via `@hono/node-server/serve-static`)
- `GET /health` -- Readiness probe for K8s
- `GET /ws` -- WebSocket bridge between the browser and the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- `GET /api/files` -- File tree listing (via `fdir`, excludes `node_modules`, `.git`, and other build directories)
- `GET /api/files/:path` -- Read file content (with path traversal protection)
- `PUT /api/files/:path` -- Write file content (with path traversal protection, creates parent directories)

The pod server also manages:

- **Dev server supervisor** (`src/dev-server.ts`): `DevServerSupervisor` class starts the project's dev server as a child process on port 3001. Auto-restarts on crash with exponential backoff (1s to 30s cap). Backoff resets after 10 seconds of stable running. Graceful shutdown via SIGTERM.
- **Workspace setup** (`src/setup.ts`): On startup, clones the project's GitHub repo into the PVC if the workspace is empty (using `GITHUB_TOKEN` for authentication). Detects the package manager (pnpm/yarn/npm) and installs dependencies if `node_modules` is missing.
- **Entrypoint** (`scripts/entrypoint.sh`): Runs workspace setup, then exec's the Hono server.

### Editor SPA (`packages/editor`)

Vue 3 single-page application with three tabs:

- **Chat:** WebSocket connection to the Agent SDK bridge. Streaming markdown messages, tool usage display, mobile-optimized keyboard input.
- **Files:** File tree with tap-to-open, CodeMirror 6 code viewer/editor in a VS Code dark theme.
- **Preview:** Full-screen iframe pointing to `preview.<project>.domain` showing the running dev server.

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
8. Watch pod until Ready condition is true (120s timeout)
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

## Reverse Proxy

The main app is the single gateway for all subdomain traffic. No per-pod Ingress resources are created. The proxy layer has two components:

### HTTP Proxy (Middleware)

`server/middleware/proxy.ts` is a Nitro server middleware that runs on every HTTP request. It inspects the `Host` header to determine whether the request is for a project subdomain. If so, it:

1. Uses `resolveProxyTarget()` from `server/utils/proxy.ts` to authenticate the request, look up the project, verify it is running, and build the internal K8s service URL
2. Proxies the request via `h3.proxyRequest()`, forwarding the original path and query string
3. Sets `x-forwarded-host` to the original Host header

If the host matches the main app domain (no subdomain), the middleware returns early and lets Nuxt handle the request normally.

The auth middleware (`server/middleware/auth.ts`) runs before the proxy middleware due to Nitro's alphabetical middleware ordering, so `event.context.user` is already populated.

### WebSocket Proxy (Plugin)

`server/plugins/ws-proxy.ts` is a Nitro plugin that hooks into the `request` event to intercept WebSocket upgrade requests. Nitro plugins run outside the middleware chain, so this plugin manually:

1. Detects WebSocket upgrade requests via the `Upgrade: websocket` header
2. Parses the `portable_session` cookie from the raw request headers
3. Validates the session by calling `validateSession()` directly
4. Calls `resolveProxyTarget()` to authenticate and resolve the target
5. Proxies the WebSocket connection via `httpxy.proxyUpgrade()`
6. Marks the event as handled (`event._handled = true`) so Nitro does not process it further

On auth or project errors, the socket is destroyed immediately.

### Shared Utilities

`server/utils/proxy.ts` contains the core proxy resolution logic shared by both the HTTP middleware and the WebSocket plugin:

- `getDomainFromBaseUrl(baseUrl)` -- Extracts the hostname from `NUXT_APP_BASE_URL`
- `parseSubdomain(host, domain)` -- Parses the Host header into a `{ slug, type }` object (type is `"editor"` or `"preview"`)
- `buildProxyTarget(slug, type, namespace)` -- Constructs the internal K8s service URL (`http://project-<slug>.<ns>.svc.cluster.local:<port>`)
- `lookupProject(slug, userId)` -- Queries the database for the project, verifying ownership
- `resolveProxyTarget(host, domain, namespace, user)` -- Orchestrates the full resolution pipeline, returning a target URL or throwing 401/404/503

## Data Flow

### User Request to Main App

```
Browser -> Ingress -> Main App (Nuxt)
                         |
                         +-> Serve dashboard/settings/new-project pages
                         +-> Handle API routes (/api/projects, /api/settings, /api/auth)
                         +-> Read/write Postgres
                         +-> Manage K8s resources
```

### User Request to Project Pod

```
Browser -> Ingress -> Main App (proxy middleware)
                         |
                         +-> Parse Host header: <slug>.portable.example.com
                         +-> Validate session cookie
                         +-> Look up project by slug
                         +-> Proxy to pod: project-<slug>.default.svc.cluster.local:3000
```

### User Request to Project Preview

```
Browser -> Ingress -> Main App (proxy middleware)
                         |
                         +-> Parse Host header: preview.<slug>.portable.example.com
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
                          -- enum: 'stopped' | 'starting' | 'running' | 'stopping' | 'error'
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

## Subdomain Routing

A single wildcard Ingress resource (`*.portable.example.com`) sends all traffic to the main app. A Nitro server middleware inspects the `Host` header to determine what to do:

| Host pattern                          | Action                              |
| ------------------------------------- | ----------------------------------- |
| `portable.example.com` (bare domain)  | Serve main app UI                   |
| `<slug>.portable.example.com`         | Proxy to pod editor (port 3000)     |
| `preview.<slug>.portable.example.com` | Proxy to pod dev server (port 3001) |

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
