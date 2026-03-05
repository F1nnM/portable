import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";

let _db: ReturnType<typeof createDb> | undefined;

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = postgres(databaseUrl);
  return drizzle(client, { schema });
}

export function useDb() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}
