import { describe, expect, it } from "vitest";
import { setupH3Stubs } from "../helpers/h3";

// Stub Nitro auto-imports (needed for scaffolds handler import)
setupH3Stubs();

describe("github utilities", () => {
  describe("listScaffolds", () => {
    it("returns an array of scaffolds", async () => {
      const { listScaffolds } = await import("../../server/utils/github");
      const scaffolds = listScaffolds();
      expect(Array.isArray(scaffolds)).toBe(true);
      expect(scaffolds.length).toBeGreaterThan(0);
    });

    it("contains nuxt-postgres scaffold", async () => {
      const { listScaffolds } = await import("../../server/utils/github");
      const scaffolds = listScaffolds();
      const nuxtPostgres = scaffolds.find((s) => s.id === "nuxt-postgres");
      expect(nuxtPostgres).toBeDefined();
    });

    it("each scaffold has id, name, and description", async () => {
      const { listScaffolds } = await import("../../server/utils/github");
      const scaffolds = listScaffolds();
      for (const scaffold of scaffolds) {
        expect(scaffold).toHaveProperty("id");
        expect(scaffold).toHaveProperty("name");
        expect(scaffold).toHaveProperty("description");
        expect(typeof scaffold.id).toBe("string");
        expect(typeof scaffold.name).toBe("string");
        expect(typeof scaffold.description).toBe("string");
      }
    });
  });

  describe("readScaffoldFiles", () => {
    it("reads all files from nuxt-postgres scaffold", async () => {
      const { readScaffoldFiles } = await import("../../server/utils/github");
      const files = readScaffoldFiles("nuxt-postgres");
      expect(files.length).toBeGreaterThan(0);

      const paths = files.map((f) => f.path);
      expect(paths).toContain("package.json");
      expect(paths).toContain("nuxt.config.ts");
      expect(paths).toContain("app.vue");
      expect(paths).toContain(".gitignore");
      expect(paths).toContain("server/db/schema.ts");
      expect(paths).toContain("CLAUDE.md");
      expect(paths).toContain(".env.example");
      expect(paths).toContain("drizzle.config.ts");
      expect(paths).toContain("pages/index.vue");
    });

    it("each file has path and content", async () => {
      const { readScaffoldFiles } = await import("../../server/utils/github");
      const files = readScaffoldFiles("nuxt-postgres");
      for (const file of files) {
        expect(typeof file.path).toBe("string");
        expect(typeof file.content).toBe("string");
        expect(file.path.length).toBeGreaterThan(0);
        expect(file.content.length).toBeGreaterThan(0);
      }
    });

    it("throws for non-existent scaffold", async () => {
      const { readScaffoldFiles } = await import("../../server/utils/github");
      expect(() => readScaffoldFiles("non-existent")).toThrow(/not found/i);
    });
  });
});

const scaffoldsHandler = (await import("../../server/api/scaffolds/index.get")).default;

describe("scaffolds API endpoint (handler-level)", () => {
  const handler = scaffoldsHandler;

  it("returns scaffolds array with correct structure", () => {
    const result = handler(undefined as any) as {
      scaffolds: Array<{ id: string; name: string; description: string }>;
    };
    expect(result).toHaveProperty("scaffolds");
    expect(Array.isArray(result.scaffolds)).toBe(true);
    expect(result.scaffolds.length).toBeGreaterThan(0);

    for (const scaffold of result.scaffolds) {
      expect(scaffold).toHaveProperty("id");
      expect(scaffold).toHaveProperty("name");
      expect(scaffold).toHaveProperty("description");
    }
  });

  it("includes nuxt-postgres scaffold", () => {
    const result = handler(undefined as any) as {
      scaffolds: Array<{ id: string; name: string }>;
    };
    const nuxtPostgres = result.scaffolds.find((s) => s.id === "nuxt-postgres");
    expect(nuxtPostgres).toBeDefined();
    expect(nuxtPostgres!.name).toBe("Nuxt + Postgres");
  });

  it("does not require authentication", () => {
    // Handler has no auth check — calling without event still works
    const result = handler(undefined as any) as { scaffolds: unknown[] };
    expect(result.scaffolds.length).toBeGreaterThan(0);
  });
});
