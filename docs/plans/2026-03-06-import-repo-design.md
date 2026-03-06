# Import Existing GitHub Repo

> **Status: Implemented.** This design has been fully implemented. See the implementation plan at `docs/plans/2026-03-06-import-repo-plan.md` for task details.

## Overview

Add the ability to import an existing GitHub repository as a Portable project, as an alternative to creating from a scaffold.

## UI Changes

The `/new` page gets two tabs at the top: **"From Scaffold"** (current behavior, default) and **"Import Repo"**.

The "Import Repo" tab shows:

- A searchable list of the user's GitHub repos, fetched via their stored GitHub token
- Repos displayed as cards showing name, description, visibility (public/private), and language
- A search/filter input at the top
- Once a repo is selected, the project name auto-fills from the repo name (editable)
- Slug preview below the name, same as current flow
- "Import" button to create the project

The scaffold tab stays exactly as-is.

## API Changes

### New endpoint: `GET /api/github/repos`

Returns the authenticated user's GitHub repos using their stored GitHub token. Supports a `search` query parameter for filtering.

Returns: `{ repos: [{ name, fullName, description, private, language, defaultBranch, url }] }`

### Modified endpoint: `POST /api/projects`

Currently accepts `{ name, scaffoldId }`. Changes to accept either:

- `{ name, scaffoldId }` -- scaffold flow (unchanged)
- `{ name, repoUrl }` -- import flow (new)

Validates that exactly one of `scaffoldId` or `repoUrl` is provided. For import flow: validates the repo URL format, stores it directly on the project row.

### Modified `createProject()` in project-lifecycle.ts

Currently runs: create DB -> create GitHub repo -> push scaffold files.

For imports: create DB -> done (skip repo creation and scaffold push). The `repoUrl` is already set on the project row, so the pod server clones it automatically when started.

## Schema Change

`scaffoldId` column becomes nullable (currently required with default `"nuxt-postgres"`). A project with `scaffoldId = null` and `repoUrl` set = imported repo.

## Data Flow (Import)

1. User selects repo from list -> submits form
2. `POST /api/projects` creates DB row with `status: "creating"`, `repoUrl` from selected repo, `scaffoldId: null`
3. Async `createProject()` runs: creates per-project Postgres database, then sets status to `"stopped"` (skips repo creation and scaffold push)
4. When user starts the project, the pod gets `GITHUB_REPO_URL` env var -> pod server clones it as usual

No changes needed to the pod server.

## Validation

- **Repo already imported:** Validate `repoUrl` uniqueness per user at the API level. Return clear error if repo is already linked to a project.
- **Private repos:** Work fine -- the user's GitHub token (from OAuth login) is injected into clone URLs, same as existing flow.
- **Empty/broken repos:** No special handling. Pod clones whatever is there. If no `dev` script exists, dev server supervisor retries with backoff (existing behavior). User can fix via Claude Code chat.
