import { migrate } from "drizzle-orm/postgres-js/migrator";
import { signalMigrationsComplete, signalMigrationsFailed, useDb } from "../utils/db";

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3_000;

async function runMigrations(): Promise<void> {
  const db = useDb();
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await migrate(db, { migrationsFolder: "server/db/migrations" });
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

export default defineNitroPlugin(() => {
  if (!process.env.DATABASE_URL) {
    console.warn("[migrate] DATABASE_URL not set, skipping migrations");
    signalMigrationsComplete();
    return;
  }

  runMigrations().then(signalMigrationsComplete).catch(signalMigrationsFailed);
});
