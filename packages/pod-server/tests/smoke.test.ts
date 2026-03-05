import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("pod-server smoke tests", () => {
  it("returns 200 with { status: 'ok' } from /health", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("returns 200 with text body from /", async () => {
    const response = await app.request("/");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("Portable Pod Server");
  });
});
