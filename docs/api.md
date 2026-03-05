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
    "scaffoldType": "nuxt-postgres",
    "githubRepoUrl": "https://github.com/user/my-project",
    "status": "running",
    "createdAt": "2026-03-04T12:00:00Z",
    "updatedAt": "2026-03-04T12:00:00Z"
  }
]
```

### `POST /api/projects`

Create a new project. Creates a GitHub repo, pushes scaffold files, creates a per-project database, allocates a PVC, and starts the pod.

**Request:**

```json
{
  "name": "My Project",
  "scaffold": "nuxt-postgres"
}
```

**Response:**

```json
{
  "id": "uuid",
  "name": "My Project",
  "slug": "my-project",
  "scaffoldType": "nuxt-postgres",
  "githubRepoUrl": "https://github.com/user/my-project",
  "status": "running"
}
```

### `PATCH /api/projects/:slug`

Rename a project.

**Request:**

```json
{
  "name": "New Name"
}
```

### `DELETE /api/projects/:slug`

Delete a project. Stops the pod (if running), deletes the PVC, and drops the project database. Does not delete the GitHub repo.

### `POST /api/projects/:slug/start`

Start a stopped project. Creates the pod, headless service, and (if needed) the PVC.

### `POST /api/projects/:slug/stop`

Stop a running project. Deletes the pod and headless service. The PVC persists.

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

Note: Authentication routes (`/auth/*`, `/api/auth/me`) and `/api/health` are implemented (Phases 1-2). Project, settings, and scaffold endpoints are planned for Phases 3-4. See `docs/progress.md` for current status.
