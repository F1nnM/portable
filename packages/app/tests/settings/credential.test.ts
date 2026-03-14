import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEvent, setupH3Stubs } from "../helpers/h3";

// Stub Nitro auto-imports
setupH3Stubs();

// Mock DB and crypto (not needed for 401 tests, but required at import time)
vi.mock("../../server/utils/db", () => ({ useDb: vi.fn() }));
vi.mock("../../server/utils/crypto", () => ({ encrypt: vi.fn() }));

const getHandler = (await import("../../server/api/settings/credential.get")).default;
const putHandler = (await import("../../server/api/settings/credential.put")).default;

describe("credential settings API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated GET", async () => {
    const event = createMockEvent({ user: null });
    await expect(getHandler(event as any)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects unauthenticated PUT", async () => {
    const event = createMockEvent({ user: null });
    await expect(putHandler(event as any)).rejects.toMatchObject({ statusCode: 401 });
  });
});
