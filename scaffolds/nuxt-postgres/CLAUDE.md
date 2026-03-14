# Project

Nuxt 3 full-stack web application with Postgres database using Drizzle ORM.

## Dev Server

Start the dev server:

```bash
bun run dev
```

The app runs at http://localhost:3000 by default.

## Database

- **ORM:** Drizzle ORM with the `postgres` (postgres.js) driver
- **Schema:** Defined in `server/db/schema.ts`
- **Migrations:** Generated with Drizzle Kit

### Database Commands

```bash
# Push schema directly to database (quick iteration)
bun run drizzle-kit push

# Generate migration files from schema changes
bun run db:generate

# Apply generated migrations
bun run drizzle-kit migrate
```

### Environment Variables

| Variable       | Description                | Example                                          |
| -------------- | -------------------------- | ------------------------------------------------ |
| `DATABASE_URL` | Postgres connection string | `postgresql://user:password@localhost:5432/mydb`  |

Copy `.env.example` to `.env` and fill in your values.

## Project Structure

```
pages/              Vue pages (file-based routing)
server/
  api/              API route handlers
  db/
    schema.ts       Drizzle database schema
    migrations/     Generated migration files
  utils/
    db.ts           Database connection singleton
app.vue             Root Vue component
nuxt.config.ts      Nuxt configuration
drizzle.config.ts   Drizzle Kit configuration
```

## Code Conventions

- TypeScript everywhere (strict mode)
- ESM modules (`"type": "module"`)
- Nuxt auto-imports for Vue composables and server utilities
- Server API routes use Nitro event handlers (`defineEventHandler`)

## Build

```bash
bun run build     # Build for production
bun run preview   # Preview production build locally
```

## Preview & Rebuild

The preview pane serves a **production build** (not a dev server). Code changes are not automatically reflected in the preview.

To update the preview after making changes:
- Use the rebuild button in the preview header, or
- Run `bun run build` manually, then call `POST /api/rebuild`

The rebuild endpoint (`POST /api/rebuild`) rebuilds the app and restarts the preview server.

## Deployment

### Docker

Multi-stage Dockerfile builds a production image:

```bash
docker build -t my-app .
docker run -p 3000:3000 -e DATABASE_URL=... my-app
```

### Helm Chart

Located at `deploy/helm/project-template/`. Deploys the app with an optional bundled Postgres.

```bash
# With bundled Postgres
helm install my-app deploy/helm/project-template \
  --set postgresql.password=secret

# With external database
helm install my-app deploy/helm/project-template \
  --set postgresql.enabled=false \
  --set externalDatabase.url=postgresql://user:pass@host:5432/db

# With ingress and TLS
helm install my-app deploy/helm/project-template \
  --set ingress.enabled=true \
  --set ingress.host=my-app.example.com \
  --set certManager.enabled=true \
  --set certManager.issuer=letsencrypt-prod
```

### CI/CD

GitHub Actions workflows in `.github/workflows/`:

- **ci.yml** — Runs typecheck and Helm lint on PRs
- **release.yml** — Builds and pushes Docker image to GHCR, packages and pushes Helm chart on push to main and releases

### Project Structure (deployment)

```
Dockerfile                          Multi-stage production build
.dockerignore                       Excludes dev files from Docker context
deploy/
  helm/
    project-template/
      Chart.yaml                    Helm chart metadata
      values.yaml                   Configurable values
      templates/
        _helpers.tpl                Template helpers
        deployment.yaml             App Deployment
        service.yaml                ClusterIP Service
        ingress.yaml                Optional Ingress
        secret.yaml                 DATABASE_URL secret
        postgres-statefulset.yaml   Optional bundled Postgres
        postgres-service.yaml       Postgres headless Service
.github/
  workflows/
    ci.yml                          PR checks
    release.yml                     Build + publish on merge/release
```
