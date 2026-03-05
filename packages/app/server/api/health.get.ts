import { sql } from "drizzle-orm";
import { useDb } from "../utils/db";

export default defineEventHandler(async () => {
  try {
    const db = useDb();
    await db.execute(sql`SELECT 1`);
    return { status: "ok" };
  } catch {
    throw createError({ statusCode: 503, statusMessage: "Database unavailable" });
  }
});
