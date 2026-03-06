import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Octokit
const mockListForAuthenticatedUser = vi.fn();
vi.mock("octokit", () => {
  return {
    Octokit: class MockOctokit {
      rest = {
        repos: {
          listForAuthenticatedUser: mockListForAuthenticatedUser,
        },
      };
    },
  };
});

const { listUserRepos } = await import("../../server/utils/github");

describe("listUserRepos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns repos with expected shape", async () => {
    mockListForAuthenticatedUser.mockResolvedValue({
      data: [
        {
          name: "my-repo",
          full_name: "user/my-repo",
          description: "A cool repo",
          private: false,
          language: "TypeScript",
          default_branch: "main",
          html_url: "https://github.com/user/my-repo",
        },
      ],
    });

    const repos = await listUserRepos("ghp_test_token");

    expect(repos).toEqual([
      {
        name: "my-repo",
        fullName: "user/my-repo",
        description: "A cool repo",
        isPrivate: false,
        language: "TypeScript",
        defaultBranch: "main",
        url: "https://github.com/user/my-repo",
      },
    ]);
  });

  it("passes correct parameters to Octokit", async () => {
    mockListForAuthenticatedUser.mockResolvedValue({ data: [] });

    await listUserRepos("ghp_test_token");

    expect(mockListForAuthenticatedUser).toHaveBeenCalledWith(
      expect.objectContaining({
        per_page: 100,
        sort: "updated",
      }),
    );
  });

  it("handles null description and language", async () => {
    mockListForAuthenticatedUser.mockResolvedValue({
      data: [
        {
          name: "empty-repo",
          full_name: "user/empty-repo",
          description: null,
          private: true,
          language: null,
          default_branch: "main",
          html_url: "https://github.com/user/empty-repo",
        },
      ],
    });

    const repos = await listUserRepos("ghp_test_token");

    expect(repos[0].description).toBeNull();
    expect(repos[0].language).toBeNull();
    expect(repos[0].isPrivate).toBe(true);
  });

  it("maps multiple repos correctly", async () => {
    mockListForAuthenticatedUser.mockResolvedValue({
      data: [
        {
          name: "repo-a",
          full_name: "user/repo-a",
          description: "First repo",
          private: false,
          language: "JavaScript",
          default_branch: "main",
          html_url: "https://github.com/user/repo-a",
        },
        {
          name: "repo-b",
          full_name: "user/repo-b",
          description: "Second repo",
          private: true,
          language: "Python",
          default_branch: "develop",
          html_url: "https://github.com/user/repo-b",
        },
      ],
    });

    const repos = await listUserRepos("ghp_test_token");

    expect(repos).toHaveLength(2);
    expect(repos[0].name).toBe("repo-a");
    expect(repos[1].name).toBe("repo-b");
    expect(repos[1].defaultBranch).toBe("develop");
  });
});
