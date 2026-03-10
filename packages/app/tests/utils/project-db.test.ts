import { afterEach, describe, expect, it } from "vitest";
import { buildProjectDatabaseUrl } from "../../server/utils/project-db";

describe("buildProjectDatabaseUrl", () => {
  const originalEnv = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalEnv) {
      process.env.DATABASE_URL = originalEnv;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  it("replaces the database name in the URL with portable_<slug>", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/maindb";
    const result = buildProjectDatabaseUrl("my-project");
    expect(result).toContain("/portable_my-project");
    expect(result).toContain("user:pass@localhost:5432");
  });

  it("preserves query parameters", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@host:5432/maindb?sslmode=require";
    const result = buildProjectDatabaseUrl("test-app");
    expect(result).toContain("/portable_test-app");
    expect(result).toContain("sslmode=require");
  });

  it("throws when DATABASE_URL is not set", () => {
    delete process.env.DATABASE_URL;
    expect(() => buildProjectDatabaseUrl("test")).toThrow("DATABASE_URL");
  });

  it("handles slug with hyphens", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/maindb";
    const result = buildProjectDatabaseUrl("my-cool-project");
    expect(result).toContain("/portable_my-cool-project");
  });
});
