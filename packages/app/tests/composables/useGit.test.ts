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
    const gitData = {
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
    };
    mockFetch.mockResolvedValueOnce(gitData);

    const { branch, commits, staged, unstaged, fetchGitStatus } = useGit("my-project");
    await fetchGitStatus();

    expect(mockFetch).toHaveBeenCalledWith("/api/projects/my-project/pod/api/git");
    expect(branch.value).toBe("main");
    expect(commits.value).toHaveLength(1);
    expect(commits.value[0].shortHash).toBe("abc123d");
    expect(staged.value).toHaveLength(1);
    expect(staged.value[0].path).toBe("src/index.ts");
    expect(unstaged.value).toHaveLength(1);
    expect(unstaged.value[0].status).toBe("untracked");
  });

  it("handles multiple commits", async () => {
    const gitData = {
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
    };
    mockFetch.mockResolvedValueOnce(gitData);

    const { branch, commits, fetchGitStatus } = useGit("my-project");
    await fetchGitStatus();

    expect(branch.value).toBe("feature-branch");
    expect(commits.value).toHaveLength(2);
    expect(commits.value[0].message).toBe("Second commit");
    expect(commits.value[1].message).toBe("First commit");
  });

  it("handles empty git status", async () => {
    const gitData = {
      branch: "main",
      commits: [],
      staged: [],
      unstaged: [],
    };
    mockFetch.mockResolvedValueOnce(gitData);

    const { branch, commits, staged, unstaged, fetchGitStatus } = useGit("my-project");
    await fetchGitStatus();

    expect(branch.value).toBe("main");
    expect(commits.value).toHaveLength(0);
    expect(staged.value).toHaveLength(0);
    expect(unstaged.value).toHaveLength(0);
  });

  it("handles fetch errors gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { branch, commits, staged, unstaged, fetchGitStatus } = useGit("my-project");
    await fetchGitStatus();

    expect(branch.value).toBe("");
    expect(commits.value).toHaveLength(0);
    expect(staged.value).toHaveLength(0);
    expect(unstaged.value).toHaveLength(0);
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
    const gitData = {
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
    };
    mockFetch.mockResolvedValueOnce(gitData);

    const { staged, unstaged, fetchGitStatus } = useGit("my-project");
    await fetchGitStatus();

    expect(staged.value).toHaveLength(2);
    expect(staged.value[0].status).toBe("added");
    expect(staged.value[1].status).toBe("modified");
    expect(unstaged.value).toHaveLength(3);
    expect(unstaged.value[2].status).toBe("deleted");
  });

  it("updates state on subsequent fetches", async () => {
    mockFetch.mockResolvedValueOnce({
      branch: "main",
      commits: [],
      staged: [],
      unstaged: [{ path: "file.ts", status: "modified" }],
    });

    const { unstaged, fetchGitStatus } = useGit("my-project");
    await fetchGitStatus();
    expect(unstaged.value).toHaveLength(1);

    mockFetch.mockResolvedValueOnce({
      branch: "main",
      commits: [],
      staged: [{ path: "file.ts", status: "modified" }],
      unstaged: [],
    });

    await fetchGitStatus();
    expect(unstaged.value).toHaveLength(0);
  });
});
