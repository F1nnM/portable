import { migrate } from "drizzle-orm/postgres-js/migrator";
import { useDb } from "../utils/db";

export default defineNitroPlugin(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn("[migrate] DATABASE_URL not set, skipping migrations");
    return;
  }

  try {
    const db = useDb();
    await migrate(db, { migrationsFolder: "server/db/migrations" });
    console.log("[migrate] Database migrations applied successfully");
  } catch (error) {
    console.error("[migrate] Failed to apply database migrations:", error);
    throw error;
  }
});
