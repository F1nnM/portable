import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("pod-server smoke tests", () => {
  it("returns 503 with setting_up phase when not ready", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ status: "setting_up", phase: "initializing" });
  });

  it("returns 200 with ok when phase is ready", async () => {
    const { setPhase } = await import("../src/setup-state.js");
    setPhase("ready");
    try {
      const response = await app.request("/health");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ status: "ok", phase: "ready" });
    } finally {
      // Reset to default for other tests
      setPhase("initializing");
    }
  });

  it("returns 404 for / when no public directory exists", async () => {
    // The root route serves static files from ./public.
    // Without a public directory, it returns 404.
    const response = await app.request("/");
    expect(response.status).toBe(404);
  });
});
