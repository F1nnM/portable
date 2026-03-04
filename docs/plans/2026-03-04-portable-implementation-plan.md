# Portable Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a mobile-first web app for remote Claude Code usage, with per-project K8s pods.

**Architecture:** Nuxt full-stack main app handles auth, project management, and proxies traffic to per-project K8s pods. Each pod runs a Hono server with the Claude Agent SDK, a dev server, and serves the editor SPA.

**Tech Stack:** Nuxt 3, Drizzle ORM, Hono, Claude Agent SDK, CodeMirror 6, `@kubernetes/client-node`, Octokit, Arctic, Helm, k3d, Tilt, mise

**Design Doc:** `docs/plans/2026-03-04-portable-design.md`

---

## Phase 1: Dev Environment & Project Foundation

### Task 1: mise config and monorepo structure

Set up the repository structure and mise for tool management.

```
.mise.toml              # Node.js LTS, pnpm, kubectl, helm, k3d, tilt
pnpm-workspace.yaml
package.json            # Root workspace
packages/
  app/                  # Nuxt main app
  pod-server/           # Hono server for inside pods
  editor/               # Vue SPA for editor UI
scaffolds/
  nuxt-postgres/
deploy/
  helm/
    portable/
docs/
  plans/
```

Initialize `packages/app` as a Nuxt 3 app. Initialize `packages/pod-server` as a plain TypeScript project with Hono. Initialize `packages/editor` as a Vue 3 + Vite SPA.

**Files:**
- Create: `.mise.toml`
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root workspace)
- Create: `.gitignore`
- Create: `packages/app/` (Nuxt init)
- Create: `packages/pod-server/package.json`, `tsconfig.json`, `src/index.ts` (minimal Hono with `/health`)
- Create: `packages/editor/package.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/App.vue` (minimal)

**Commit after this task.**

### Task 2: Dockerfiles for both containers

Create Dockerfiles early so Tilt can build and deploy them from the start.

**Main app** (`packages/app/Dockerfile`): Multi-stage — install deps, build Nuxt, slim runtime.

**Pod server** (`packages/pod-server/Dockerfile`): Based on Node.js LTS, installs git and common dev tools, copies pod-server build + editor SPA dist, sets entrypoint.

**Files:**
- Create: `packages/app/Dockerfile`
- Create: `packages/app/.dockerignore`
- Create: `packages/pod-server/Dockerfile`
- Create: `packages/pod-server/.dockerignore`

**Commit after this task.**

### Task 3: Helm chart (base)

Create the Helm chart with enough to deploy the main app and Postgres locally. This will be extended as we add features. Start with:
- Main app Deployment + Service + Ingress (wildcard)
- Postgres StatefulSet + Service + PVC
- ServiceAccount + RBAC
- Secrets + ConfigMap
- Values with sensible dev defaults

**Files:**
- Create: `deploy/helm/portable/Chart.yaml`
- Create: `deploy/helm/portable/values.yaml`
- Create: `deploy/helm/portable/templates/_helpers.tpl`
- Create: `deploy/helm/portable/templates/deployment.yaml`
- Create: `deploy/helm/portable/templates/service.yaml`
- Create: `deploy/helm/portable/templates/ingress.yaml`
- Create: `deploy/helm/portable/templates/postgres.yaml`
- Create: `deploy/helm/portable/templates/rbac.yaml`
- Create: `deploy/helm/portable/templates/secret.yaml`
- Create: `deploy/helm/portable/templates/configmap.yaml`

**Commit after this task.**

### Task 4: Tiltfile and local dev setup

Create the Tiltfile that:
- Builds main app and pod-server images using k3d's local registry
- Deploys via the Helm chart with dev overrides
- Uses `live_update` to sync code changes into running containers without full rebuilds
- Port-forwards the main app for local access

Create a dev setup script and documentation.

**Local dev domain:** `portable.127.0.0.1.nip.io` (wildcard DNS via nip.io, zero config).

**Dev workflow:**
```
mise install          # Install tools
k3d cluster create portable --registry-create portable-registry
tilt up               # Builds, deploys, watches for changes
# Open http://portable.127.0.0.1.nip.io
```

**Files:**
- Create: `Tiltfile`
- Create: `deploy/dev-values.yaml` (Helm value overrides for local dev: nip.io domain, dev image tags, etc.)
- Create: `scripts/dev-setup.sh` (creates k3d cluster if needed)
- Create: `docs/development.md`

**Commit after this task.**

---

## Phase 2: Database & Auth

### Task 5: Database schema and Drizzle setup

Install Drizzle ORM with `postgres.js` driver in the Nuxt app. Define the schema for `users`, `projects`, and `sessions` tables per the design doc. Set up migration tooling. Auto-migrate on server start via Nitro plugin.

**Files:**
- Create: `packages/app/server/db/schema.ts`
- Create: `packages/app/server/utils/db.ts`
- Create: `packages/app/server/plugins/migrate.ts`
- Create: `packages/app/drizzle.config.ts`
- Modify: `packages/app/package.json` (add deps, migration scripts)
- Modify: `packages/app/nuxt.config.ts` (runtimeConfig for DATABASE_URL)

**Commit after this task.**

### Task 6: Credential encryption utility

Implement AES-256-GCM encryption/decryption using `node:crypto` for storing Anthropic credentials.

**Files:**
- Create: `packages/app/server/utils/crypto.ts`
- Modify: `packages/app/nuxt.config.ts` (runtimeConfig for ENCRYPTION_KEY)

**Commit after this task.**

### Task 7: GitHub OAuth flow

Implement GitHub OAuth using Arctic (standalone). Login, callback, logout routes. Auth middleware that attaches user to event context. Store GitHub access token encrypted (needed for repo operations).

**Files:**
- Create: `packages/app/server/utils/auth.ts` (Arctic GitHub instance)
- Create: `packages/app/server/routes/auth/github/index.get.ts`
- Create: `packages/app/server/routes/auth/github/callback.get.ts`
- Create: `packages/app/server/routes/auth/logout.post.ts`
- Create: `packages/app/server/middleware/auth.ts`
- Modify: `packages/app/nuxt.config.ts` (runtimeConfig for github.clientId, clientSecret, redirectUri)

**Commit after this task.**

### Task 8: Auth-guarded pages and basic layout

Login page (public), dashboard/settings/new (protected). Client-side auth middleware. Mobile-first layout. Use the frontend-design skill.

**Files:**
- Create: `packages/app/middleware/auth.global.ts`
- Create: `packages/app/server/api/auth/me.get.ts`
- Create: `packages/app/pages/login.vue`
- Create: `packages/app/pages/index.vue` (dashboard placeholder)
- Create: `packages/app/pages/settings.vue` (placeholder)
- Create: `packages/app/pages/new.vue` (placeholder)
- Create: `packages/app/layouts/default.vue`

**Commit after this task.**

---

## Phase 3: Project Management

### Task 9: Anthropic credential management

Settings page where users enter their API key or Claude Code OAuth token. Save encrypted. Check existence endpoint.

**Files:**
- Create: `packages/app/server/api/settings/credential.put.ts`
- Create: `packages/app/server/api/settings/credential.get.ts`
- Modify: `packages/app/pages/settings.vue`

**Commit after this task.**

### Task 10: Project CRUD API

Server routes for creating, listing, renaming, deleting projects. Database operations only — K8s and GitHub integration wired in later.

**Files:**
- Create: `packages/app/server/api/projects/index.get.ts`
- Create: `packages/app/server/api/projects/index.post.ts`
- Create: `packages/app/server/api/projects/[slug]/index.patch.ts`
- Create: `packages/app/server/api/projects/[slug]/index.delete.ts`
- Create: `packages/app/server/api/projects/[slug]/start.post.ts` (placeholder)
- Create: `packages/app/server/api/projects/[slug]/stop.post.ts` (placeholder)

**Commit after this task.**

### Task 11: Dashboard UI

Project cards with name, status, start/stop toggle, rename/delete actions. "New Project" button. Use the frontend-design skill.

**Files:**
- Modify: `packages/app/pages/index.vue`
- Create: `packages/app/components/ProjectCard.vue`

**Commit after this task.**

---

## Phase 4: Scaffold System & GitHub Integration

### Task 12: Create the nuxt-postgres scaffold

Minimal Nuxt 3 app with Postgres (Drizzle), ready to run. Includes `CLAUDE.md` for Claude Code.

**Files:**
- Create: `scaffolds/nuxt-postgres/package.json`
- Create: `scaffolds/nuxt-postgres/nuxt.config.ts`
- Create: `scaffolds/nuxt-postgres/tsconfig.json`
- Create: `scaffolds/nuxt-postgres/app.vue`
- Create: `scaffolds/nuxt-postgres/server/db/schema.ts`
- Create: `scaffolds/nuxt-postgres/server/utils/db.ts`
- Create: `scaffolds/nuxt-postgres/drizzle.config.ts`
- Create: `scaffolds/nuxt-postgres/CLAUDE.md`
- Create: `scaffolds/nuxt-postgres/.gitignore`

**Commit after this task.**

### Task 13: GitHub repo creation and scaffold push

Create GitHub repos via Octokit, push scaffold files as initial commit using the Git Data API. List available scaffolds by reading `scaffolds/` directory.

**Files:**
- Create: `packages/app/server/utils/github.ts`
- Create: `packages/app/server/api/scaffolds/index.get.ts`
- Modify: `packages/app/server/api/projects/index.post.ts` (wire in GitHub)

**Commit after this task.**

### Task 14: New project page UI

Scaffold picker, project name input, create button. On success, navigates to dashboard. Use the frontend-design skill.

**Files:**
- Modify: `packages/app/pages/new.vue`

**Commit after this task.**

---

## Phase 5: Kubernetes Integration

### Task 15: K8s client and pod management

K8s integration: create/delete pods with PVC mounts and env vars, create/delete headless services, watch pod status until ready, create/delete PVCs.

**Files:**
- Create: `packages/app/server/utils/k8s.ts`
- Modify: `packages/app/nuxt.config.ts` (runtimeConfig for k8s namespace, pod image, resource limits)

**Commit after this task.**

### Task 16: Wire K8s into project lifecycle

Connect K8s to project API routes. Start creates pod + service + PVC. Stop deletes pod + service. Delete removes PVC. Create project also creates per-project Postgres database.

**Files:**
- Create: `packages/app/server/utils/project-db.ts` (CREATE/DROP DATABASE via raw SQL)
- Modify: `packages/app/server/api/projects/index.post.ts`
- Modify: `packages/app/server/api/projects/[slug]/start.post.ts`
- Modify: `packages/app/server/api/projects/[slug]/stop.post.ts`
- Modify: `packages/app/server/api/projects/[slug]/index.delete.ts`

**Commit after this task.**

---

## Phase 6: Reverse Proxy

### Task 17: Subdomain-based auth proxy

Nitro server middleware: parse Host header for project slug and proxy type (`<project>.domain` vs `preview.<project>.domain`), validate session cookie, proxy via `h3.proxyRequest` (HTTP). Nitro plugin for WebSocket upgrade proxy via `httpxy`.

**Files:**
- Create: `packages/app/server/utils/proxy.ts` (parseSubdomain, resolveTarget helpers)
- Create: `packages/app/server/middleware/proxy.ts`
- Create: `packages/app/server/plugins/ws-proxy.ts`

**Commit after this task.**

---

## Phase 7: Pod Server

### Task 18: Hono server with file API

Pod server: static SPA serving, file tree endpoint (fdir), file read/write, health check.

**Files:**
- Modify: `packages/pod-server/src/index.ts`
- Create: `packages/pod-server/src/routes/files.ts`
- Create: `packages/pod-server/src/routes/health.ts`

**Commit after this task.**

### Task 19: Agent SDK WebSocket bridge

WebSocket endpoint bridging browser to Claude Agent SDK. V1 `query()` with async generator pattern for multi-turn conversation. Forward SDK streaming events as JSON.

**Files:**
- Create: `packages/pod-server/src/routes/ws.ts`

Reference: `claude-agent-server` by dzhng (async generator pattern), `claude-agent-kit` by JimLiu (session management).

**Commit after this task.**

### Task 20: Pod startup script and dev server supervisor

Entrypoint: git clone (if needed), npm install, start dev server with auto-restart (child_process.spawn with restart logic), start Hono server.

**Files:**
- Create: `packages/pod-server/src/dev-server.ts`
- Create: `packages/pod-server/scripts/entrypoint.sh`

**Commit after this task.**

---

## Phase 8: Editor SPA (Mobile-First UI)

### Task 21: Editor SPA scaffolding and navigation

Vue 3 SPA with bottom tab navigation (Chat, Files, Preview). VS Code dark theme. Mobile-optimized layout. Use the frontend-design skill.

**Files:**
- Modify: `packages/editor/src/main.ts`
- Modify: `packages/editor/src/App.vue` (bottom nav bar, router-view)
- Create: `packages/editor/src/router.ts`
- Create: `packages/editor/src/views/ChatView.vue` (placeholder)
- Create: `packages/editor/src/views/FilesView.vue` (placeholder)
- Create: `packages/editor/src/views/PreviewView.vue` (placeholder)

**Commit after this task.**

### Task 22: Chat view

WebSocket chat interface. Streaming messages with markdown rendering. Mobile keyboard-optimized input. Tool usage shown inline. Use the frontend-design skill.

**Files:**
- Modify: `packages/editor/src/views/ChatView.vue`
- Create: `packages/editor/src/composables/useWebSocket.ts`
- Create: `packages/editor/src/components/ChatMessage.vue`
- Create: `packages/editor/src/components/ChatInput.vue`

**Commit after this task.**

### Task 23: Files view

File tree, tap to open file in CodeMirror 6 (full screen, back button). Read-only by default with edit toggle. VS Code dark theme. Use the frontend-design skill.

**Files:**
- Modify: `packages/editor/src/views/FilesView.vue`
- Create: `packages/editor/src/components/FileTree.vue`
- Create: `packages/editor/src/components/CodeViewer.vue`
- Create: `packages/editor/src/composables/useFiles.ts`

**Commit after this task.**

### Task 24: Preview view

Full-screen iframe to `preview.<project>.portable.example.com`. Detect project subdomain and construct preview URL.

**Files:**
- Modify: `packages/editor/src/views/PreviewView.vue`

**Commit after this task.**

---

## Phase 9: Helm Chart Completion

### Task 25: Finalize Helm chart

Extend the base Helm chart from Task 3 with:
- cert-manager Certificate resources (optional, wildcard TLS)
- Pod resource limit ConfigMap
- Documentation in `values.yaml` for all configurable options
- NOTES.txt with post-install instructions

**Files:**
- Modify: `deploy/helm/portable/values.yaml` (full documentation)
- Create: `deploy/helm/portable/templates/certificate.yaml` (optional cert-manager)
- Create: `deploy/helm/portable/templates/NOTES.txt`
- Modify other templates as needed for completeness

**Commit after this task.**

---

## Execution Order & Dependencies

```
Phase 1 (dev env, foundation, Dockerfiles, Helm base, Tilt)
  ↓
Phase 2 (DB, encryption, auth, pages)
  ↓
Phase 3 (settings, project CRUD, dashboard UI)
  ↓
Phase 4 (scaffold, GitHub integration, new project UI)
  ↓
Phase 5 (K8s client, wire into lifecycle)
  ↓
Phase 6 (subdomain proxy)
  ↓
Phase 7 (pod server: files, Agent SDK, startup)
  ↓
Phase 8 (editor SPA: chat, files, preview)
  ↓
Phase 9 (Helm finalization)
```

Phases are sequential. Within each phase, tasks are ordered by dependency.
