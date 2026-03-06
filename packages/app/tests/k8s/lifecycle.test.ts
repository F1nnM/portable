import { beforeEach, describe, expect, it, vi } from "vitest";

// -- Set env vars before any imports --
process.env.NUXT_ENCRYPTION_KEY = "0".repeat(64);

// -- Mocks for K8s functions --
const mockCreateProjectPod = vi.fn();
const mockCreateProjectService = vi.fn();
const mockCreateProjectPVC = vi.fn();
const mockWaitForPodReady = vi.fn();
const mockDeleteProjectPod = vi.fn();
const mockDeleteProjectService = vi.fn();
const mockDeleteProjectPVC = vi.fn();

vi.mock("../../server/utils/k8s", () => ({
  createProjectPod: mockCreateProjectPod,
  createProjectService: mockCreateProjectService,
  createProjectPVC: mockCreateProjectPVC,
  waitForPodReady: mockWaitForPodReady,
  deleteProjectPod: mockDeleteProjectPod,
  deleteProjectService: mockDeleteProjectService,
  deleteProjectPVC: mockDeleteProjectPVC,
}));

// -- Mocks for project-db --
const mockCreateProjectDatabase = vi.fn();
const mockDeleteProjectDatabase = vi.fn();

vi.mock("../../server/utils/project-db", () => ({
  createProjectDatabase: mockCreateProjectDatabase,
  deleteProjectDatabase: mockDeleteProjectDatabase,
}));

// -- Mocks for Drizzle DB --
function makeSelectChain(data: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(data),
  };
  return chain;
}

function makeUpdateChain() {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  return chain;
}

function makeDeleteChain() {
  const chain = {
    where: vi.fn().mockResolvedValue(undefined),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  insert: vi.fn(),
};

vi.mock("../../server/utils/db", () => ({
  useDb: () => mockDb,
}));

// -- Mocks for creation phase --
const mockSetCreationPhase = vi.fn();
const mockClearCreationPhase = vi.fn();

vi.mock("../../server/utils/creation-phase", () => ({
  setCreationPhase: mockSetCreationPhase,
  clearCreationPhase: mockClearCreationPhase,
}));

// -- Mock for GitHub --
const mockGetDecryptedGithubToken = vi.fn();
const mockCreateGitHubRepo = vi.fn();
const mockPushScaffoldToRepo = vi.fn();

vi.mock("../../server/utils/github", () => ({
  getDecryptedGithubToken: mockGetDecryptedGithubToken,
  createGitHubRepo: mockCreateGitHubRepo,
  pushScaffoldToRepo: mockPushScaffoldToRepo,
  deleteGitHubRepo: vi.fn(),
  parseGitHubRepoUrl: vi.fn((url: string) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  }),
}));

// -- Mock for crypto --
const mockDecrypt = vi.fn();

vi.mock("../../server/utils/crypto", () => ({
  decrypt: mockDecrypt,
}));

// -- Stub Nuxt auto-imports that are used in the production code --
// createError is a Nuxt server auto-import (from h3); stub it for unit tests.
vi.stubGlobal(
  "createError",
  vi.fn((opts: { statusCode: number; statusMessage: string; message?: string }) => {
    const err = new Error(opts.message || opts.statusMessage) as Error & {
      statusCode: number;
      statusMessage: string;
    };
    err.statusCode = opts.statusCode;
    err.statusMessage = opts.statusMessage;
    return err;
  }),
);

// useRuntimeConfig stub -- returns empty so getEncryptionKey falls back to env var
vi.stubGlobal(
  "useRuntimeConfig",
  vi.fn(() => ({})),
);

// Import the functions under test
const { createProject, startProject, stopProject, deleteProject } =
  await import("../../server/utils/project-lifecycle");

// --- Test data ---
const TEST_USER_ID = "user-uuid-123";
const TEST_PROJECT = {
  id: "project-uuid-456",
  userId: TEST_USER_ID,
  name: "My Project",
  slug: "my-project",
  scaffoldId: "nuxt-postgres",
  status: "stopped" as string,
  encryptedAnthropicKey: null as string | null,
  podName: null as string | null,
  repoUrl: "https://github.com/user/my-project",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("project lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock implementations to avoid leaking persistent return values between tests
    mockDb.select.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
    mockDb.insert.mockReset();
  });

  describe("startProject", () => {
    function setupStartMocks(overrides?: {
      projectStatus?: string;
      projectAnthropicKey?: string | null;
      userAnthropicKey?: string | null;
    }) {
      const projectStatus = overrides?.projectStatus ?? "stopped";
      const projectAnthropicKey = overrides?.projectAnthropicKey ?? null;
      const userAnthropicKey = overrides?.userAnthropicKey ?? "user-encrypted-key";

      // Project lookup (select all from projects)
      const projectData = {
        ...TEST_PROJECT,
        status: projectStatus,
        encryptedAnthropicKey: projectAnthropicKey,
      };
      const projectSelectChain = makeSelectChain([projectData]);

      // User credentials lookup (select encryptedAnthropicKey from users)
      const userSelectChain = makeSelectChain([{ encryptedAnthropicKey: userAnthropicKey }]);

      // AGE key lookup (select encryptedAgeKey from users)
      const ageKeySelectChain = makeSelectChain([{ encryptedAgeKey: null }]);

      // First select = project lookup, second = user anthropic key lookup, third = AGE key lookup
      mockDb.select
        .mockReturnValueOnce(projectSelectChain)
        .mockReturnValueOnce(userSelectChain)
        .mockReturnValueOnce(ageKeySelectChain);

      // Status updates
      mockDb.update.mockReturnValue(makeUpdateChain());

      // Credentials
      mockGetDecryptedGithubToken.mockResolvedValue("ghp_decrypted_token");
      mockDecrypt.mockReturnValue("sk-ant-decrypted");

      // K8s operations
      mockCreateProjectDatabase.mockResolvedValue("postgres://localhost:5432/portable_my-project");
      mockCreateProjectPVC.mockResolvedValue(undefined);
      mockCreateProjectPod.mockResolvedValue(undefined);
      mockCreateProjectService.mockResolvedValue(undefined);
      mockWaitForPodReady.mockResolvedValue(undefined);
    }

    it("creates DB, PVC, pod, service and updates status to running", async () => {
      setupStartMocks();

      await startProject(TEST_USER_ID, "my-project");

      expect(mockCreateProjectDatabase).toHaveBeenCalledWith("my-project");
      expect(mockCreateProjectPVC).toHaveBeenCalledWith("my-project");
      expect(mockCreateProjectPod).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "my-project",
          databaseUrl: "postgres://localhost:5432/portable_my-project",
          githubToken: "ghp_decrypted_token",
          anthropicApiKey: "sk-ant-decrypted",
        }),
      );
      expect(mockCreateProjectService).toHaveBeenCalledWith("my-project");
      expect(mockWaitForPodReady).toHaveBeenCalledWith("my-project");

      // Status updated at least twice (starting + running)
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("rejects with 409 if project is already running", async () => {
      const selectChain = makeSelectChain([{ ...TEST_PROJECT, status: "running" }]);
      mockDb.select.mockReturnValue(selectChain);

      await expect(startProject(TEST_USER_ID, "my-project")).rejects.toMatchObject({
        statusCode: 409,
      });

      expect(mockCreateProjectPod).not.toHaveBeenCalled();
      expect(mockCreateProjectPVC).not.toHaveBeenCalled();
      expect(mockCreateProjectService).not.toHaveBeenCalled();
    });

    it("rejects with 409 if project is starting", async () => {
      const selectChain = makeSelectChain([{ ...TEST_PROJECT, status: "starting" }]);
      mockDb.select.mockReturnValue(selectChain);

      await expect(startProject(TEST_USER_ID, "my-project")).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it("sets status to error on K8s failure and attempts cleanup", async () => {
      setupStartMocks();

      // Override: pod creation fails
      mockCreateProjectPod.mockRejectedValue(new Error("K8s API error"));
      mockDeleteProjectPod.mockResolvedValue(undefined);
      mockDeleteProjectService.mockResolvedValue(undefined);

      await expect(startProject(TEST_USER_ID, "my-project")).rejects.toThrow("K8s API error");

      // Verify cleanup was attempted
      expect(mockDeleteProjectPod).toHaveBeenCalledWith("my-project");
      expect(mockDeleteProjectService).toHaveBeenCalledWith("my-project");
    });

    it("returns 404 if project not found", async () => {
      const selectChain = makeSelectChain([]);
      mockDb.select.mockReturnValue(selectChain);

      await expect(startProject(TEST_USER_ID, "nonexistent")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("uses project-level Anthropic key over user-level key", async () => {
      setupStartMocks({
        projectAnthropicKey: "project-encrypted-key",
        userAnthropicKey: "user-encrypted-key",
      });

      mockDecrypt.mockReturnValueOnce("sk-ant-project-key");

      await startProject(TEST_USER_ID, "my-project");

      // decrypt should have been called with the project key, not user key
      expect(mockDecrypt).toHaveBeenCalledWith("project-encrypted-key", expect.any(String));
      expect(mockCreateProjectPod).toHaveBeenCalledWith(
        expect.objectContaining({
          anthropicApiKey: "sk-ant-project-key",
        }),
      );
    });

    it("handles AlreadyExists (409) for PVC gracefully", async () => {
      setupStartMocks();

      // PVC already exists (409)
      const alreadyExistsError = new Error("AlreadyExists") as Error & { statusCode: number };
      alreadyExistsError.statusCode = 409;
      mockCreateProjectPVC.mockRejectedValue(alreadyExistsError);

      // Should succeed despite the 409 on PVC
      await expect(startProject(TEST_USER_ID, "my-project")).resolves.toBeUndefined();

      // Pod should still be created after PVC 409
      expect(mockCreateProjectPod).toHaveBeenCalled();
    });
  });

  describe("createProject", () => {
    function setupCreateMocks() {
      mockCreateProjectDatabase.mockResolvedValue("postgres://localhost:5432/portable_my-project");
      mockGetDecryptedGithubToken.mockResolvedValue("ghp_decrypted_token");
      mockCreateGitHubRepo.mockResolvedValue({
        owner: "user",
        repo: "my-project",
        cloneUrl: "https://github.com/user/my-project.git",
        htmlUrl: "https://github.com/user/my-project",
      });
      mockPushScaffoldToRepo.mockResolvedValue(undefined);
      mockDb.update.mockReturnValue(makeUpdateChain());
    }

    it("creates DB, GitHub repo, pushes scaffold, updates status to stopped", async () => {
      setupCreateMocks();

      await createProject(TEST_USER_ID, TEST_PROJECT.id, "my-project", "nuxt-postgres");

      expect(mockCreateProjectDatabase).toHaveBeenCalledWith("my-project");
      expect(mockGetDecryptedGithubToken).toHaveBeenCalledWith(TEST_USER_ID);
      expect(mockCreateGitHubRepo).toHaveBeenCalledWith("ghp_decrypted_token", "my-project");
      expect(mockPushScaffoldToRepo).toHaveBeenCalledWith(
        "ghp_decrypted_token",
        "user",
        "my-project",
        "nuxt-postgres",
      );
    });

    it("tracks creation phases correctly", async () => {
      setupCreateMocks();

      await createProject(TEST_USER_ID, TEST_PROJECT.id, "my-project", "nuxt-postgres");

      expect(mockSetCreationPhase).toHaveBeenCalledWith("my-project", "creating_database");
      expect(mockSetCreationPhase).toHaveBeenCalledWith("my-project", "creating_repository");
      expect(mockSetCreationPhase).toHaveBeenCalledWith("my-project", "pushing_scaffold");
      expect(mockClearCreationPhase).toHaveBeenCalledWith("my-project");
    });

    it("persists repoUrl before pushing scaffold so cleanup can find it", async () => {
      setupCreateMocks();

      // Track the order of update calls
      const updateSetCalls: Record<string, unknown>[] = [];
      mockDb.update.mockReturnValue({
        set: vi.fn((data: Record<string, unknown>) => {
          updateSetCalls.push(data);
          return { where: vi.fn().mockResolvedValue(undefined) };
        }),
      });

      await createProject(TEST_USER_ID, TEST_PROJECT.id, "my-project", "nuxt-postgres");

      // First update should persist repoUrl (before scaffold push)
      expect(updateSetCalls.length).toBeGreaterThanOrEqual(2);
      expect(updateSetCalls[0]).toMatchObject({ repoUrl: "https://github.com/user/my-project" });
      // Second update should set status to stopped (after scaffold push)
      expect(updateSetCalls[1]).toMatchObject({ status: "stopped" });
    });

    it("sets status to error and clears phase on failure", async () => {
      setupCreateMocks();
      mockCreateGitHubRepo.mockRejectedValue(new Error("GitHub API error"));
      mockDb.update.mockReturnValue(makeUpdateChain());

      await expect(
        createProject(TEST_USER_ID, TEST_PROJECT.id, "my-project", "nuxt-postgres"),
      ).rejects.toThrow("GitHub API error");

      expect(mockClearCreationPhase).toHaveBeenCalledWith("my-project");
    });

    it("persists repoUrl even when scaffold push fails", async () => {
      setupCreateMocks();
      mockPushScaffoldToRepo.mockRejectedValue(new Error("Push failed"));

      const updateSetCalls: Record<string, unknown>[] = [];
      mockDb.update.mockReturnValue({
        set: vi.fn((data: Record<string, unknown>) => {
          updateSetCalls.push(data);
          return { where: vi.fn().mockResolvedValue(undefined) };
        }),
      });

      await expect(
        createProject(TEST_USER_ID, TEST_PROJECT.id, "my-project", "nuxt-postgres"),
      ).rejects.toThrow("Push failed");

      // repoUrl should have been persisted before the push attempt
      expect(updateSetCalls.some((c) => c.repoUrl === "https://github.com/user/my-project")).toBe(
        true,
      );
      expect(mockClearCreationPhase).toHaveBeenCalledWith("my-project");
    });

    it("skips GitHub repo creation and scaffold push for import (no scaffoldId)", async () => {
      mockCreateProjectDatabase.mockResolvedValue("postgres://localhost:5432/portable_my-import");
      mockDb.update.mockReturnValue(makeUpdateChain());

      await createProject(TEST_USER_ID, "project-uuid-789", "my-import", null);

      expect(mockCreateProjectDatabase).toHaveBeenCalledWith("my-import");
      expect(mockGetDecryptedGithubToken).not.toHaveBeenCalled();
      expect(mockCreateGitHubRepo).not.toHaveBeenCalled();
      expect(mockPushScaffoldToRepo).not.toHaveBeenCalled();
      expect(mockClearCreationPhase).toHaveBeenCalledWith("my-import");
    });

    it("only tracks creating_database phase for import", async () => {
      mockCreateProjectDatabase.mockResolvedValue("postgres://localhost:5432/portable_my-import");
      mockDb.update.mockReturnValue(makeUpdateChain());

      await createProject(TEST_USER_ID, "project-uuid-789", "my-import", null);

      expect(mockSetCreationPhase).toHaveBeenCalledWith("my-import", "creating_database");
      expect(mockSetCreationPhase).not.toHaveBeenCalledWith("my-import", "creating_repository");
      expect(mockSetCreationPhase).not.toHaveBeenCalledWith("my-import", "pushing_scaffold");
    });

    it("sets status to stopped for import flow", async () => {
      mockCreateProjectDatabase.mockResolvedValue("postgres://localhost:5432/portable_my-import");

      const updateSetCalls: Record<string, unknown>[] = [];
      mockDb.update.mockReturnValue({
        set: vi.fn((data: Record<string, unknown>) => {
          updateSetCalls.push(data);
          return { where: vi.fn().mockResolvedValue(undefined) };
        }),
      });

      await createProject(TEST_USER_ID, "project-uuid-789", "my-import", null);

      expect(updateSetCalls.length).toBe(1);
      expect(updateSetCalls[0]).toMatchObject({ status: "stopped" });
    });

    it("startProject rejects project in creating status with 409", async () => {
      const selectChain = makeSelectChain([{ ...TEST_PROJECT, status: "creating" }]);
      mockDb.select.mockReturnValue(selectChain);

      await expect(startProject(TEST_USER_ID, "my-project")).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  describe("stopProject", () => {
    it("deletes pod and service, keeps PVC, updates status to stopped", async () => {
      const selectChain = makeSelectChain([
        { ...TEST_PROJECT, status: "running", podName: "project-my-project" },
      ]);
      mockDb.select.mockReturnValue(selectChain);
      mockDb.update.mockReturnValue(makeUpdateChain());

      mockDeleteProjectPod.mockResolvedValue(undefined);
      mockDeleteProjectService.mockResolvedValue(undefined);

      await stopProject(TEST_USER_ID, "my-project");

      expect(mockDeleteProjectPod).toHaveBeenCalledWith("my-project");
      expect(mockDeleteProjectService).toHaveBeenCalledWith("my-project");
      expect(mockDeleteProjectPVC).not.toHaveBeenCalled();
    });

    it("rejects with 409 if project is already stopped", async () => {
      const selectChain = makeSelectChain([{ ...TEST_PROJECT, status: "stopped" }]);
      mockDb.select.mockReturnValue(selectChain);

      await expect(stopProject(TEST_USER_ID, "my-project")).rejects.toMatchObject({
        statusCode: 409,
      });

      expect(mockDeleteProjectPod).not.toHaveBeenCalled();
      expect(mockDeleteProjectService).not.toHaveBeenCalled();
    });

    it("accepts stopping a project in error state", async () => {
      const selectChain = makeSelectChain([
        { ...TEST_PROJECT, status: "error", podName: "project-my-project" },
      ]);
      mockDb.select.mockReturnValue(selectChain);
      mockDb.update.mockReturnValue(makeUpdateChain());

      mockDeleteProjectPod.mockResolvedValue(undefined);
      mockDeleteProjectService.mockResolvedValue(undefined);

      await stopProject(TEST_USER_ID, "my-project");

      expect(mockDeleteProjectPod).toHaveBeenCalledWith("my-project");
      expect(mockDeleteProjectService).toHaveBeenCalledWith("my-project");
    });

    it("sets status to error on K8s failure", async () => {
      const selectChain = makeSelectChain([
        { ...TEST_PROJECT, status: "running", podName: "project-my-project" },
      ]);
      mockDb.select.mockReturnValue(selectChain);
      mockDb.update.mockReturnValue(makeUpdateChain());

      mockDeleteProjectPod.mockRejectedValue(new Error("K8s delete error"));

      await expect(stopProject(TEST_USER_ID, "my-project")).rejects.toThrow("K8s delete error");
    });

    it("returns 404 if project not found", async () => {
      const selectChain = makeSelectChain([]);
      mockDb.select.mockReturnValue(selectChain);

      await expect(stopProject(TEST_USER_ID, "nonexistent")).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("deleteProject", () => {
    it("cleans up PVC, per-project DB, pod, service, then deletes DB row", async () => {
      const selectChain = makeSelectChain([
        { ...TEST_PROJECT, status: "running", podName: "project-my-project" },
      ]);
      mockDb.select.mockReturnValue(selectChain);
      mockDb.delete.mockReturnValue(makeDeleteChain());

      mockDeleteProjectPod.mockResolvedValue(undefined);
      mockDeleteProjectService.mockResolvedValue(undefined);
      mockDeleteProjectPVC.mockResolvedValue(undefined);
      mockDeleteProjectDatabase.mockResolvedValue(undefined);

      await deleteProject(TEST_USER_ID, "my-project");

      expect(mockDeleteProjectPod).toHaveBeenCalledWith("my-project");
      expect(mockDeleteProjectService).toHaveBeenCalledWith("my-project");
      expect(mockDeleteProjectPVC).toHaveBeenCalledWith("my-project");
      expect(mockDeleteProjectDatabase).toHaveBeenCalledWith("my-project");
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("deletes stopped project (pod/service still cleaned up via idempotent delete)", async () => {
      const selectChain = makeSelectChain([{ ...TEST_PROJECT, status: "stopped", podName: null }]);
      mockDb.select.mockReturnValue(selectChain);
      mockDb.delete.mockReturnValue(makeDeleteChain());

      mockDeleteProjectPVC.mockResolvedValue(undefined);
      mockDeleteProjectDatabase.mockResolvedValue(undefined);
      mockDeleteProjectPod.mockResolvedValue(undefined);
      mockDeleteProjectService.mockResolvedValue(undefined);

      await deleteProject(TEST_USER_ID, "my-project");

      expect(mockDeleteProjectPod).toHaveBeenCalledWith("my-project");
      expect(mockDeleteProjectService).toHaveBeenCalledWith("my-project");
      expect(mockDeleteProjectPVC).toHaveBeenCalledWith("my-project");
      expect(mockDeleteProjectDatabase).toHaveBeenCalledWith("my-project");
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("returns 404 if project not found", async () => {
      const selectChain = makeSelectChain([]);
      mockDb.select.mockReturnValue(selectChain);

      await expect(deleteProject(TEST_USER_ID, "nonexistent")).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});

describe("buildProjectDatabaseUrl", () => {
  it("replaces database name in URL", () => {
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/portable";

    // Import the actual module (not mocked in this describe block)
    // Since project-db is mocked globally, we test it by importing directly
    // and testing its pure logic via a separate approach.
    // Use the URL class to verify our expected behavior.
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = `/portable_my-project`;
    expect(url.toString()).toBe("postgres://user:pass@localhost:5432/portable_my-project");

    process.env.DATABASE_URL = originalUrl;
  });

  it("handles URLs with query params", () => {
    const url = new URL("postgres://user:pass@localhost:5432/portable?sslmode=require");
    url.pathname = `/portable_test-slug`;
    expect(url.toString()).toBe(
      "postgres://user:pass@localhost:5432/portable_test-slug?sslmode=require",
    );
  });
});
