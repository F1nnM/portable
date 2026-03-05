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
const { getDomainFromBaseUrl, lookupProject, resolveProxyTarget } =
  await import("../../server/utils/proxy");

// -- Test data --
const DOMAIN = "portable.127.0.0.1.nip.io";
const NAMESPACE = "default";

const TEST_USER = {
  id: "user-uuid-123",
  githubId: 12345,
  username: "testuser",
  displayName: "Test User",
  avatarUrl: null,
};

const TEST_PROJECT = {
  id: "project-uuid-456",
  userId: "user-uuid-123",
  slug: "my-project",
  status: "running",
};

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

describe("resolveProxyTarget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReset();
  });

  it("returns null for the main app domain (passes through to Nuxt)", async () => {
    const result = await resolveProxyTarget(
      "portable.127.0.0.1.nip.io",
      DOMAIN,
      NAMESPACE,
      TEST_USER,
    );
    expect(result).toBeNull();
  });

  it("throws 401 for unauthenticated subdomain requests", async () => {
    await expect(
      resolveProxyTarget("my-project.portable.127.0.0.1.nip.io", DOMAIN, NAMESPACE, null),
    ).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("throws 404 for non-existent project", async () => {
    const selectChain = makeSelectChain([]);
    mockDb.select.mockReturnValue(selectChain);

    await expect(
      resolveProxyTarget("unknown-project.portable.127.0.0.1.nip.io", DOMAIN, NAMESPACE, TEST_USER),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("throws 503 for non-running project", async () => {
    const selectChain = makeSelectChain([{ ...TEST_PROJECT, status: "stopped" }]);
    mockDb.select.mockReturnValue(selectChain);

    await expect(
      resolveProxyTarget("my-project.portable.127.0.0.1.nip.io", DOMAIN, NAMESPACE, TEST_USER),
    ).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it("resolves editor request to correct target", async () => {
    const selectChain = makeSelectChain([TEST_PROJECT]);
    mockDb.select.mockReturnValue(selectChain);

    const result = await resolveProxyTarget(
      "my-project.portable.127.0.0.1.nip.io",
      DOMAIN,
      NAMESPACE,
      TEST_USER,
    );

    expect(result).toEqual({
      target: "http://project-my-project.default.svc.cluster.local:3000",
      subdomain: { slug: "my-project", type: "editor" },
    });
  });

  it("resolves preview request to correct target (port 3001)", async () => {
    const selectChain = makeSelectChain([TEST_PROJECT]);
    mockDb.select.mockReturnValue(selectChain);

    const result = await resolveProxyTarget(
      "preview.my-project.portable.127.0.0.1.nip.io",
      DOMAIN,
      NAMESPACE,
      TEST_USER,
    );

    expect(result).toEqual({
      target: "http://project-my-project.default.svc.cluster.local:3001",
      subdomain: { slug: "my-project", type: "preview" },
    });
  });

  it("handles Host header with port", async () => {
    const selectChain = makeSelectChain([TEST_PROJECT]);
    mockDb.select.mockReturnValue(selectChain);

    const result = await resolveProxyTarget(
      "my-project.portable.127.0.0.1.nip.io:3000",
      DOMAIN,
      NAMESPACE,
      TEST_USER,
    );

    expect(result).toEqual({
      target: "http://project-my-project.default.svc.cluster.local:3000",
      subdomain: { slug: "my-project", type: "editor" },
    });
  });

  it("throws 404 when project belongs to a different user (DB filters by userId)", async () => {
    // The utility queries with `eq(projects.userId, user.id)`, so
    // the DB returns no rows when the project belongs to someone else.
    const selectChain = makeSelectChain([]);
    mockDb.select.mockReturnValue(selectChain);

    await expect(
      resolveProxyTarget("my-project.portable.127.0.0.1.nip.io", DOMAIN, NAMESPACE, TEST_USER),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
