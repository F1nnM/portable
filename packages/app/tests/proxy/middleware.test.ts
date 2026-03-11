import { beforeEach, describe, expect, it, vi } from "vitest";

// -- Set env vars before any imports --
process.env.NUXT_BASE_URL = "http://portable.127.0.0.1.nip.io";
process.env.NUXT_POD_NAMESPACE = "default";

// -- Mock the DB --
function makeSelectChain(data: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(data),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(),
};

vi.mock("../../server/utils/db", () => ({
  useDb: () => mockDb,
}));

// Import after mocks are set up
const { getDomainFromBaseUrl } = await import("../../server/utils/proxy-shared");
const { lookupProject } = await import("../../server/utils/proxy");

describe("getDomainFromBaseUrl", () => {
  it("extracts hostname from HTTP URL", () => {
    expect(getDomainFromBaseUrl("http://portable.127.0.0.1.nip.io")).toBe(
      "portable.127.0.0.1.nip.io",
    );
  });

  it("extracts hostname from HTTPS URL with port", () => {
    expect(getDomainFromBaseUrl("https://portable.example.com:8443")).toBe("portable.example.com");
  });

  it("extracts hostname from simple domain", () => {
    expect(getDomainFromBaseUrl("http://localhost:3000")).toBe("localhost");
  });
});

describe("lookupProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReset();
  });

  it("returns project info when found", async () => {
    const selectChain = makeSelectChain([{ id: "uuid-1", slug: "my-project", status: "running" }]);
    mockDb.select.mockReturnValue(selectChain);

    const result = await lookupProject("my-project", "user-uuid-123");
    expect(result).toEqual({ id: "uuid-1", slug: "my-project", status: "running" });
  });

  it("returns null when not found", async () => {
    const selectChain = makeSelectChain([]);
    mockDb.select.mockReturnValue(selectChain);

    const result = await lookupProject("nonexistent", "user-uuid-123");
    expect(result).toBeNull();
  });
});
