# Pod Server Internals

## Overview

The pod server is a lightweight Hono HTTP/WebSocket server that runs inside each project pod. It serves as the bridge between the browser-based editor UI and the project's development environment.

A single container image is used for all project pods, regardless of scaffold type. The container includes Node.js 22, Git, Python 3, make, and g++ (for native npm addons).

## Architecture

```
+---------------------------------------------------------------+
|  Project Pod                                                  |
|                                                               |
|  +-------------------------+    +-------------------------+   |
|  |  Hono Server (:8080)    |    |  Dev Server (:3000)     |   |
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
| 8080 | Hono server | Editor SPA, file API, Agent WS |
| 3000 | Dev server  | Project's running application  |

## Endpoints

### `GET /`

Serves the editor SPA. The built static files from `packages/editor` are copied into the container at `/srv/public` and served via Hono's static file middleware.

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

Claude Agent SDK streaming events forwarded as JSON. These include text deltas, tool use events (file edits, bash commands), and completion signals.

**Implementation:**

Uses the V1 `query()` function from `@anthropic-ai/claude-agent-sdk` with an async generator as the prompt parameter. This allows continuous message feeding from the WebSocket client while streaming SDK events back to the browser.

The `interrupt` message cancels the current query.

### `GET /api/files`

Returns a file tree of the project directory (`/workspace`). Uses `fdir` for fast directory crawling. Excludes `node_modules/` and `.git/` directories.

**Response:**

```json
[
  { "path": "src/index.ts", "type": "file" },
  { "path": "src/", "type": "directory" },
  { "path": "package.json", "type": "file" }
]
```

### `GET /api/files/:path`

Returns the content of a single file. Path traversal attempts (e.g., `../`) are blocked.

**Response:** Raw file content with appropriate Content-Type header.

### `PUT /api/files/:path`

Writes content to a file. Creates parent directories if needed. Path traversal is blocked.

**Request body:** Raw file content.

## Startup Sequence

The pod entrypoint script runs the following steps:

1. **Git clone** -- If the PVC (`/workspace`) is empty, clone the project's GitHub repo. If files already exist, skip (the user manages git via Claude Code).
2. **npm install** -- Run `npm install` if `node_modules/` is missing or `package.json` has changed since the last install.
3. **Start dev server** -- Launch the project's dev server (e.g., `npm run dev`) via `child_process.spawn`. The supervisor monitors the process and restarts it on crash with exponential backoff.
4. **Start Hono server** -- Start the HTTP/WebSocket server on port 8080.
5. **Signal readiness** -- The `/health` endpoint returns 200, satisfying the K8s readiness probe.

## Dev Server Supervisor

The dev server runs as a child process managed by a supervisor module. Key behaviors:

- **Auto-restart:** If the dev server crashes, it is restarted automatically.
- **Backoff:** Restart delay increases exponentially to avoid rapid crash loops.
- **Port:** The dev server always listens on port 3000, which the main app's proxy routes `preview.<project>.domain` traffic to.

## Environment Variables

The following environment variables are injected by the main app when creating the pod:

| Variable                  | Description                                     |
| ------------------------- | ----------------------------------------------- |
| `DATABASE_URL`            | Connection string for the project's Postgres DB |
| `ANTHROPIC_API_KEY`       | User's Anthropic API key (if set)               |
| `CLAUDE_CODE_OAUTH_TOKEN` | User's Claude Code OAuth token (if set)         |
| `GITHUB_TOKEN`            | User's GitHub access token                      |
| `PORT`                    | Hono server port (default: 8080)                |

## Container Image

Built from `packages/pod-server/Dockerfile` using a multi-stage build:

1. **deps** -- Install pnpm dependencies for the full workspace
2. **build** -- Build both `@portable/pod-server` (tsup) and `@portable/editor` (Vite)
3. **runtime** -- Node.js 22 Alpine with git, python3, make, g++. Copies the pod-server dist, its node_modules, and the editor SPA dist into `/srv/public`

The project workspace is mounted at `/workspace` via a PersistentVolumeClaim.
