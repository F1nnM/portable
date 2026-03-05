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
              |                |    |  Hono server:8080 |
              |  - users       |    |  - Editor SPA     |
              |  - projects    |    |  - File API       |
              |  - sessions    |    |  - Agent WS       |
              |  - per-project |    |                   |
              |    databases   |    |  Dev server:3000  |
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
- **K8s lifecycle:** Creates/deletes pods, PVCs, and headless services via `@kubernetes/client-node`.
- **GitHub integration:** Creates repos and pushes scaffold files via Octokit.
- **Reverse proxy:** Parses the `Host` header to route subdomain traffic to the correct pod. All requests are authenticated before proxying. HTTP via `h3.proxyRequest`, WebSocket via `httpxy`.
- **Credential encryption:** Stores GitHub tokens and Anthropic API keys encrypted with AES-256-GCM.
- **Auto-migration:** Drizzle ORM migrations run automatically on server startup via a Nitro plugin.

### Pod Server (`packages/pod-server`)

Hono HTTP/WebSocket server that runs inside each project pod. Lightweight (~14KB for Hono itself).

Endpoints:

- `GET /` -- Serves the editor SPA (static files from `packages/editor` dist)
- `GET /health` -- Readiness probe for K8s
- `GET /ws` -- WebSocket bridge between the browser and the Claude Agent SDK
- `GET /api/files` -- File tree listing (via `fdir`)
- `GET /api/files/:path` -- Read file content
- `PUT /api/files/:path` -- Write file content

The pod server also manages:

- **Dev server supervisor:** Starts the project's dev server (e.g., Nuxt) as a child process with auto-restart on crash and backoff.
- **Git clone:** Clones the project's GitHub repo into the PVC on first startup.
- **npm install:** Runs when `node_modules` is missing or `package.json` has changed.

### Editor SPA (`packages/editor`)

Vue 3 single-page application with three tabs:

- **Chat:** WebSocket connection to the Agent SDK bridge. Streaming markdown messages, tool usage display, mobile-optimized keyboard input.
- **Files:** File tree with tap-to-open, CodeMirror 6 code viewer/editor in a VS Code dark theme.
- **Preview:** Full-screen iframe pointing to `preview.<project>.domain` showing the running dev server.

### Postgres

Single shared Postgres 16 instance. Deployed via the Helm chart as a StatefulSet with persistent storage.

Contains:

- **Main app tables:** `users`, `projects`, `sessions`
- **Per-project databases:** Each project gets its own database. Connection strings are injected into pods as environment variables.

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
                         +-> Proxy to pod: project-<slug>.default.svc.cluster.local:8080
```

### User Request to Project Preview

```
Browser -> Ingress -> Main App (proxy middleware)
                         |
                         +-> Parse Host header: preview.<slug>.portable.example.com
                         +-> Validate session cookie
                         +-> Look up project by slug
                         +-> Proxy to pod: project-<slug>.default.svc.cluster.local:3000
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
| `<slug>.portable.example.com`         | Proxy to pod editor (port 8080)     |
| `preview.<slug>.portable.example.com` | Proxy to pod dev server (port 3000) |

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

These are configurable via the Helm chart's `pod.resources` and `pod.storage` values.
