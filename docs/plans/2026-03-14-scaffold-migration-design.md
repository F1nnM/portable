# Scaffold Migration Design

## Problem

Scaffolds evolve over time to align with new app functionality. Projects created from older scaffold versions may break or miss features. Users need a way to migrate existing projects to the latest scaffold version.

## Solution

Track scaffold versions via a `.portable.yaml` file in each project repo. When a version mismatch is detected, show a warning on the intermediary screen with a "Migrate" button that opens a new chat session with a pre-filled prompt instructing Claude to apply the scaffold changes.

## `.portable.yaml` File

Placed in the project repo root at scaffold creation time. YAML format, extensible for future use.

```yaml
scaffold:
  repo: https://github.com/user/portable
  path: scaffolds/nuxt-postgres
  version: abc123def456
```

- `repo` -- public URL of the portable repository containing scaffolds
- `path` -- path to the scaffold directory within that repo at the recorded version
- `version` -- git commit hash of the portable repo when the scaffold was applied

This file is the single source of truth for scaffold version tracking.

## Version Detection

### Deployed scaffold version

The current scaffold version is the git commit hash of the portable repo baked into the app's Docker image at build time.

- **Production:** Passed as a build arg in CI, exposed as `NUXT_SCAFFOLD_VERSION` env var via the Helm chart.
- **Local dev (Tilt):** The Tiltfile computes `git rev-parse HEAD` and injects it as an env var.
- **Fallback:** If `NUXT_SCAFFOLD_VERSION` is unset, compute at startup from git (only works in dev where `.git` is available).

The portable repo URL is configured via `NUXT_SCAFFOLD_REPO_URL` env var (Helm chart value).

### Project scaffold version

Read from `.portable.yaml` in the project workspace via the pod file API: `GET /api/projects/:slug/pod/api/files/.portable.yaml`.

This check only happens when the project is running (the pod must be available to read the file).

### Migration needed when

A project needs migration when it is running and:

- **File exists, version mismatch:** `scaffoldVersion` in `.portable.yaml` differs from current `NUXT_SCAFFOLD_VERSION`
- **File missing, project has scaffoldId:** Old project created before this feature. Same migration flow, but the prompt notes there is no baseline version.
- **File missing, no scaffoldId (imported project):** Project was not created from a scaffold. Show a different warning: "This project may not be configured for Portable." Offer the user a scaffold picker, then open a chat with a setup prompt.

## Intermediary Screen Changes

Currently, `/projects/[slug]` auto-redirects to `/projects/[slug]/chat` when a project is running. The new flow:

1. Fetch project data (as today)
2. If project is running, read `.portable.yaml` from the pod
3. **If migration/setup is needed:** Block the auto-redirect. Show the intermediary screen with:
   - A warning banner explaining the situation
   - For scaffold version mismatch: a **"Migrate"** button
   - For missing file on imported project: a scaffold picker dropdown + **"Set up for Portable"** button
   - A **"Continue without migrating"** link to proceed to chat anyway
4. **If no migration needed:** Auto-redirect to chat as before

For stopped/error projects, show the normal start/stop UI without migration checks (pod not available to read the file).

## Chat Pre-fill Flow

When the user clicks "Migrate" (or "Set up for Portable"):

1. Navigate to `/projects/[slug]/chat?migrate=1` (with necessary params)
2. The chat view detects the `migrate` query parameter
3. Pre-fill the message input with the migration prompt (do NOT auto-send)
4. User can review and edit the prompt before sending
5. Sending creates a new chat session

### Migration Prompt (version mismatch)

> The scaffold this project was created from has been updated. Please migrate this project to the latest scaffold version.
>
> 1. Clone the scaffold repository to a temporary directory:
>    `git clone <repoUrl> /tmp/scaffold-migration`
> 2. The scaffold is in the `<scaffoldPath>/` folder. Compare the version this project was created from (commit `<oldVersion>`) with the current deployed version (commit `<newVersion>`):
>    `cd /tmp/scaffold-migration && git diff <oldVersion> <newVersion> -- <scaffoldPath>/`
> 3. Review the diff and apply the relevant changes to this project, adapting them to any customizations that have been made. Skip changes that conflict with intentional project modifications.
> 4. Update `.portable.yaml` in the project root to reflect the new version:
>    ```yaml
>    scaffold:
>      repo: <repoUrl>
>      path: <scaffoldPath>
>      version: <newVersion>
>    ```
> 5. After migration is complete, please tell me to stop and restart the project so the changes take effect.

### Setup Prompt (imported project, no `.portable.yaml`)

> This project was not created from a Portable scaffold. Please configure it to work correctly in the Portable environment.
>
> 1. Clone the scaffold repository to a temporary directory:
>    `git clone <repoUrl> /tmp/scaffold-reference`
> 2. Read the Portable requirements from the scaffold's CLAUDE.md:
>    `cat /tmp/scaffold-reference/<scaffoldPath>/CLAUDE.md`
> 3. Adapt this project to meet the Portable requirements described in that file. Do not overwrite the project's existing structure -- only add or modify what's needed for Portable compatibility.
> 4. Create `.portable.yaml` in the project root:
>    ```yaml
>    scaffold:
>      repo: <repoUrl>
>      path: <scaffoldPath>
>      version: <newVersion>
>    ```
> 5. After setup is complete, please tell me to stop and restart the project so the changes take effect.

## Scaffold CLAUDE.md Additions

Each scaffold's `CLAUDE.md` gets a "Portable Requirements" section documenting what's needed to run in the Portable environment:

```markdown
## Portable Requirements

This project runs inside a Portable pod (cloud dev environment).

**Preview pane:** Serves a production build, NOT a dev server. Changes
are not reflected until the project is rebuilt.

- `bun run build` -- produces the production build
- `bun run preview` -- starts the preview server on `0.0.0.0:$PORT`
- After making changes, rebuild by calling the pod's rebuild API:
  `curl -X POST http://localhost:3000/api/rebuild`
  This runs `bun run build` and restarts the preview server.
- `DATABASE_URL` env var provides Postgres access

**Framework config (Nuxt-specific):**

- `devServer.host` must be `"0.0.0.0"`
- `vite.server.allowedHosts` must be `true`
```

## Scaffold Creation Changes

When pushing scaffold files to a new project's GitHub repo (in `pushScaffoldToRepo`), include a generated `.portable.yaml` file with the current `NUXT_SCAFFOLD_VERSION` and `NUXT_SCAFFOLD_REPO_URL` values.

## Configuration

New runtime config / env vars:

| Environment Variable     | Runtime Config Key | Description                                    |
| ------------------------ | ------------------ | ---------------------------------------------- |
| `NUXT_SCAFFOLD_VERSION`  | `scaffoldVersion`  | Git commit hash baked into the image at build  |
| `NUXT_SCAFFOLD_REPO_URL` | `scaffoldRepoUrl`  | Public URL of the portable repo with scaffolds |

These are set via the Helm chart values and injected as env vars.

## No Schema Changes

No database migrations needed. The `.portable.yaml` file in the project repo is the sole source of truth for scaffold versioning.
