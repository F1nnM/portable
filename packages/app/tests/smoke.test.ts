import { $fetch, setup } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";

describe("app smoke tests", async () => {
  await setup({
    server: true,
  });

  it("returns { status: 'ok' } from /api/health", async () => {
    const response = await $fetch("/api/health");
    expect(response).toEqual({ status: "ok" });
  });

  it("returns HTML with page content from /", async () => {
    const html = await $fetch<string>("/");
    expect(html).toContain("Portable");
  });
});
