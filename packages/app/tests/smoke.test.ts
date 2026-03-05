import { fetch, setup, url } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";

describe("app smoke tests", async () => {
  await setup({
    server: true,
  });

  it("returns 503 from /api/health when database is unavailable", async () => {
    const response = await fetch(url("/api/health"));
    expect(response.status).toBe(503);
  });

  it("returns HTML with page content from /", async () => {
    const response = await fetch(url("/"));
    const html = await response.text();
    expect(html).toContain("Portable");
  });
});
