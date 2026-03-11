import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the session manager
vi.mock("../src/session-manager.js", () => ({
  getActiveSdkSessionIds: vi.fn(() => []),
}));

import { getActiveSdkSessionIds } from "../src/session-manager.js";
import { createApp } from "../src/app.js";

const mockGetActiveSdkSessionIds = vi.mocked(getActiveSdkSessionIds);

describe("active sessions endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no sessions are active", async () => {
    mockGetActiveSdkSessionIds.mockReturnValue([]);

    const { app } = createApp();
    const res = await app.request("/api/sessions/active");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ activeSessionIds: [] });
  });

  it("returns SDK session IDs for running queries", async () => {
    mockGetActiveSdkSessionIds.mockReturnValue(["sdk-1", "sdk-2"]);

    const { app } = createApp();
    const res = await app.request("/api/sessions/active");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ activeSessionIds: ["sdk-1", "sdk-2"] });
  });

  it("does not return completed sessions", async () => {
    // First call returns active sessions
    mockGetActiveSdkSessionIds.mockReturnValue(["sdk-active"]);

    const { app } = createApp();
    let res = await app.request("/api/sessions/active");
    let body = await res.json();
    expect(body.activeSessionIds).toContain("sdk-active");

    // Second call -- session completed
    mockGetActiveSdkSessionIds.mockReturnValue([]);
    res = await app.request("/api/sessions/active");
    body = await res.json();
    expect(body.activeSessionIds).toEqual([]);
  });
});
