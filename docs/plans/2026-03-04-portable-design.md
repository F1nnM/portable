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
- K8s pod lifecycle management (create/delete pods, PVCs, services, ingresses)
- GitHub repo management (create repo, push scaffold)
- Postgres database management (create/drop per-project databases)
- Auth-checked reverse proxy for all pod subdomains

**Tech stack:**
- Nuxt 3 (SSR, full-stack)
- Drizzle ORM
- `@kubernetes/client-node`
- Octokit (GitHub API)
- Arctic (GitHub OAuth)

### 2. Project Pod (one per running project)

Self-contained environment with Claude Code, dev server, and editor UI.

**Responsibilities:**
- Serve the mobile-first editor UI (chat + file browser)
- WebSocket endpoint bridging browser to Claude Agent SDK
- File tree and file content API
- Dev server (Nuxt) with auto-restart on crash
- Reverse proxy for preview

**Tech stack:**
- Small TypeScript HTTP/WebSocket server
- `@anthropic-ai/claude-agent-sdk` (bundles Claude Code CLI)
- Node.js LTS base image
- Git, common dev tools

## Subdomain Routing

All subdomains route through the main app, which checks auth before proxying.

| URL | Target |
|-----|--------|
| `portable.example.com` | Main app UI |
| `<project>.portable.example.com` | Pod editor (chat, files) |
| `preview.<project>.portable.example.com` | Pod dev server (at `/`) |

The main app handles wildcard ingress and proxies authenticated requests to the correct pod.

## Database

Single shared Postgres instance (deployed via Helm chart or external).

**Main app tables:**

- `users` — id, github_id, github_username, avatar_url, anthropic_credential (encrypted), created_at
- `projects` — id, user_id, name, slug, scaffold_type, github_repo_url, status (running/stopped), pod_name, subdomain, created_at, updated_at

**Per-project databases:**

Each project gets its own database in the shared Postgres instance. Connection string injected into the pod as an env var.

## Authentication

### App Login

GitHub OAuth with scopes `repo` (create/push repos) and `read:user` (profile info). Session managed via secure HTTP-only cookie.

### Anthropic Credentials

Users provide either:
- `ANTHROPIC_API_KEY` — standard API key (pay-per-use)
- `CLAUDE_CODE_OAUTH_TOKEN` — generated via `claude setup-token` (uses Pro/Max subscription)

Stored encrypted in the `users` table. Injected into pods as environment variables. Never exposed to the browser after initial input.

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
3. Pod startup sequence:
   - Git clone from GitHub (skip if PVC already has files)
   - `npm install`
   - Start dev server with auto-restart
   - Start Agent SDK WebSocket server
   - K8s readiness probe passes
4. Create Service + Ingress for the project subdomains

### Stop Project
1. Delete pod (PVC persists)
2. Delete Service + Ingress

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
4. Start dev server via process supervisor (bash loop with auto-restart on crash)
5. Start the pod HTTP/WebSocket server
6. Signal readiness

### Pod Server Endpoints
- `GET /` — Mobile-first editor SPA
- `GET /ws` — WebSocket: browser <-> Agent SDK session
- `GET /api/files` — File tree listing
- `GET /api/files/:path` — File content
- `PUT /api/files/:path` — File write
- `/preview/*` — Reverse proxy to dev server (port 3000)

### Resource Defaults
- CPU: 500m request, 2000m limit
- Memory: 512Mi request, 4Gi limit
- PVC: 5Gi

## Mobile-First Editor UI

Served from inside the pod. Bottom navigation bar with three tabs.

### Chat Tab
- Streaming messages from Claude Code via WebSocket
- User text input at bottom (mobile keyboard optimized)
- Tool usage shown inline (file edits, bash commands, etc.)
- VS Code-inspired dark theme

### Files Tab
- File tree on the left (collapsible, VS Code-style icons)
- Tap a file to open full-screen code view with syntax highlighting
- Basic edit capability (lightweight editor, e.g., CodeMirror)
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
- Postgres: StatefulSet + Service + PVC (or external connection)
- ServiceAccount + RBAC (pod/PVC/service/ingress management)
- Optional: cert-manager Certificate resources (wildcard TLS via DNS-01)
- ConfigMap: default pod resource limits

### Required Helm Values
- `domain` — base domain (e.g., `portable.example.com`)
- `github.clientId` / `github.clientSecret`
- `postgres.password` (or `externalPostgres.url`)

### Optional Helm Values
- `certManager.enabled` + `certManager.issuer` + DNS solver config
- `pod.resources.cpu` / `pod.resources.memory` / `pod.storage`
- `image.repository` / `image.tag`

### Deployer Prerequisites
- Kubernetes cluster
- Wildcard DNS: `*.portable.example.com` → cluster
- cert-manager (if using automated TLS)
- DNS-01 solver credentials (for wildcard certs)
