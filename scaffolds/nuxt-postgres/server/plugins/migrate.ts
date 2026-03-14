import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { useDb } from "../utils/db";

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3_000;

function findMigrationsFolder(): string {
  // In dev mode, cwd is the project root
  const fromCwd = resolve(process.cwd(), "server/db/migrations");
  if (existsSync(fromCwd)) return fromCwd;

  // In preview mode, cwd is .output/ — go up one level
  const fromParent = resolve(process.cwd(), "..", "server/db/migrations");
  if (existsSync(fromParent)) return fromParent;

  throw new Error(
    `Could not find migrations folder (checked ${fromCwd} and ${fromParent})`,
  );
}

async function runMigrations(): Promise<void> {
  const db = useDb();
  const migrationsFolder = findMigrationsFolder();
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await migrate(db, { migrationsFolder });
      console.log("[migrate] Database migrations applied successfully");
      return;
    } catch (error) {
      const isConnectionError =
        error instanceof Error &&
        error.cause instanceof Error &&
        error.cause.message.includes("ECONNREFUSED");

      if (isConnectionError && attempt < MAX_RETRIES) {
        console.warn(
          `[migrate] Database not ready, retrying in ${RETRY_DELAY_MS / 1000}s (attempt ${attempt}/${MAX_RETRIES})`,
        );
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        throw error;
      }
    }
  }
}

export default defineNitroPlugin(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn("[migrate] DATABASE_URL not set, skipping migrations");
    return;
  }

  await runMigrations();
});
