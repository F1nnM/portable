import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export function useDb() {
  if (!_db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    const client = postgres(databaseUrl);
    _db = drizzle(client, { schema });
  }
  return _db;
}
