import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("useDb utility", () => {
  const originalEnv = process.env.DATABASE_URL;

  beforeEach(() => {
    // Reset module cache so singleton resets between tests
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.DATABASE_URL = originalEnv;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  it("throws when DATABASE_URL is not set", async () => {
    delete process.env.DATABASE_URL;
    const { useDb } = await import("../../server/utils/db");
    expect(() => useDb()).toThrow("DATABASE_URL environment variable is not set");
  });

  it("returns a drizzle instance when DATABASE_URL is set", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/testdb";
    const { useDb } = await import("../../server/utils/db");
    const db = useDb();
    expect(db).toBeDefined();
    // Drizzle instance has a `query` property with our schema tables
    expect(db.query.users).toBeDefined();
    expect(db.query.projects).toBeDefined();
    expect(db.query.sessions).toBeDefined();
  });

  it("returns the same instance on subsequent calls (singleton)", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/testdb";
    const { useDb } = await import("../../server/utils/db");
    const db1 = useDb();
    const db2 = useDb();
    expect(db1).toBe(db2);
  });
});
