import { fetch, setup, url } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";

describe("new project page", async () => {
  await setup({
    server: true,
  });

  describe("page rendering", () => {
    it("returns 200 for the new project page when following redirects", async () => {
      // Unauthenticated users get redirected to /login, but the page itself renders
      const response = await fetch(url("/new"));
      expect(response.status).toBe(200);
    });
  });

  describe("scaffolds API", () => {
    it("returns scaffolds array from GET /api/scaffolds without auth", async () => {
      const response = await fetch(url("/api/scaffolds"));
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        scaffolds: Array<{ id: string; name: string; description: string }>;
      };
      expect(data.scaffolds).toBeDefined();
      expect(Array.isArray(data.scaffolds)).toBe(true);
      expect(data.scaffolds.length).toBeGreaterThan(0);

      const scaffold = data.scaffolds[0];
      expect(scaffold).toHaveProperty("id");
      expect(scaffold).toHaveProperty("name");
      expect(scaffold).toHaveProperty("description");
    });
  });
});
