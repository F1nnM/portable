import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("pod-server smoke tests", () => {
  it("returns 200 with { status: 'ok' } from /health", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("returns 404 for / when no public directory exists", async () => {
    // The root route serves static files from ./public.
    // Without a public directory, it returns 404.
    const response = await app.request("/");
    expect(response.status).toBe(404);
  });
});
