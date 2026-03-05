import postgres from "postgres";

/**
 * Returns the DATABASE_URL environment variable, throwing if not set.
 */
function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return databaseUrl;
}

/**
 * Computes the per-project database name from a project slug.
 */
function projectDatabaseName(slug: string): string {
  return `portable_${slug}`;
}

/**
 * Builds the per-project DATABASE_URL by replacing the database name
 * in the main DATABASE_URL with `portable_<slug>`.
 */
export function buildProjectDatabaseUrl(slug: string): string {
  const mainUrl = getDatabaseUrl();
  const url = new URL(mainUrl);
  const dbName = projectDatabaseName(slug);
  url.pathname = `/${dbName}`;
  return url.toString();
}

/**
 * Creates a new Postgres database for a project.
 * Uses the main app's DATABASE_URL connection to execute CREATE DATABASE.
 * Returns the connection string for the new per-project database.
 *
 * If the database already exists, this is a no-op and still returns the URL.
 */
export async function createProjectDatabase(slug: string): Promise<string> {
  const mainUrl = getDatabaseUrl();
  const dbName = projectDatabaseName(slug);

  // Connect to the main database to run administrative SQL.
  // Use max 1 connection since this is an admin operation.
  const sql = postgres(mainUrl, { max: 1 });

  try {
    // CREATE DATABASE cannot run inside a transaction, and postgres.js uses
    // tagged template literals. We use `sql.unsafe()` for dynamic DB names
    // since template literals would quote the name as a string value.
    await sql.unsafe(`CREATE DATABASE "${dbName}"`);
  } catch (err: unknown) {
    // Ignore "database already exists" error (code 42P04)
    if (isDuplicateDatabaseError(err)) {
      // Database already exists -- that's fine
    } else {
      throw err;
    }
  } finally {
    await sql.end();
  }

  return buildProjectDatabaseUrl(slug);
}

/**
 * Drops the per-project Postgres database.
 * Handles "database doesn't exist" gracefully.
 */
export async function deleteProjectDatabase(slug: string): Promise<void> {
  const mainUrl = getDatabaseUrl();
  const dbName = projectDatabaseName(slug);

  const sql = postgres(mainUrl, { max: 1 });

  try {
    // Terminate active connections to the database before dropping.
    // dbName is safe (derived from slug which is [a-z0-9-] only), but we
    // use a parameterized query for defense-in-depth.
    await sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${dbName} AND pid <> pg_backend_pid()`;
    await sql.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  } finally {
    await sql.end();
  }
}

function isDuplicateDatabaseError(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    return (err as { code: string }).code === "42P04";
  }
  return false;
}
