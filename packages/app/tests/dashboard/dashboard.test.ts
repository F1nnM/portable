import { fetch, setup, url } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";

describe("dashboard", async () => {
  await setup({
    server: true,
  });

  describe("page rendering", () => {
    it("returns 200 for the dashboard page when following redirects", async () => {
      // Unauthenticated users get redirected to /login, but the page itself renders
      const response = await fetch(url("/"));
      expect(response.status).toBe(200);
    });

    it("redirects unauthenticated users to /login", async () => {
      const response = await fetch(url("/"), {
        redirect: "manual",
      });
      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toContain("/login");
    });
  });

  describe("projects API auth", () => {
    it("returns 401 for GET /api/projects when not authenticated", async () => {
      const response = await fetch(url("/api/projects"));
      expect(response.status).toBe(401);
    });
  });

  describe("projectCard component", () => {
    it("exports as a Vue component module", async () => {
      const mod = await import("../../components/ProjectCard.vue");
      expect(mod.default).toBeDefined();
      expect(typeof mod.default).toBe("object");
    });
  });
});
