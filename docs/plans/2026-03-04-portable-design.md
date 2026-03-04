# Portable — Design Document

## Overview

Portable is a mobile-first web application for using Claude Code remotely. Users create projects from scaffolds, and each project runs in an isolated Kubernetes pod with Claude Code, a dev server, and a file browser — all accessible through a mobile-optimized web UI.

## Architecture

Two distinct components:

### 1. Main App (Nuxt full-stack)

Handles project management, authentication, and proxies all traffic to project pods.

**Responsibilities:**
- GitHub OAuth login
- Project CRUD (create, start, stop, rename, delete)
- K8s pod lifecycle management (create/delete pods, PVCs, headless services)
- GitHub repo management (create repo, push scaffold)
- Postgres database management (create/drop per-project databases)
- Auth-checked reverse proxy for all pod subdomains

**Tech stack:**
- Nuxt 3 (SSR, full-stack)
- Drizzle ORM with `postgres.js` driver
- `@kubernetes/client-node` for pod management
- Octokit for GitHub API
- Arctic for GitHub OAuth (standalone, no Lucia)
- `h3` `proxyRequest` for HTTP proxying (built into Nitro)
- `httpxy` for WebSocket proxying (unjs fork of node-http-proxy)
- `node:crypto` AES-256-GCM for credential encryption

### 2. Project Pod (one per running project)

Self-contained environment with Claude Code, dev server, and editor UI.

**Responsibilities:**
- Serve the mobile-first editor UI (chat + file browser)
- WebSocket endpoint bridging browser to Claude Agent SDK
- File tree and file content API
- Dev server (Nuxt) with auto-restart on crash

**Tech stack:**
- Hono (~14KB) with `@hono/node-server` and `@hono/node-ws`
- `@anthropic-ai/claude-agent-sdk` (bundles Claude Code CLI)
- `fdir` for file tree crawling (<2KB, fastest available)
- CodeMirror 6 for code viewing and editing (mobile-first design)
- Node.js LTS base image
- Git, common dev tools

## Subdomain Routing

All subdomains route through the main app, which checks auth before proxying.

| URL | Target |
|-----|--------|
| `portable.example.com` | Main app UI |
| `<project>.portable.example.com` | Pod editor (chat, files) |
| `preview.<project>.portable.example.com` | Pod dev server (at `/`) |

The main app handles wildcard ingress. A Nitro server middleware parses the `Host` header to extract the project slug and proxy type, validates the user's session cookie, then proxies via `h3.proxyRequest` (HTTP) or `httpxy.proxyUpgrade` (WebSocket).

No per-pod Ingress resources are needed. Each pod gets a headless Service (`clusterIP: None`) for stable DNS resolution within the cluster: `project-<slug>.<namespace>.svc.cluster.local`.

## Database

Single shared Postgres instance (deployed via Helm chart or external).

**Main app tables:**

- `users` — id, github_id, username, email, anthropic_key_encrypted, anthropic_key_iv, anthropic_key_tag, created_at
- `projects` — id, user_id, name, slug, scaffold_type, github_repo_url, status (running/stopped), pod_ip, created_at, updated_at
- `sessions` — id, user_id, expires_at

**Per-project databases:**

Each project gets its own database in the shared Postgres instance. Connection string injected into the pod as an env var.

## Authentication

### App Login

GitHub OAuth via Arctic with scopes `repo` (create/push repos) and `read:user` (profile info). Session managed via secure HTTP-only cookie backed by the `sessions` table.

### Anthropic Credentials

Users provide either:
- `ANTHROPIC_API_KEY` — standard API key (pay-per-use)
- `CLAUDE_CODE_OAUTH_TOKEN` — generated via `claude setup-token` (uses Pro/Max subscription)

Stored encrypted (AES-256-GCM) in the `users` table. Injected into pods as environment variables. Never exposed to the browser after initial input.

### Pod Auth

All pod traffic flows through the main app's reverse proxy. The main app validates the user's session cookie before forwarding requests. Pods themselves have no auth logic.

## Pod Lifecycle

### Create Project
1. Create GitHub repo via Octokit
2. Copy scaffold files, push initial commit
3. Create Postgres database for the project
4. Create PVC (5Gi default)
5. Start pod

### Start Project
1. Create pod with PVC mount
2. Inject env vars: DB connection string, Anthropic credential, GitHub token
3. Create headless Service for stable DNS
4. Pod startup sequence:
   - Git clone from GitHub (skip if PVC already has files)
   - `npm install`
   - Start dev server with auto-restart (child_process.spawn with restart logic)
   - Start Hono HTTP/WebSocket server
   - K8s readiness probe passes (HTTP GET `/health`)
5. Store pod IP in database for proxy routing

### Stop Project
1. Delete pod (PVC persists)
2. Delete headless Service

### Delete Project
1. Stop project (if running)
2. Delete PVC
3. Drop project database
4. GitHub repo is NOT deleted (user can do this manually)

## Pod Container

**Single container image for all scaffolds.**

### Startup Script
1. If PVC is empty: `git clone` from GitHub repo
2. If PVC has files: `git pull` (or skip, user manages git via Claude)
3. `npm install` (if node_modules missing or package.json changed)
4. Start dev server via child_process.spawn with auto-restart on crash
5. Start the Hono HTTP/WebSocket server
6. Signal readiness via `/health` endpoint

### Pod Server (Hono)
- `GET /` — Mobile-first editor SPA (served via `serveStatic`)
- `GET /health` — Readiness probe
- `GET /ws` — WebSocket: browser <-> Agent SDK session (via `@hono/node-ws`)
- `GET /api/files` — File tree listing (via `fdir`)
- `GET /api/files/:path` — File content
- `PUT /api/files/:path` — File write
- Port 8080 for the editor server
- Port 3000 for the dev server (Nuxt)

### Agent SDK WebSocket Bridge
Uses the V1 `query()` function with an async generator as the prompt parameter, allowing continuous message feeding from the WebSocket client:
- Inbound messages: `{ type: "user_message", content: string }` and `{ type: "interrupt" }`
- Outbound messages: SDK streaming events forwarded as JSON

### Resource Defaults
- CPU: 500m request, 2000m limit
- Memory: 512Mi request, 4Gi limit
- PVC: 5Gi

## Mobile-First Editor UI

Served from inside the pod as a static SPA. Bottom navigation bar with three tabs.

### Chat Tab
- Streaming messages from Claude Code via WebSocket
- User text input at bottom (mobile keyboard optimized)
- Tool usage shown inline (file edits, bash commands, etc.)
- VS Code-inspired dark theme

### Files Tab
- File tree (collapsible, VS Code-style icons)
- Tap a file to open full-screen code view
- CodeMirror 6 for both viewing and editing (~150KB, mobile-first)
- VS Code dark color scheme

### Preview Tab
- Full-screen iframe to `preview.<project>.portable.example.com`
- Shows the running dev server output

## Main App UI

### `/login`
GitHub OAuth login page.

### `/` (Dashboard)
- Project cards: name, status indicator (running/stopped), start/stop toggle
- Actions per project: rename, delete
- "New Project" button

### `/settings`
- Anthropic API key / token input field
- Instructions for obtaining each credential type

### `/new`
- Scaffold picker (shows all folders from `scaffolds/`)
- Project name input
- Creates repo, scaffolds, starts pod, redirects to editor

## Scaffold System

```
scaffolds/
  nuxt-postgres/
    CLAUDE.md        # Instructions for Claude (dev server commands, project context)
    nuxt.config.ts
    package.json
    ...all scaffold files
```

Any folder in `scaffolds/` is a selectable scaffold. The entire folder contents are used as the initial project files pushed to the GitHub repo.

The `CLAUDE.md` in each scaffold tells Claude Code about the project setup, how to run the dev server, database access, etc.

## Helm Chart

### Deployed Resources
- Main app: Deployment + Service + Ingress (wildcard)
- Postgres: StatefulSet + Service + PVC (or option to use external Postgres)
- ServiceAccount + RBAC (pod/PVC/service management)
- Optional: cert-manager Certificate resources (wildcard TLS via DNS-01)
- ConfigMap: default pod resource limits

### Required Helm Values
- `domain` — base domain (e.g., `portable.example.com`)
- `github.clientId` / `github.clientSecret`
- `postgres.password` (or `externalPostgres.url`)
- `encryptionKey` — 32-byte hex key for AES-256-GCM credential encryption

### Optional Helm Values
- `certManager.enabled` + `certManager.issuer` + DNS solver config
- `pod.resources.cpu` / `pod.resources.memory` / `pod.storage`
- `image.repository` / `image.tag`

### Deployer Prerequisites
- Kubernetes cluster
- Wildcard DNS: `*.portable.example.com` → cluster
- cert-manager (if using automated TLS)
- DNS-01 solver credentials (for wildcard certs)
