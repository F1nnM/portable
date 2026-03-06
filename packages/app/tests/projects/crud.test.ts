import { fetch, setup, url } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";

describe("project CRUD API", async () => {
  await setup({
    server: true,
  });

  describe("unauthenticated requests", () => {
    it("returns 401 for POST /api/projects when not authenticated", async () => {
      const response = await fetch(url("/api/projects"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Project" }),
      });
      expect(response.status).toBe(401);
    });

    it("returns 401 for GET /api/projects when not authenticated", async () => {
      const response = await fetch(url("/api/projects"));
      expect(response.status).toBe(401);
    });

    it("returns 401 for PATCH /api/projects/[slug] when not authenticated", async () => {
      const response = await fetch(url("/api/projects/some-slug"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });
      expect(response.status).toBe(401);
    });

    it("returns 401 for DELETE /api/projects/[slug] when not authenticated", async () => {
      const response = await fetch(url("/api/projects/some-slug"), {
        method: "DELETE",
      });
      expect(response.status).toBe(401);
    });

    it("returns 401 for POST /api/projects with repoUrl when not authenticated", async () => {
      const response = await fetch(url("/api/projects"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Import", repoUrl: "https://github.com/user/repo" }),
      });
      expect(response.status).toBe(401);
    });
  });

  describe("start/stop placeholders", () => {
    it("returns 401 for POST /api/projects/[slug]/start when not authenticated", async () => {
      const response = await fetch(url("/api/projects/some-slug/start"), {
        method: "POST",
      });
      expect(response.status).toBe(401);
    });

    it("returns 401 for POST /api/projects/[slug]/stop when not authenticated", async () => {
      const response = await fetch(url("/api/projects/some-slug/stop"), {
        method: "POST",
      });
      expect(response.status).toBe(401);
    });
  });
});
