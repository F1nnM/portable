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

// Shared migration-ready signal. Nitro does not await async plugins,
// so other startup code must await this before querying the DB.
let _migrationsResolve: () => void;
let _migrationsReject: (err: unknown) => void;
const _migrationsReady = new Promise<void>((resolve, reject) => {
  _migrationsResolve = resolve;
  _migrationsReject = reject;
});

export function signalMigrationsComplete() {
  _migrationsResolve();
}

export function signalMigrationsFailed(err: unknown) {
  _migrationsReject(err);
}

export function waitForMigrations() {
  return _migrationsReady;
}
