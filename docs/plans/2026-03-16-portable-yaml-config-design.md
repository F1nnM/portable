# Configurable Pod Operations via .portable.yaml

## Problem

The pod server hardcodes `bun install`, `bun run build`, `bun run preview`, and port `3001`. This ties the platform to a specific toolchain and makes it impossible for different scaffolds or imported repos to define their own lifecycle commands.

## Design

### .portable.yaml Format

Each scaffold defines operational config in `.portable.yaml` at the project root:

```yaml
prepare: bun install
serve: bun install && bun run build && bun run preview
frontendPort: 3000

scaffold:
  repo: https://github.com/user/portable
  path: scaffolds/nuxt-postgres
  version: abc123
```

- **prepare** -- One-time setup command after clone (e.g. install dependencies).
- **serve** -- Long-running command managed by the supervisor. Handles deps, build, and serving in one command. Killed and re-run on each rebuild.
- **frontendPort** -- Port the serve command's process listens on for HTTP.
- **scaffold** -- Dynamically generated section tracking scaffold origin and version.

If the file is missing or a field is missing, that step is skipped.

### Scaffold .portable.yaml Merge

The `scaffold` section is dynamically generated at project creation time. `generatePortableYaml()` must merge the `scaffold:` section into the existing `.portable.yaml` content (preserving `prepare`, `serve`, `frontendPort`) rather than generating a standalone file.

### Pod Server Changes

#### Setup Flow

Simplified lifecycle after the pod starts:

1. Start HTTP server (health endpoint available immediately)
2. Clone repo (if workspace empty and `GITHUB_REPO_URL` set)
3. Read `.portable.yaml` from workspace root
4. Run `prepare` command if defined -- phase: `preparing`
5. Start `serve` command via supervisor if defined -- phase: `serving`
6. Phase: `ready`

Setup phases change from `initializing -> cloning -> installing -> building -> starting_server -> ready` to `initializing -> cloning -> preparing -> serving -> ready`.

#### Config Reading

New module reads and parses `.portable.yaml` from the workspace directory after clone. Exposes typed config: `{ prepare?: string, serve?: string, frontendPort?: number }`.

#### Serve Supervisor

The existing `DevServerSupervisor` is repurposed:

- Command comes from `.portable.yaml` `serve` field (not `DEV_SERVER_COMMAND` env var)
- `PORT` env var set to `frontendPort` value from config
- All existing supervisor behavior preserved (auto-restart, exponential backoff, graceful shutdown)

#### Rebuild Endpoint

`POST /api/rebuild` no longer runs a separate build command. It tells the supervisor to kill the current `serve` process and start it again. The serve command itself handles install + build + preview.

Debounce support is preserved: the post-commit hook still hits `/api/rebuild?debounce=3000`.

#### Build State

Adapted to track serve lifecycle:

- `lastServeCommit` -- HEAD when serve was last (re)started
- `currentHead` -- current HEAD
- `isRestarting` -- whether serve is currently being restarted
- `lastServeError` -- error from last serve start/crash
- `unbuiltCommitCount` -- commits since last serve restart

`GET /api/rebuild/status` returns this adapted state. The App tab UI consumes it unchanged.

#### Health Endpoint

Extended to expose parsed config:

```json
{ "status": "ok", "phase": "ready", "config": { "frontendPort": 3000 } }
```

### Main App Changes

#### Frontend Port Cache

In-memory `Map<slug, number>` caching `frontendPort` per project. Populated from pod health endpoint responses. No DB column needed.

- `GET /api/projects/:slug/status` already polls the pod's health. When it receives a response, it updates the cache if the port value differs.
- On main app restart, the cache starts empty and re-populates from the next health polls.

#### Preview Proxy

Uses the cached `frontendPort` instead of hardcoded 3001. If a preview subdomain request arrives for a project not in the cache, makes one health call to the pod to learn the port. If no `frontendPort` is configured (null/missing), returns 404 for preview requests.

### Removed

- `DEV_SERVER_COMMAND` environment variable
- Hardcoded `bun install` in setup
- Hardcoded `bun run build` in setup and rebuild
- Hardcoded `bun run preview` default
- Hardcoded port 3001 for dev server
- `record-initial-commit.ts` (replaced by recording commit when serve first starts)
- Separate build logic in `setup.ts`
- Separate `bun run build` invocation in `rebuild.ts`

### Imported Repos

Same path as scaffold projects. The pod server reads `.portable.yaml` after clone. If the file doesn't exist or lacks fields, those steps are skipped (no prepare, no serve, no preview). The existing "migrate" prompt in the UI already handles guiding users to add the file.
