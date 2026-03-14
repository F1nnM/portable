import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEvent, setupH3Stubs } from "../helpers/h3";

// Stub Nitro auto-imports
setupH3Stubs();

// Mock dependencies required at import time
vi.mock("../../server/utils/db", () => ({ useDb: vi.fn() }));
vi.mock("../../server/utils/project-lifecycle", () => ({
  createProject: vi.fn(),
  startProject: vi.fn(),
  stopProject: vi.fn(),
  deleteProject: vi.fn(),
}));
vi.mock("../../server/utils/github", () => ({
  listScaffolds: vi.fn(() => []),
}));
vi.mock("../../server/utils/slug", () => ({
  generateSlug: vi.fn((name: string) => name.toLowerCase().replace(/\s+/g, "-")),
}));

const getHandler = (await import("../../server/api/projects/index.get")).default;
const postHandler = (await import("../../server/api/projects/index.post")).default;
const patchHandler = (await import("../../server/api/projects/[slug].patch")).default;
const deleteHandler = (await import("../../server/api/projects/[slug].delete")).default;
const startHandler = (await import("../../server/api/projects/[slug]/start.post")).default;
const stopHandler = (await import("../../server/api/projects/[slug]/stop.post")).default;

describe("project CRUD API - unauthenticated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects GET /api/projects", async () => {
    const event = createMockEvent({ user: null });
    await expect(getHandler(event as any)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects POST /api/projects", async () => {
    const event = createMockEvent({ user: null });
    await expect(postHandler(event as any)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects PATCH /api/projects/[slug]", async () => {
    const event = createMockEvent({ user: null });
    await expect(patchHandler(event as any)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects DELETE /api/projects/[slug]", async () => {
    const event = createMockEvent({ user: null });
    await expect(deleteHandler(event as any)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects POST /api/projects/[slug]/start", async () => {
    const event = createMockEvent({ user: null });
    await expect(startHandler(event as any)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects POST /api/projects/[slug]/stop", async () => {
    const event = createMockEvent({ user: null });
    await expect(stopHandler(event as any)).rejects.toMatchObject({ statusCode: 401 });
  });
});
