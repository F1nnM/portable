# Portable Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a mobile-first web app for remote Claude Code usage, with per-project K8s pods.

**Architecture:** Nuxt full-stack main app handles auth, project management, and proxies traffic to per-project K8s pods. Each pod runs a Hono server with the Claude Agent SDK, a dev server, and serves the editor SPA.

**Tech Stack:** Nuxt 3, Drizzle ORM, Hono, Claude Agent SDK, CodeMirror 6, `@kubernetes/client-node`, Octokit, Arctic, Helm

**Design Doc:** `docs/plans/2026-03-04-portable-design.md`

---

## Phase 1: Project Scaffolding & Foundation

### Task 1: Initialize Nuxt app and monorepo structure

Set up the repository as a monorepo with two packages:

```
packages/
  app/              # Nuxt main app
  pod-server/       # Hono server for inside pods
scaffolds/
  nuxt-postgres/    # First scaffold
deploy/
  helm/
    portable/       # Helm chart
docs/
  plans/            # Already exists
```

Initialize `packages/app` as a Nuxt 3 app. Initialize `packages/pod-server` as a plain TypeScript project with Hono. Use a pnpm workspace for the monorepo.

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root workspace)
- Create: `packages/app/` (Nuxt init)
- Create: `packages/pod-server/package.json`
- Create: `packages/pod-server/tsconfig.json`
- Create: `packages/pod-server/src/index.ts` (minimal Hono server with `/health`)

**Commit after this task.**

### Task 2: Database schema and Drizzle setup

Install Drizzle ORM with `postgres.js` driver in the Nuxt app. Define the schema for `users`, `projects`, and `sessions` tables per the design doc. Set up migration tooling.

**Files:**
- Create: `packages/app/server/db/schema.ts`
- Create: `packages/app/server/utils/db.ts`
- Create: `packages/app/drizzle.config.ts`
- Modify: `packages/app/package.json` (add deps, migration scripts)
- Modify: `packages/app/nuxt.config.ts` (runtimeConfig for DATABASE_URL)

**Commit after this task.**

### Task 3: Credential encryption utility

Implement AES-256-GCM encryption/decryption using `node:crypto` for storing Anthropic credentials.

**Files:**
- Create: `packages/app/server/utils/crypto.ts` (encrypt/decrypt functions)
- Modify: `packages/app/nuxt.config.ts` (runtimeConfig for ENCRYPTION_KEY)

**Commit after this task.**

---

## Phase 2: Authentication

### Task 4: GitHub OAuth flow

Implement GitHub OAuth using Arctic (standalone, no Lucia). Set up login, callback, and logout server routes. Create auth middleware that attaches the user to the event context. Store the GitHub access token encrypted in the user record (we need it later for repo operations).

**Files:**
- Create: `packages/app/server/utils/auth.ts` (Arctic GitHub instance)
- Create: `packages/app/server/routes/auth/github/index.get.ts` (redirect to GitHub)
- Create: `packages/app/server/routes/auth/github/callback.get.ts` (handle callback, upsert user, create session)
- Create: `packages/app/server/routes/auth/logout.post.ts`
- Create: `packages/app/server/middleware/auth.ts` (validate session cookie, attach user)
- Modify: `packages/app/nuxt.config.ts` (runtimeConfig for github.clientId, clientSecret, redirectUri)

**Commit after this task.**

### Task 5: Auth-guarded pages and basic layout

Create the basic Nuxt page layout: login page (public), dashboard (protected), settings (protected), new project (protected). Use middleware to redirect unauthenticated users to login. Mobile-first responsive layout. Use the frontend-design skill for the UI.

**Files:**
- Create: `packages/app/middleware/auth.global.ts` (client-side auth guard)
- Create: `packages/app/server/api/auth/me.get.ts` (returns current user)
- Create: `packages/app/pages/login.vue`
- Create: `packages/app/pages/index.vue` (dashboard, placeholder)
- Create: `packages/app/pages/settings.vue` (placeholder)
- Create: `packages/app/pages/new.vue` (placeholder)
- Create: `packages/app/layouts/default.vue`

**Commit after this task.**

---

## Phase 3: Settings & Project Management API

### Task 6: Anthropic credential management

Settings page where users can enter their Anthropic API key or Claude Code OAuth token. Server route to save it encrypted. Server route to check if a credential exists (without returning the value).

**Files:**
- Create: `packages/app/server/api/settings/credential.put.ts` (save encrypted credential)
- Create: `packages/app/server/api/settings/credential.get.ts` (returns { hasCredential: boolean })
- Modify: `packages/app/pages/settings.vue` (form with input, save button, instructions)

**Commit after this task.**

### Task 7: Project CRUD API

Server routes for creating, listing, renaming, deleting, starting, and stopping projects. No actual K8s or GitHub integration yet — just database operations and status management. The K8s and GitHub parts will be wired in later tasks.

**Files:**
- Create: `packages/app/server/api/projects/index.get.ts` (list user's projects)
- Create: `packages/app/server/api/projects/index.post.ts` (create project)
- Create: `packages/app/server/api/projects/[slug]/index.patch.ts` (rename)
- Create: `packages/app/server/api/projects/[slug]/index.delete.ts` (delete)
- Create: `packages/app/server/api/projects/[slug]/start.post.ts` (placeholder)
- Create: `packages/app/server/api/projects/[slug]/stop.post.ts` (placeholder)

**Commit after this task.**

### Task 8: Dashboard UI

Implement the dashboard page with project cards. Each card shows project name, status (running/stopped), and has start/stop toggle, rename, and delete actions. "New Project" button navigates to `/new`. Use the frontend-design skill.

**Files:**
- Modify: `packages/app/pages/index.vue` (full dashboard implementation)
- Create: `packages/app/components/ProjectCard.vue`

**Commit after this task.**

---

## Phase 4: Scaffold System & GitHub Integration

### Task 9: Create the nuxt-postgres scaffold

Create the first scaffold. This is a minimal Nuxt 3 app with Postgres (via Drizzle), ready to run. Include a `CLAUDE.md` that tells Claude Code about the project setup.

**Files:**
- Create: `scaffolds/nuxt-postgres/package.json`
- Create: `scaffolds/nuxt-postgres/nuxt.config.ts`
- Create: `scaffolds/nuxt-postgres/tsconfig.json`
- Create: `scaffolds/nuxt-postgres/app.vue`
- Create: `scaffolds/nuxt-postgres/server/db/schema.ts` (example table)
- Create: `scaffolds/nuxt-postgres/server/utils/db.ts`
- Create: `scaffolds/nuxt-postgres/drizzle.config.ts`
- Create: `scaffolds/nuxt-postgres/CLAUDE.md`
- Create: `scaffolds/nuxt-postgres/.gitignore`

**Commit after this task.**

### Task 10: GitHub repo creation and scaffold push

Implement the GitHub integration: create a new repo for the user, push the scaffold files as the initial commit. Use Octokit with the user's stored GitHub access token (from OAuth). The scaffold is selected by name and all files from that `scaffolds/<name>/` folder are pushed.

**Files:**
- Create: `packages/app/server/utils/github.ts` (createRepo, pushScaffold functions using Octokit + Git Data API)
- Create: `packages/app/server/api/scaffolds/index.get.ts` (list available scaffolds by reading `scaffolds/` directory)
- Modify: `packages/app/server/api/projects/index.post.ts` (wire in GitHub repo creation + scaffold push)

**Commit after this task.**

### Task 11: New project page UI

Implement the create project page: scaffold picker (reads from API), project name input, create button. On success, navigates to dashboard. Use the frontend-design skill.

**Files:**
- Modify: `packages/app/pages/new.vue` (full implementation)

**Commit after this task.**

---

## Phase 5: Kubernetes Integration

### Task 12: K8s client setup and pod management

Implement the K8s integration: create/delete pods with PVC mounts, create/delete headless services, watch pod status until ready. The pod spec includes env vars for DB connection, Anthropic credential, and GitHub token.

**Files:**
- Create: `packages/app/server/utils/k8s.ts` (KubeConfig setup, createProjectPod, createProjectService, deleteProjectPod, deleteProjectService, waitForPodReady, createPVC, deletePVC)
- Modify: `packages/app/nuxt.config.ts` (runtimeConfig for k8s namespace, pod image, resource limits)

**Commit after this task.**

### Task 13: Wire K8s into project lifecycle

Connect the K8s utilities to the project API routes. Start creates pod + service + PVC, stores pod IP. Stop deletes pod + service. Delete also removes PVC. Create project now also creates the per-project Postgres database.

**Files:**
- Create: `packages/app/server/utils/project-db.ts` (createProjectDatabase, dropProjectDatabase — uses raw SQL to CREATE/DROP DATABASE)
- Modify: `packages/app/server/api/projects/index.post.ts` (wire in PVC creation + pod start + DB creation)
- Modify: `packages/app/server/api/projects/[slug]/start.post.ts` (create pod + service, wait for ready, store IP)
- Modify: `packages/app/server/api/projects/[slug]/stop.post.ts` (delete pod + service)
- Modify: `packages/app/server/api/projects/[slug]/index.delete.ts` (stop + delete PVC + drop DB)

**Commit after this task.**

---

## Phase 6: Reverse Proxy

### Task 14: Subdomain-based auth proxy

Implement the Nitro server middleware that intercepts requests to `<project>.domain` and `preview.<project>.domain` subdomains. Parse the Host header, validate the session cookie, look up the pod, and proxy the request. Use `h3.proxyRequest` for HTTP. Use `httpxy` for WebSocket upgrade requests (hooked into the Node.js server's `upgrade` event via a Nitro plugin).

**Files:**
- Create: `packages/app/server/middleware/proxy.ts` (parse subdomain, auth check, HTTP proxy)
- Create: `packages/app/server/plugins/ws-proxy.ts` (WebSocket upgrade proxy via httpxy)
- Create: `packages/app/server/utils/proxy.ts` (parseSubdomain helper, resolveTarget helper)

**Commit after this task.**

---

## Phase 7: Pod Server

### Task 15: Hono server with file API

Build out the pod server: static SPA serving, file tree endpoint (using fdir), file read/write endpoints, health check, and reverse proxy to the dev server on port 3000.

**Files:**
- Modify: `packages/pod-server/src/index.ts` (full Hono server setup)
- Create: `packages/pod-server/src/routes/files.ts` (file tree, read, write)
- Create: `packages/pod-server/src/routes/health.ts`

**Commit after this task.**

### Task 16: Agent SDK WebSocket bridge

Implement the WebSocket endpoint that bridges browser messages to the Claude Agent SDK. Use the V1 `query()` function with an async generator pattern for multi-turn conversation. Forward SDK streaming events to the browser as JSON.

**Files:**
- Create: `packages/pod-server/src/routes/ws.ts` (WebSocket handler, async generator message bridge, SDK session management)

Reference projects for patterns:
- `claude-agent-server` by dzhng (async generator pattern)
- `claude-agent-kit` by JimLiu (session management)

**Commit after this task.**

### Task 17: Pod startup script

Create the entrypoint script that runs the startup sequence: git clone (if needed), npm install, start dev server with auto-restart, start the Hono server.

**Files:**
- Create: `packages/pod-server/src/dev-server.ts` (child_process.spawn wrapper with auto-restart)
- Create: `packages/pod-server/scripts/entrypoint.sh` (orchestrates startup)

**Commit after this task.**

### Task 18: Pod container image

Create the Dockerfile for the pod container. Based on Node.js LTS, installs git and common dev tools, copies the pod-server build, sets the entrypoint.

**Files:**
- Create: `packages/pod-server/Dockerfile`
- Create: `packages/pod-server/.dockerignore`

**Commit after this task.**

---

## Phase 8: Editor SPA (Mobile-First UI)

### Task 19: Editor SPA scaffolding

Initialize a Vue 3 SPA inside `packages/editor`. This is the mobile-first UI served from inside the pod. Set up Vue Router, bottom tab navigation (Chat, Files, Preview), and the VS Code dark theme. Use the frontend-design skill.

**Files:**
- Create: `packages/editor/package.json`
- Create: `packages/editor/vite.config.ts`
- Create: `packages/editor/src/main.ts`
- Create: `packages/editor/src/App.vue` (bottom nav bar, router-view)
- Create: `packages/editor/src/router.ts` (chat, files, preview routes)
- Create: `packages/editor/src/views/ChatView.vue` (placeholder)
- Create: `packages/editor/src/views/FilesView.vue` (placeholder)
- Create: `packages/editor/src/views/PreviewView.vue` (placeholder)
- Create: `packages/editor/index.html`

The built SPA will be copied into the pod-server's static directory during the Docker build.

**Commit after this task.**

### Task 20: Chat view

Implement the chat interface. WebSocket connection to `/ws`. Streaming message display with markdown rendering. User input at the bottom, optimized for mobile keyboard. Show tool usage inline (file edits, bash commands). VS Code dark theme. Use the frontend-design skill.

**Files:**
- Modify: `packages/editor/src/views/ChatView.vue`
- Create: `packages/editor/src/composables/useWebSocket.ts` (WebSocket connection, reconnect, message parsing)
- Create: `packages/editor/src/components/ChatMessage.vue` (renders assistant/user/tool messages)
- Create: `packages/editor/src/components/ChatInput.vue` (mobile-optimized text input)

**Commit after this task.**

### Task 21: Files view

Implement the file browser. File tree on initial view (fetched from `/api/files`), tap to open a file in CodeMirror 6 (full screen, back button to return to tree). CodeMirror configured as read-only by default with an edit toggle. VS Code dark theme. Use the frontend-design skill.

**Files:**
- Modify: `packages/editor/src/views/FilesView.vue`
- Create: `packages/editor/src/components/FileTree.vue` (recursive tree, VS Code-style)
- Create: `packages/editor/src/components/CodeViewer.vue` (CodeMirror 6 setup, read/edit toggle)
- Create: `packages/editor/src/composables/useFiles.ts` (fetch tree, fetch file content, save file)

**Commit after this task.**

### Task 22: Preview view

Implement the preview tab. Full-screen iframe pointing to `preview.<project>.portable.example.com`. Detect the current project subdomain and construct the preview URL.

**Files:**
- Modify: `packages/editor/src/views/PreviewView.vue`

**Commit after this task.**

---

## Phase 9: Helm Chart

### Task 23: Helm chart

Create the Helm chart for deploying the main app, Postgres, RBAC, and supporting resources. Include configurable values for domain, GitHub OAuth, Postgres, cert-manager, and pod resource limits.

**Files:**
- Create: `deploy/helm/portable/Chart.yaml`
- Create: `deploy/helm/portable/values.yaml`
- Create: `deploy/helm/portable/templates/deployment.yaml` (main app)
- Create: `deploy/helm/portable/templates/service.yaml`
- Create: `deploy/helm/portable/templates/ingress.yaml` (wildcard)
- Create: `deploy/helm/portable/templates/postgres.yaml` (StatefulSet + Service + PVC)
- Create: `deploy/helm/portable/templates/rbac.yaml` (ServiceAccount + Role + RoleBinding)
- Create: `deploy/helm/portable/templates/configmap.yaml` (pod resource defaults)
- Create: `deploy/helm/portable/templates/secret.yaml` (GitHub OAuth, encryption key, DB password)
- Create: `deploy/helm/portable/templates/_helpers.tpl`

**Commit after this task.**

---

## Phase 10: Main App Container & Integration Testing

### Task 24: Main app Dockerfile

Create the Dockerfile for the main Nuxt app. Multi-stage build: install deps, build Nuxt, copy output to slim runtime image.

**Files:**
- Create: `packages/app/Dockerfile`
- Create: `packages/app/.dockerignore`

**Commit after this task.**

### Task 25: End-to-end smoke test

Write a basic integration test or test script that verifies the full flow locally (requires a running K8s cluster like minikube/kind). Document how to set up the local dev environment.

**Files:**
- Create: `docs/development.md` (local dev setup: minikube/kind, env vars, running both packages)
- Create: `scripts/dev-setup.sh` (automated local dev environment setup)

**Commit after this task.**

---

## Execution Order & Dependencies

```
Phase 1 (foundation) → Phase 2 (auth) → Phase 3 (settings & CRUD)
                                          ↓
Phase 4 (scaffolds & GitHub) → Phase 5 (K8s) → Phase 6 (proxy)
                                                    ↓
Phase 7 (pod server) → Phase 8 (editor SPA) → Phase 9 (Helm) → Phase 10 (containers)
```

Phases are sequential. Tasks within a phase can sometimes be parallelized (noted where applicable).
