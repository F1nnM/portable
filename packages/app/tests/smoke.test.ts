import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEvent, setupH3Stubs } from "./helpers/h3";

// Stub Nitro auto-imports
setupH3Stubs();

// Mock useDb
const mockExecute = vi.fn();
vi.mock("../server/utils/db", () => ({
  useDb: () => ({ execute: mockExecute }),
}));

const handler = (await import("../server/api/health.get")).default;

describe("health endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { status: 'ok' } when database is available", async () => {
    mockExecute.mockResolvedValueOnce([{ "?column?": 1 }]);
    const result = await handler(createMockEvent() as any);
    expect(result).toEqual({ status: "ok" });
  });

  it("throws 503 when database is unavailable", async () => {
    mockExecute.mockRejectedValueOnce(new Error("connection refused"));
    await expect(handler(createMockEvent() as any)).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});
