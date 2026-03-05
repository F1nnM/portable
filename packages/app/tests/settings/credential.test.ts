import { fetch, setup, url } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";

describe("credential settings API", async () => {
  await setup({
    server: true,
  });

  describe("get /api/settings/credential", () => {
    it("returns 401 when not authenticated", async () => {
      const response = await fetch(url("/api/settings/credential"));
      expect(response.status).toBe(401);
    });
  });

  describe("put /api/settings/credential", () => {
    it("returns 401 when not authenticated", async () => {
      const response = await fetch(url("/api/settings/credential"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: "sk-ant-test-key" }),
      });
      expect(response.status).toBe(401);
    });
  });
});
