# Project

Nuxt 3 full-stack web application with Postgres database using Drizzle ORM.

## Dev Server

Start the dev server:

```bash
npm run dev
```

The app runs at http://localhost:3000 by default.

## Database

- **ORM:** Drizzle ORM with the `postgres` (postgres.js) driver
- **Schema:** Defined in `server/db/schema.ts`
- **Migrations:** Generated with Drizzle Kit

### Database Commands

```bash
# Push schema directly to database (quick iteration)
npx drizzle-kit push

# Generate migration files from schema changes
npm run db:generate

# Apply generated migrations
npx drizzle-kit migrate
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
npm run build     # Build for production
npm run preview   # Preview production build locally
```
