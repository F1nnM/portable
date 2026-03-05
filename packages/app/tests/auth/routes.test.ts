import { fetch, setup, url } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";

describe("auth routes", async () => {
  await setup({
    server: true,
  });

  describe("login redirect", () => {
    it("redirects to github.com authorization URL", async () => {
      const response = await fetch(url("/auth/github"), {
        redirect: "manual",
      });
      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toBeTruthy();
      expect(location).toContain("github.com");
      expect(location).toContain("client_id=");
    });

    it("sets oauth_state cookie", async () => {
      const response = await fetch(url("/auth/github"), {
        redirect: "manual",
      });
      const cookies = response.headers.get("set-cookie");
      expect(cookies).toBeTruthy();
      expect(cookies).toContain("github_oauth_state=");
    });
  });

  describe("logout", () => {
    it("clears session cookie and returns 200", async () => {
      const response = await fetch(url("/auth/logout"), {
        method: "POST",
        headers: {
          cookie: "portable_session=nonexistent-token",
        },
      });
      expect(response.status).toBe(200);
      const cookies = response.headers.get("set-cookie");
      expect(cookies).toContain("portable_session=");
    });
  });

  describe("auth me endpoint", () => {
    it("returns 401 when not authenticated", async () => {
      const response = await fetch(url("/api/auth/me"));
      expect(response.status).toBe(401);
    });
  });

  describe("auth middleware", () => {
    it("does not block unauthenticated requests to public routes", async () => {
      const response = await fetch(url("/api/health"));
      // Health returns 503 without a database, but the key assertion is that
      // the auth middleware does not intercept it with 401 or a redirect.
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(302);
    });
  });
});
