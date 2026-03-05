import { describe, expect, it } from "vitest";
import config from "../../drizzle.config";

describe("drizzle.config.ts", () => {
  it("uses postgresql dialect", () => {
    expect(config.dialect).toBe("postgresql");
  });

  it("points schema to server/db/schema.ts", () => {
    expect(config.schema).toBe("./server/db/schema.ts");
  });

  it("outputs migrations to server/db/migrations", () => {
    expect(config.out).toBe("./server/db/migrations");
  });
});
