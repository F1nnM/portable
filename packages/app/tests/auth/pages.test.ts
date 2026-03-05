import { fetch, setup, url } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";

describe("auth pages", async () => {
  await setup({
    server: true,
  });

  describe("/api/auth/me", () => {
    it("returns 401 when not authenticated", async () => {
      const response = await fetch(url("/api/auth/me"));
      expect(response.status).toBe(401);
    });
  });

  describe("auth guard redirects", () => {
    it("redirects unauthenticated requests from / to /login", async () => {
      const response = await fetch(url("/"), {
        redirect: "manual",
      });
      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toContain("/login");
    });

    it("redirects unauthenticated requests from /settings to /login", async () => {
      const response = await fetch(url("/settings"), {
        redirect: "manual",
      });
      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toContain("/login");
    });

    it("redirects unauthenticated requests from /new to /login", async () => {
      const response = await fetch(url("/new"), {
        redirect: "manual",
      });
      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toContain("/login");
    });

    it("allows unauthenticated access to /login", async () => {
      const response = await fetch(url("/login"));
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Sign in with GitHub");
    });

    it("does not block unauthenticated API requests (handled by API routes themselves)", async () => {
      const response = await fetch(url("/api/health"));
      expect(response.status).toBe(200);
    });
  });
});
