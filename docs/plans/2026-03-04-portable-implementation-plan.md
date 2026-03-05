# Portable Implementation Plan

**Goal:** Build a mobile-first web app for remote Claude Code usage, with per-project K8s pods.

**Architecture:** Nuxt full-stack main app handles auth, project management, and proxies traffic to per-project K8s pods. Each pod runs a Hono server with the Claude Agent SDK, a dev server, and serves the editor SPA.

**Tech Stack:** Nuxt 3, Drizzle ORM, Hono, Claude Agent SDK, CodeMirror 6, `@kubernetes/client-node`, Octokit, Arctic, Helm, k3d, Tilt, mise

**Design Doc:** `docs/plans/2026-03-04-portable-design.md`

---

## Development Methodology

### Red-Green-Refactor (TDD)

Every feature follows this cycle:

1. **Red:** Write a failing test that describes the desired behavior
2. **Green:** Write the minimal implementation to make the test pass
3. **Refactor:** Clean up while keeping tests green

Test frameworks:

- `vitest` for all packages (app server routes, pod-server, editor components)
- `@vue/test-utils` for Vue component tests
- `supertest` or direct handler invocation for API route tests

### Subagent Workflow

Each phase is executed as follows:

1. **Implementation subagent(s)** — One per task (or parallelized where tasks are independent). Each agent:
   - Reads the task description and relevant docs
   - Explores the codebase to validate assumptions
   - If the plan is wrong or there's a better approach: **updates the plan** with findings before proceeding
   - Follows Red-Green-Refactor
   - Commits after each task
   - Marks the task as `[DONE]` in this plan and adds a one-line summary of what was actually done

2. **Code review subagent** — After each phase (or batch of tasks):
   - Reviews all changes against the plan and coding standards in `CLAUDE.md`
   - Fixes any issues found
   - Commits fixes

3. **Documentation subagent** — After code review:
   - Updates `CLAUDE.md`, `README.md`, and `docs/*.md` with new information from the completed tasks
   - Updates `docs/progress.md` with a summary of what was done
   - Commits documentation changes

### Plan Updates

Subagents MUST update this plan when they encounter:

- A wrong assumption (mark with `[PLAN UPDATED]` and explain)
- A better approach than what was planned
- A roadblock that requires changing the approach
- Additional tasks that need to be inserted

---

## Documentation Structure

Created and maintained continuously throughout implementation.

| File                   | Purpose                                                                          | Audience                 |
| ---------------------- | -------------------------------------------------------------------------------- | ------------------------ |
| `CLAUDE.md`            | How to work with the codebase: project structure, commands, conventions, testing | AI agents and developers |
| `README.md`            | What is Portable, features, quick-start deployment, screenshots                  | Potential users          |
| `docs/architecture.md` | System architecture, component interactions, data flow                           | Developers               |
| `docs/development.md`  | Local dev setup, dev workflow, running tests, linting                            | Contributors             |
| `docs/deployment.md`   | Production deployment via Helm, prerequisites, configuration                     | Operators                |
| `docs/api.md`          | Main app API routes reference                                                    | Developers               |
| `docs/pod-server.md`   | Pod server internals, WebSocket protocol, Agent SDK bridge                       | Developers               |
| `docs/progress.md`     | Agent progress log: what was done, by whom, when, decisions made                 | Traceability             |

---

## Phase 1: Dev Environment, Tooling & Testing Infrastructure

> This phase sets up everything needed for TDD from the start: monorepo, linting, formatting, test runners, Dockerfiles, Helm chart, Tilt, and initial documentation.

### Task 1.1: Monorepo structure and mise config `[DONE]`

Set up the repository structure with mise for tool management.

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
```

Initialize all three packages with minimal working code (hello world level).

**Files:**

- Create: `.mise.toml`, `pnpm-workspace.yaml`, `package.json`, `.gitignore`
- Create: `packages/app/` (Nuxt init with minimal config)
- Create: `packages/pod-server/` (Hono with `/health` endpoint)
- Create: `packages/editor/` (Vue 3 + Vite, minimal App.vue)

### Task 1.2: Linting, formatting, and shared config `[DONE]`

Set up ESLint and Prettier across all packages. Shared config at the root. Husky + lint-staged for pre-commit hooks.

**Files:**

- Create: `eslint.config.js` (flat config, TypeScript, Vue support)
- Create: `.prettierrc`
- Create: `.lintstagedrc`
- Modify: `package.json` (add lint/format scripts, husky, lint-staged)
- Each package inherits root config

### Task 1.3: Testing infrastructure `[ ]`

Set up vitest in all three packages. Each package should have at least one passing smoke test to verify the setup works.

- `packages/app`: vitest with `@nuxt/test-utils` for server route testing
- `packages/pod-server`: vitest for Hono route testing
- `packages/editor`: vitest with `@vue/test-utils` for component testing

**Files:**

- Create: `packages/app/vitest.config.ts` + `packages/app/tests/smoke.test.ts`
- Create: `packages/pod-server/vitest.config.ts` + `packages/pod-server/tests/smoke.test.ts`
- Create: `packages/editor/vitest.config.ts` + `packages/editor/tests/smoke.test.ts`
- Modify: root `package.json` (add `test` script that runs all)

### Task 1.4: Dockerfiles `[ ]`

Create Dockerfiles for both containers so Tilt can build them.

- Main app: multi-stage (install, build Nuxt, slim runtime)
- Pod server: Node.js LTS, git, dev tools, copies pod-server build + editor SPA dist

**Files:**

- Create: `packages/app/Dockerfile`, `packages/app/.dockerignore`
- Create: `packages/pod-server/Dockerfile`, `packages/pod-server/.dockerignore`

### Task 1.5: Helm chart (base) `[ ]`

Base Helm chart: main app Deployment + Service + Ingress (wildcard `*.<domain>`), Postgres StatefulSet + Service + PVC, RBAC, Secrets, ConfigMap. Dev-friendly defaults.

Required Helm values: `domain`, `github.clientId`, `github.clientSecret`, `postgres.password`, `encryptionKey`.
Optional: `certManager.enabled`, `pod.resources.*`, `pod.storage`, `image.repository`, `image.tag`.

RBAC must grant the main app's ServiceAccount: pods, persistentvolumeclaims, services (create, get, list, watch, delete) in the project namespace.

Default pod resource limits in ConfigMap: CPU 500m request / 2000m limit, Memory 512Mi request / 4Gi limit, PVC 5Gi.

**Files:**

- Create: `deploy/helm/portable/` (Chart.yaml, values.yaml, templates/\*)

### Task 1.6: Tiltfile and dev setup `[ ]`

Tiltfile that builds images via k3d registry, deploys via Helm with dev overrides, uses `live_update` for code syncing. Dev setup script and docs.

**All components (main app, Postgres, project pods) run inside the k3d cluster. No process runs on the host outside of K8s.** This is a deliberate architectural constraint to keep networking simple and avoid "works locally but not in K8s" bugs.

Local domain: `portable.127.0.0.1.nip.io`

**Files:**

- Create: `Tiltfile`
- Create: `deploy/dev-values.yaml`
- Create: `scripts/dev-setup.sh`

### Task 1.7: Initial documentation `[ ]`

Create all documentation files with initial content. `CLAUDE.md` with project structure, commands, conventions. `README.md` with project overview. Other docs as stubs that will be filled in.

**Files:**

- Create: `CLAUDE.md`
- Create: `README.md`
- Create: `docs/architecture.md`
- Create: `docs/development.md`
- Create: `docs/deployment.md`
- Create: `docs/api.md`
- Create: `docs/pod-server.md`
- Create: `docs/progress.md`

---

## Phase 2: Database & Auth

> Prerequisite: Phase 1 complete. All tasks follow TDD.

### Task 2.1: Database schema and Drizzle setup `[ ]`

Drizzle ORM with `postgres.js` driver. Schema for `users`, `projects`, `sessions`. Migration tooling. Auto-migrate on server start via Nitro plugin.

**Tests:** Schema validation, migration runs without error, basic CRUD operations on each table.

**Files:**

- Create: `packages/app/server/db/schema.ts`
- Create: `packages/app/server/utils/db.ts`
- Create: `packages/app/server/plugins/migrate.ts`
- Create: `packages/app/drizzle.config.ts`

### Task 2.2: Credential encryption utility `[ ]`

AES-256-GCM encrypt/decrypt using `node:crypto`.

**Tests:** Encrypt then decrypt round-trip. Different inputs produce different ciphertexts. Tampered ciphertext fails decryption. Missing key throws.

**Files:**

- Create: `packages/app/server/utils/crypto.ts`
- Create: `packages/app/tests/utils/crypto.test.ts`

### Task 2.3: GitHub OAuth flow `[ ]`

Arctic GitHub OAuth: login redirect, callback (upsert user, create session), logout. Auth middleware attaches user to context. Store GitHub token encrypted.

**Tests:** Middleware attaches user for valid session. Middleware sets null for invalid/missing session. Callback creates user on first login. Callback updates existing user. Logout deletes session.

**Files:**

- Create: `packages/app/server/utils/auth.ts`
- Create: `packages/app/server/routes/auth/github/index.get.ts`
- Create: `packages/app/server/routes/auth/github/callback.get.ts`
- Create: `packages/app/server/routes/auth/logout.post.ts`
- Create: `packages/app/server/middleware/auth.ts`

### Task 2.4: Auth-guarded pages and layout `[ ]`

Login page (public), dashboard/settings/new (protected). Client-side auth guard. Mobile-first layout. Use the frontend-design skill.

**Tests:** Unauthenticated user redirected to login. Authenticated user can access dashboard. `/api/auth/me` returns user data.

**Files:**

- Create: `packages/app/middleware/auth.global.ts`
- Create: `packages/app/server/api/auth/me.get.ts`
- Create: `packages/app/pages/login.vue`
- Create: `packages/app/pages/index.vue` (placeholder)
- Create: `packages/app/pages/settings.vue` (placeholder)
- Create: `packages/app/pages/new.vue` (placeholder)
- Create: `packages/app/layouts/default.vue`

---

## Phase 3: Project Management

> Tasks 3.1 and 3.2 can be parallelized.

### Task 3.1: Anthropic credential management `[ ]`

Settings page: enter API key or Claude Code OAuth token. Save encrypted. Check existence endpoint.

**Tests:** PUT saves encrypted credential. GET returns `{ hasCredential: true/false }`. Credential never returned in plaintext via API.

**Files:**

- Create: `packages/app/server/api/settings/credential.put.ts`
- Create: `packages/app/server/api/settings/credential.get.ts`
- Modify: `packages/app/pages/settings.vue`

### Task 3.2: Project CRUD API `[ ]`

Create, list, rename, delete projects. Database only — K8s/GitHub wired later.

**Tests:** Create project returns slug. List returns only user's projects. Rename updates name. Delete removes project. Duplicate slugs rejected.

**Files:**

- Create: `packages/app/server/api/projects/index.get.ts`
- Create: `packages/app/server/api/projects/index.post.ts`
- Create: `packages/app/server/api/projects/[slug]/index.patch.ts`
- Create: `packages/app/server/api/projects/[slug]/index.delete.ts`
- Create: `packages/app/server/api/projects/[slug]/start.post.ts` (placeholder)
- Create: `packages/app/server/api/projects/[slug]/stop.post.ts` (placeholder)

### Task 3.3: Dashboard UI `[ ]`

Project cards: name, status, start/stop, rename, delete. "New Project" button. Use the frontend-design skill.

**Tests:** Renders project list. Shows correct status indicators. Start/stop buttons call correct API. Rename dialog works. Delete confirms before acting.

**Files:**

- Modify: `packages/app/pages/index.vue`
- Create: `packages/app/components/ProjectCard.vue`

---

## Phase 4: Scaffold System & GitHub Integration

### Task 4.1: Create the nuxt-postgres scaffold `[ ]`

Minimal Nuxt 3 + Postgres (Drizzle) scaffold. Includes `CLAUDE.md` for Claude Code.

**Tests:** Scaffold directory exists and contains required files. `package.json` is valid. `CLAUDE.md` contains dev server instructions.

**Files:**

- Create: `scaffolds/nuxt-postgres/` (all scaffold files)

### Task 4.2: GitHub repo creation and scaffold push `[ ]`

Octokit: create repo, push scaffold via Git Data API. List available scaffolds.

**Tests:** `listScaffolds()` returns available scaffolds. `createRepo()` calls GitHub API correctly (mock Octokit). `pushScaffold()` creates initial commit with all scaffold files.

**Files:**

- Create: `packages/app/server/utils/github.ts`
- Create: `packages/app/server/api/scaffolds/index.get.ts`
- Modify: `packages/app/server/api/projects/index.post.ts` (wire in GitHub)

### Task 4.3: New project page UI `[ ]`

Scaffold picker, project name input, create button. Use the frontend-design skill.

**Tests:** Renders scaffold options. Validates project name. Calls create API on submit. Shows loading state. Redirects on success.

**Files:**

- Modify: `packages/app/pages/new.vue`

---

## Phase 5: Kubernetes Integration

### Task 5.1: K8s client and pod management `[ ]`

`@kubernetes/client-node`: create/delete pods with PVC mounts + env vars, create/delete headless services (`clusterIP: None`) for stable DNS at `project-<slug>.<namespace>.svc.cluster.local`, watch pod status, create/delete PVCs.

Pod env vars to inject: `DATABASE_URL` (per-project DB connection string), `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` (user's credential), `GITHUB_TOKEN` (user's GitHub access token).

Default pod resources: CPU 500m request / 2000m limit, Memory 512Mi request / 4Gi limit, PVC 5Gi.

**Tests:** `createProjectPod()` creates pod with correct spec including all env vars (mock K8s API). `createProjectService()` creates service with `clusterIP: None`. `waitForPodReady()` resolves when pod Ready condition is true. `stopProject()` deletes pod and service. PVC creation with 5Gi size and ReadWriteOnce access mode.

**Files:**

- Create: `packages/app/server/utils/k8s.ts`

### Task 5.2: Wire K8s into project lifecycle `[ ]`

Connect K8s to project API routes. Start = pod + service + PVC. Stop = delete pod + service. Delete = PVC + DB. Create project also creates per-project Postgres DB.

**Tests:** Start endpoint creates pod and service, updates project status. Stop endpoint deletes pod and service. Delete endpoint cleans up PVC + DB but does NOT delete the GitHub repo (user does this manually). Error handling: pod creation failure rolls back.

**Files:**

- Create: `packages/app/server/utils/project-db.ts`
- Modify: `packages/app/server/api/projects/index.post.ts`
- Modify: `packages/app/server/api/projects/[slug]/start.post.ts`
- Modify: `packages/app/server/api/projects/[slug]/stop.post.ts`
- Modify: `packages/app/server/api/projects/[slug]/index.delete.ts`

---

## Phase 6: Reverse Proxy

### Task 6.1: Subdomain-based auth proxy `[ ]`

Nitro middleware: parse Host header, validate session, proxy via `h3.proxyRequest`. Nitro plugin for WebSocket upgrade via `httpxy`.

**Tests:** `parseSubdomain()` correctly extracts slug and type. `<project>.domain` routes to pod editor port. `preview.<project>.domain` routes to pod dev server port. Unauthenticated requests get 401. Unknown projects get 404. WebSocket upgrade is proxied.

**Files:**

- Create: `packages/app/server/utils/proxy.ts`
- Create: `packages/app/server/middleware/proxy.ts`
- Create: `packages/app/server/plugins/ws-proxy.ts`

---

## Phase 7: Pod Server

> Tasks 7.1 and 7.2 can be parallelized.

### Task 7.1: Hono server with file API `[ ]`

Static SPA serving, file tree (fdir), file read/write, health check.

**Tests:** `/health` returns 200. `/api/files` returns file tree excluding node_modules/.git. `/api/files/:path` returns file content. `PUT /api/files/:path` writes file. 404 for nonexistent files. Path traversal blocked.

**Files:**

- Modify: `packages/pod-server/src/index.ts`
- Create: `packages/pod-server/src/routes/files.ts`
- Create: `packages/pod-server/src/routes/health.ts`

### Task 7.2: Agent SDK WebSocket bridge `[ ]`

WebSocket bridging browser to Claude Agent SDK. V1 `query()` with async generator for multi-turn. Forward SDK events as JSON.

**Tests:** WebSocket connection established. User message forwarded to SDK. SDK streaming events forwarded to browser. Interrupt message cancels current query. Connection cleanup on disconnect.

**Files:**

- Create: `packages/pod-server/src/routes/ws.ts`

### Task 7.3: Pod startup and dev server supervisor `[ ]`

Entrypoint: git clone (if needed), npm install, start dev server with auto-restart, start Hono server.

**Tests:** Dev server restarts after crash. Restart has backoff. Git clone skipped when PVC has files. npm install runs when node_modules missing.

**Files:**

- Create: `packages/pod-server/src/dev-server.ts`
- Create: `packages/pod-server/scripts/entrypoint.sh`

---

## Phase 8: Editor SPA (Mobile-First UI)

> Task 8.1 first, then 8.2-8.4 can be parallelized.

### Task 8.1: Editor SPA scaffolding and navigation `[ ]`

Vue 3 SPA, bottom tab nav (Chat, Files, Preview), VS Code dark theme, mobile layout. Use the frontend-design skill.

**Tests:** Bottom nav renders three tabs. Tab switching shows correct view. Active tab highlighted.

**Files:**

- Modify: `packages/editor/src/main.ts`, `src/App.vue`
- Create: `packages/editor/src/router.ts`
- Create: `packages/editor/src/views/ChatView.vue` (placeholder)
- Create: `packages/editor/src/views/FilesView.vue` (placeholder)
- Create: `packages/editor/src/views/PreviewView.vue` (placeholder)

### Task 8.2: Chat view `[ ]`

WebSocket chat. Streaming markdown messages. Mobile keyboard input. Tool usage inline. Use the frontend-design skill.

**Tests:** Connects to WebSocket on mount. Renders user and assistant messages. Renders tool use blocks. Input sends message via WebSocket. Loading indicator during streaming.

**Files:**

- Modify: `packages/editor/src/views/ChatView.vue`
- Create: `packages/editor/src/composables/useWebSocket.ts`
- Create: `packages/editor/src/components/ChatMessage.vue`
- Create: `packages/editor/src/components/ChatInput.vue`

### Task 8.3: Files view `[ ]`

File tree, tap opens CodeMirror 6 full-screen, back button, read-only default with edit toggle. Use the frontend-design skill.

**Tests:** File tree fetched and rendered. Tap file navigates to viewer. CodeMirror renders code. Edit toggle switches mode. Save calls PUT API. Back returns to tree.

**Files:**

- Modify: `packages/editor/src/views/FilesView.vue`
- Create: `packages/editor/src/components/FileTree.vue`
- Create: `packages/editor/src/components/CodeViewer.vue`
- Create: `packages/editor/src/composables/useFiles.ts`

### Task 8.4: Preview view `[ ]`

Full-screen iframe to `preview.<project>.domain`. Detect subdomain, construct URL.

**Tests:** Iframe src constructed correctly from current hostname. Renders iframe full-screen.

**Files:**

- Modify: `packages/editor/src/views/PreviewView.vue`

---

## Phase 9: Helm Chart Finalization

### Task 9.1: Complete Helm chart `[ ]`

Extend base chart: cert-manager Certificate (optional), full values documentation, NOTES.txt with post-install instructions.

**Tests:** `helm template` renders without errors. `helm lint` passes.

**Files:**

- Modify: `deploy/helm/portable/values.yaml`
- Create: `deploy/helm/portable/templates/certificate.yaml`
- Create: `deploy/helm/portable/templates/NOTES.txt`

---

## Execution Order

```
Phase 1 (dev env, tooling, testing, docs)
  ↓
Phase 2 (DB, encryption, auth, pages)
  ↓
Phase 3 (settings, project CRUD, dashboard) — 3.1 ∥ 3.2, then 3.3
  ↓
Phase 4 (scaffold, GitHub, new project UI)
  ↓
Phase 5 (K8s client, wire lifecycle)
  ↓
Phase 6 (subdomain proxy)
  ↓
Phase 7 (pod server: files ∥ SDK bridge, then startup)
  ↓
Phase 8 (editor: scaffold, then chat ∥ files ∥ preview)
  ↓
Phase 9 (Helm finalization)
```

`∥` = can be parallelized.

After each phase: code review subagent → documentation subagent.
