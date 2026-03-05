# API Reference

The main app (Nuxt) exposes REST API routes under `/api/` and auth routes under `/auth/`. All API routes except auth endpoints require a valid session cookie.

## Authentication

All auth routes are implemented. Session cookies (`portable_session`) are HTTP-only, SameSite=Lax, and Secure in production.

### `GET /auth/github`

Redirects to GitHub OAuth authorization page. Scopes requested: `repo`, `read:user`. Sets a `github_oauth_state` cookie (10-minute expiry) for CSRF protection.

### `GET /auth/github/callback`

GitHub OAuth callback. Validates the `code` and `state` parameters against the stored state cookie. Exchanges the code for an access token, fetches the GitHub user profile, encrypts the access token with AES-256-GCM, upserts the user record, creates a 30-day session, sets the `portable_session` cookie, and redirects to `/`.

Returns 400 if the OAuth state is invalid or the authorization code exchange fails.

### `POST /auth/logout`

Destroys the current session in the database (best-effort) and clears the `portable_session` cookie.

**Response:**

```json
{
  "ok": true
}
```

### `GET /api/auth/me`

Returns the authenticated user's profile. Requires a valid session.

**Response (200):**

```json
{
  "id": "uuid",
  "githubId": 12345,
  "username": "github-username",
  "displayName": "Display Name",
  "avatarUrl": "https://avatars.githubusercontent.com/u/12345"
}
```

**Response (401):** Returned if no valid session exists.

## Projects

### `GET /api/projects`

List all projects for the authenticated user.

**Response:**

```json
[
  {
    "id": "uuid",
    "name": "My Project",
    "slug": "my-project",
    "scaffoldId": "nuxt-postgres",
    "status": "stopped",
    "createdAt": "2026-03-04T12:00:00Z",
    "updatedAt": "2026-03-04T12:00:00Z"
  }
]
```

### `POST /api/projects`

Create a new project. Generates a URL-safe slug from the project name (lowercase, hyphens, max 50 chars). Creates a GitHub repository under the authenticated user's account and pushes the selected scaffold as the initial commit via the Git Data API (no local git required). Per-project database and pod startup are wired in later phases.

**Request:**

```json
{
  "name": "My Project",
  "scaffoldId": "nuxt-postgres"
}
```

The `scaffoldId` must match one of the available scaffolds returned by `GET /api/scaffolds`. If omitted, defaults to `"nuxt-postgres"`.

**Response:**

```json
{
  "id": "uuid",
  "name": "My Project",
  "slug": "my-project",
  "scaffoldId": "nuxt-postgres",
  "status": "stopped",
  "repoUrl": "https://github.com/user/my-project",
  "createdAt": "2026-03-04T12:00:00Z",
  "updatedAt": "2026-03-04T12:00:00Z"
}
```

**Errors:** 400 if name is missing, empty, exceeds 100 characters, or scaffoldId is invalid. 409 if the generated slug conflicts with an existing project for the same user. If GitHub repo creation fails, the project record is still created with `repoUrl: null` (create-then-update pattern).

### `PATCH /api/projects/:slug`

Rename a project.

**Request:**

```json
{
  "name": "New Name"
}
```

**Errors:** 400 if name is missing, empty, or exceeds 100 characters. 404 if the project does not exist or does not belong to the authenticated user.

### `DELETE /api/projects/:slug`

Delete a project. Currently deletes the database record only. Pod cleanup, PVC deletion, and database drop will be wired in Phase 5.

**Errors:** 404 if the project does not exist or does not belong to the authenticated user.

### `POST /api/projects/:slug/start`

Start a stopped project. Currently returns 501 (not implemented). K8s pod creation will be wired in Phase 5.

### `POST /api/projects/:slug/stop`

Stop a running project. Currently returns 501 (not implemented). K8s pod deletion will be wired in Phase 5.

## Settings

### `GET /api/settings/credential`

Check whether the user has an Anthropic credential configured.

**Response:**

```json
{
  "hasCredential": true
}
```

### `PUT /api/settings/credential`

Save an Anthropic API key or Claude Code OAuth token. The credential is encrypted with AES-256-GCM before storage.

**Request:**

```json
{
  "credential": "sk-ant-..."
}
```

## Scaffolds

### `GET /api/scaffolds`

List available project scaffolds.

**Response:**

```json
[
  {
    "id": "nuxt-postgres",
    "name": "Nuxt + Postgres",
    "description": "Nuxt 3 with Drizzle ORM and Postgres"
  }
]
```

## Health

### `GET /api/health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok"
}
```

---

Note: Authentication routes (`/auth/*`, `/api/auth/me`), `/api/health`, project CRUD (`/api/projects`), settings (`/api/settings/credential`), and scaffolds (`/api/scaffolds`) are implemented (Phases 1-4). Project creation includes GitHub repo creation and scaffold push. Project start/stop endpoints return 501 until K8s integration in Phase 5. See `docs/progress.md` for current status.
