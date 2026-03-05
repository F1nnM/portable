# Pod Server Internals

## Overview

The pod server is a lightweight Hono HTTP/WebSocket server that runs inside each project pod. It serves as the bridge between the browser-based editor UI and the project's development environment.

A single container image is used for all project pods, regardless of scaffold type. The container includes Node.js 22, Git, Python 3, make, and g++ (for native npm addons), plus pnpm via corepack.

## Architecture

```
+---------------------------------------------------------------+
|  Project Pod                                                  |
|                                                               |
|  +-------------------------+    +-------------------------+   |
|  |  Hono Server (:3000)    |    |  Dev Server (:3001)     |   |
|  |                         |    |  (e.g., Nuxt)           |   |
|  |  - Static SPA (editor)  |    |                         |   |
|  |  - File API             |    |  Managed by supervisor  |   |
|  |  - Agent SDK WebSocket  |    |  Auto-restart on crash  |   |
|  |  - Health check         |    +-------------------------+   |
|  +-------------------------+                                  |
|                                                               |
|  +-------------------------+                                  |
|  |  PVC (/workspace)       |                                  |
|  |  - Project source code  |                                  |
|  |  - node_modules         |                                  |
|  +-------------------------+                                  |
+---------------------------------------------------------------+
```

## Ports

| Port | Service     | Purpose                        |
| ---- | ----------- | ------------------------------ |
| 3000 | Hono server | Editor SPA, file API, Agent WS |
| 3001 | Dev server  | Project's running application  |

## App Factory

The Hono app is created via `createApp()` in `src/app.ts`. This factory function returns the app instance and a `registerWsRoute` function. The factory pattern allows tests to create isolated app instances and enables the WebSocket upgrade helper to be injected at runtime (required because `@hono/node-ws` needs the server instance).

## Endpoints

### `GET /`

Serves the editor SPA. The built static files from `packages/editor` are copied into the container at `/srv/public` and served via `@hono/node-server/serve-static`. A SPA fallback route serves `index.html` for all non-API, non-file routes.

### `GET /health`

Kubernetes readiness probe. Returns `200` with `{ "status": "ok" }` when the server is ready to accept traffic. The main app's proxy only routes to pods that pass this check.

### `GET /ws`

WebSocket endpoint that bridges the browser to the Claude Agent SDK.

**Protocol:**

Inbound messages (browser to server):

```json
{ "type": "user_message", "content": "Add a login page" }
```

```json
{ "type": "interrupt" }
```

Outbound messages (server to browser):

```json
{ "type": "query_start" }
```

```json
{ "type": "sdk_event", "event": { ... } }
```

```json
{ "type": "query_end" }
```

```json
{ "type": "error", "message": "..." }
```

**Implementation:**

Uses the `query()` function from `@anthropic-ai/claude-agent-sdk`. Each user message starts a new query with an async `for await` loop over SDK streaming events. Events are forwarded to the browser as `sdk_event` messages.

Key behaviors:

- **Interrupt:** The `interrupt` message calls `query.interrupt()` on the active query.
- **New message during active query:** If a `user_message` arrives while a query is running, the current query is interrupted and the new message is stored as a pending prompt. After the current query's loop exits, the pending prompt is automatically started as a new query.
- **Disconnect cleanup:** On WebSocket close or error, `query.close()` is called to clean up SDK resources.

SDK configuration:

- `cwd`: `WORKSPACE_DIR` (default `/workspace`)
- `permissionMode`: `bypassPermissions` (pods are isolated and auth is handled by the main app proxy)
- `settingSources`: `["project"]`
- `systemPrompt`: `{ type: "preset", preset: "claude_code" }`

### `GET /api/files`

Returns a sorted list of relative file paths in the workspace directory. Uses `fdir` for fast directory crawling.

Excluded directories: `node_modules`, `.git`, `.DS_Store`, `.next`, `.nuxt`, `.output`, `.cache`, `.turbo`, `dist`, `coverage`, `__pycache__`.

**Response:**

```json
{ "files": ["package.json", "src/index.ts", "tsconfig.json"] }
```

### `GET /api/files/:path`

Returns the UTF-8 content of a single file as plain text.

- `404` for nonexistent files
- `400` for directories or missing path
- `403` for path traversal attempts

### `PUT /api/files/:path`

Writes the request body (plain text) to a file. Creates parent directories if needed.

- `403` for path traversal attempts
- `400` for missing path

**Path traversal protection:** All file paths are resolved against `WORKSPACE_DIR` and verified to start with that directory prefix before any filesystem operation.

## Startup Sequence

The pod entrypoint script (`scripts/entrypoint.sh`) runs the following steps:

1. **Workspace setup** -- Calls `setupWorkspace()` from `src/setup.ts` via a Node.js one-liner:
   - If the PVC (`/workspace`) is empty (ignoring `lost+found`), clone the project's GitHub repo using `GITHUB_REPO_URL`. If `GITHUB_TOKEN` is set, it is injected into the clone URL for authentication.
   - If `node_modules/` is missing, detect the package manager and run install.
2. **Start Hono server** -- `exec node dist/index.js` starts the HTTP/WebSocket server on port 3000.
3. **Start dev server** -- The Hono entrypoint creates a `DevServerSupervisor` and calls `start()`, launching the project's dev server on port 3001.
4. **Signal readiness** -- The `/health` endpoint returns 200, satisfying the K8s readiness probe.

### Package Manager Detection

The workspace setup module detects the package manager by checking for lock files:

- `pnpm-lock.yaml` present -> `pnpm install`
- `yarn.lock` present -> `yarn install`
- Otherwise -> `npm install`

## Dev Server Supervisor

The dev server runs as a child process managed by the `DevServerSupervisor` class (`src/dev-server.ts`). Key behaviors:

- **Auto-restart:** If the dev server crashes (non-zero exit or signal), it is restarted automatically.
- **Exponential backoff:** First crash restarts after 1 second. Each consecutive crash doubles the delay, capped at 30 seconds. If the process runs for at least 10 seconds, the backoff counter resets.
- **Port injection:** Sets `PORT=3001` in the child process environment so the dev server listens on the correct port.
- **Graceful shutdown:** `stop()` sends SIGTERM to the child process and cancels any pending restart timer. Called on `SIGTERM` and `SIGINT` signals.
- **stdio:** Child process inherits stdio from the parent, so dev server output appears in pod logs.

## Environment Variables

The following environment variables are available inside the pod:

| Variable                  | Description                                     | Default      |
| ------------------------- | ----------------------------------------------- | ------------ |
| `WORKSPACE_DIR`           | Path to the project workspace                   | `/workspace` |
| `GITHUB_REPO_URL`         | Git repo URL for initial clone                  | (none)       |
| `GITHUB_TOKEN`            | GitHub access token for authenticated clone     | (none)       |
| `DEV_SERVER_COMMAND`      | Command to start the project's dev server       | `pnpm dev`   |
| `PORT`                    | Hono server listen port                         | `3000`       |
| `DATABASE_URL`            | Connection string for the project's Postgres DB | (none)       |
| `ANTHROPIC_API_KEY`       | User's Anthropic API key (if set)               | (none)       |
| `CLAUDE_CODE_OAUTH_TOKEN` | User's Claude Code OAuth token (if set)         | (none)       |

`DATABASE_URL`, `ANTHROPIC_API_KEY`/`CLAUDE_CODE_OAUTH_TOKEN`, `GITHUB_TOKEN`, and `GITHUB_REPO_URL` are injected by the main app when creating the pod (see `server/utils/k8s.ts`).

## Container Image

Built from `packages/pod-server/Dockerfile` using a multi-stage build:

1. **deps** -- Install pnpm dependencies for the full workspace
2. **build** -- Build both `@portable/pod-server` (tsup) and `@portable/editor` (Vite)
3. **runtime** -- Node.js 22 Alpine with git, python3, make, g++, and pnpm via corepack. Copies the pod-server dist, its node_modules, and the editor SPA dist into `/srv/public`

The project workspace is mounted at `/workspace` via a PersistentVolumeClaim.
