import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock $fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

// eslint-disable-next-line ts/consistent-type-imports
type UseGit = Awaited<typeof import("~/composables/useGit")>["useGit"];
let useGit: UseGit;

beforeEach(async () => {
  mockFetch.mockReset();
  const mod = await import("~/composables/useGit");
  useGit = mod.useGit;
});

describe("useGit", () => {
  it("fetches git status from the pod proxy API", async () => {
    const data = {
      branch: "main",
      commits: [
        {
          hash: "abc123def456",
          shortHash: "abc123d",
          message: "Initial commit",
          author: "Test User",
          date: "2025-01-15T10:00:00Z",
        },
      ],
      staged: [{ path: "src/index.ts", status: "modified" }],
      unstaged: [{ path: "README.md", status: "untracked" }],
      ahead: 0,
      behind: 0,
      hasRemote: false,
    };
    mockFetch.mockResolvedValueOnce(data);

    const { gitData, fetchGitStatus } = useGit("my-project");
    await fetchGitStatus();

    expect(mockFetch).toHaveBeenCalledWith("/api/projects/my-project/pod/api/git");
    expect(gitData.value?.branch).toBe("main");
    expect(gitData.value?.commits).toHaveLength(1);
    expect(gitData.value?.commits[0].shortHash).toBe("abc123d");
    expect(gitData.value?.staged).toHaveLength(1);
    expect(gitData.value?.staged[0].path).toBe("src/index.ts");
    expect(gitData.value?.unstaged).toHaveLength(1);
    expect(gitData.value?.unstaged[0].status).toBe("untracked");
  });

  it("handles multiple commits", async () => {
    const data = {
      branch: "feature-branch",
      commits: [
        {
          hash: "aaa111",
          shortHash: "aaa",
          message: "Second commit",
          author: "Alice",
          date: "2025-01-16T12:00:00Z",
        },
        {
          hash: "bbb222",
          shortHash: "bbb",
          message: "First commit",
          author: "Bob",
          date: "2025-01-15T10:00:00Z",
        },
      ],
      staged: [],
      unstaged: [],
      ahead: 0,
      behind: 0,
      hasRemote: false,
    };
    mockFetch.mockResolvedValueOnce(data);

    const { gitData, fetchGitStatus } = useGit("my-project");
    await fetchGitStatus();

    expect(gitData.value?.branch).toBe("feature-branch");
    expect(gitData.value?.commits).toHaveLength(2);
    expect(gitData.value?.commits[0].message).toBe("Second commit");
    expect(gitData.value?.commits[1].message).toBe("First commit");
  });

  it("handles empty git status", async () => {
    mockFetch.mockResolvedValueOnce({
      branch: "main",
      commits: [],
      staged: [],
      unstaged: [],
      ahead: 0,
      behind: 0,
      hasRemote: false,
    });

    const { gitData, fetchGitStatus } = useGit("my-project");
    await fetchGitStatus();

    expect(gitData.value?.branch).toBe("main");
    expect(gitData.value?.commits).toHaveLength(0);
    expect(gitData.value?.staged).toHaveLength(0);
    expect(gitData.value?.unstaged).toHaveLength(0);
  });

  it("handles fetch errors gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { gitData, error, fetchGitStatus } = useGit("my-project");
    await fetchGitStatus();

    expect(gitData.value).toBeNull();
    expect(error.value).toBe("Network error");
  });

  it("exposes loading state", async () => {
    let resolvePromise: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockFetch.mockReturnValueOnce(pendingPromise);

    const { loading, fetchGitStatus } = useGit("my-project");
    expect(loading.value).toBe(false);

    const fetchPromise = fetchGitStatus();
    expect(loading.value).toBe(true);

    resolvePromise!({
      branch: "main",
      commits: [],
      staged: [],
      unstaged: [],
      ahead: 0,
      behind: 0,
      hasRemote: false,
    });
    await fetchPromise;

    expect(loading.value).toBe(false);
  });

  it("sets loading to false on error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { loading, fetchGitStatus } = useGit("my-project");
    await fetchGitStatus();

    expect(loading.value).toBe(false);
  });

  it("handles multiple staged and unstaged files", async () => {
    mockFetch.mockResolvedValueOnce({
      branch: "main",
      commits: [],
      staged: [
        { path: "src/a.ts", status: "added" },
        { path: "src/b.ts", status: "modified" },
      ],
      unstaged: [
        { path: "test.ts", status: "modified" },
        { path: "new-file.ts", status: "untracked" },
        { path: "deleted.ts", status: "deleted" },
      ],
      ahead: 0,
      behind: 0,
      hasRemote: false,
    });

    const { gitData, fetchGitStatus } = useGit("my-project");
    await fetchGitStatus();

    expect(gitData.value?.staged).toHaveLength(2);
    expect(gitData.value?.staged[0].status).toBe("added");
    expect(gitData.value?.staged[1].status).toBe("modified");
    expect(gitData.value?.unstaged).toHaveLength(3);
    expect(gitData.value?.unstaged[2].status).toBe("deleted");
  });

  it("updates state on subsequent fetches", async () => {
    mockFetch.mockResolvedValueOnce({
      branch: "main",
      commits: [],
      staged: [],
      unstaged: [{ path: "file.ts", status: "modified" }],
      ahead: 0,
      behind: 0,
      hasRemote: false,
    });

    const { gitData, fetchGitStatus } = useGit("my-project");
    await fetchGitStatus();
    expect(gitData.value?.unstaged).toHaveLength(1);

    mockFetch.mockResolvedValueOnce({
      branch: "main",
      commits: [],
      staged: [{ path: "file.ts", status: "modified" }],
      unstaged: [],
      ahead: 0,
      behind: 0,
      hasRemote: false,
    });

    await fetchGitStatus();
    expect(gitData.value?.unstaged).toHaveLength(0);
  });

  it("stages files via the API", async () => {
    // Initial status fetch
    mockFetch.mockResolvedValueOnce({ ok: true });
    mockFetch.mockResolvedValueOnce({
      branch: "main",
      commits: [],
      staged: [{ path: "file.ts", status: "added" }],
      unstaged: [],
      ahead: 0,
      behind: 0,
      hasRemote: false,
    });

    const { stageFiles } = useGit("my-project");
    const result = await stageFiles(["file.ts"]);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith("/api/projects/my-project/pod/api/git/stage", {
      method: "POST",
      body: { paths: ["file.ts"] },
    });
  });

  it("commits staged changes via the API", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    mockFetch.mockResolvedValueOnce({
      branch: "main",
      commits: [
        {
          hash: "abc",
          shortHash: "abc",
          message: "test commit",
          author: "Test",
          date: "2025-01-15T10:00:00Z",
        },
      ],
      staged: [],
      unstaged: [],
      ahead: 0,
      behind: 0,
      hasRemote: false,
    });

    const { commit } = useGit("my-project");
    const result = await commit("test commit");

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith("/api/projects/my-project/pod/api/git/commit", {
      method: "POST",
      body: { message: "test commit" },
    });
  });

  it("includes remote tracking info", async () => {
    mockFetch.mockResolvedValueOnce({
      branch: "main",
      commits: [],
      staged: [],
      unstaged: [],
      ahead: 2,
      behind: 1,
      hasRemote: true,
    });

    const { gitData, fetchGitStatus } = useGit("my-project");
    await fetchGitStatus();

    expect(gitData.value?.hasRemote).toBe(true);
    expect(gitData.value?.ahead).toBe(2);
    expect(gitData.value?.behind).toBe(1);
  });
});
