import { fetch, setup, url } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";

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

  describe("module exports", () => {
    it("exports all expected functions", async () => {
      const mod = await import("../../server/utils/github");
      expect(typeof mod.listScaffolds).toBe("function");
      expect(typeof mod.readScaffoldFiles).toBe("function");
      expect(typeof mod.getDecryptedGithubToken).toBe("function");
      expect(typeof mod.createGitHubRepo).toBe("function");
      expect(typeof mod.pushScaffoldToRepo).toBe("function");
    });
  });
});

describe("scaffolds API endpoint", async () => {
  await setup({
    server: true,
  });

  it("returns 200 with scaffolds array from GET /api/scaffolds", async () => {
    const response = await fetch(url("/api/scaffolds"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("scaffolds");
    expect(Array.isArray(body.scaffolds)).toBe(true);
    expect(body.scaffolds.length).toBeGreaterThan(0);

    // Check structure of each scaffold
    for (const scaffold of body.scaffolds) {
      expect(scaffold).toHaveProperty("id");
      expect(scaffold).toHaveProperty("name");
      expect(scaffold).toHaveProperty("description");
      expect(typeof scaffold.id).toBe("string");
      expect(typeof scaffold.name).toBe("string");
      expect(typeof scaffold.description).toBe("string");
    }
  });

  it("includes nuxt-postgres in GET /api/scaffolds", async () => {
    const response = await fetch(url("/api/scaffolds"));
    const body = await response.json();
    const nuxtPostgres = body.scaffolds.find((s: { id: string }) => s.id === "nuxt-postgres");
    expect(nuxtPostgres).toBeDefined();
    expect(nuxtPostgres.name).toBe("Nuxt + Postgres");
  });

  it("does not require authentication for GET /api/scaffolds", async () => {
    // No auth cookie sent
    const response = await fetch(url("/api/scaffolds"));
    expect(response.status).toBe(200);
  });
});
