import { describe, expect, it } from "vitest";

// We need to test parseGitHubRepoUrl which is a pure function
import { parseGitHubRepoUrl } from "../../server/utils/github";

describe("parseGitHubRepoUrl", () => {
  it("parses HTTPS GitHub URL", () => {
    const result = parseGitHubRepoUrl("https://github.com/owner/repo");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("parses URL with .git suffix", () => {
    const result = parseGitHubRepoUrl("https://github.com/owner/repo.git");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("returns null for non-GitHub URL", () => {
    expect(parseGitHubRepoUrl("https://gitlab.com/owner/repo")).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(parseGitHubRepoUrl("not-a-url")).toBeNull();
  });

  it("returns null for GitHub URL without repo", () => {
    expect(parseGitHubRepoUrl("https://github.com/owner")).toBeNull();
  });

  it("handles URL with additional path segments", () => {
    const result = parseGitHubRepoUrl("https://github.com/owner/repo/tree/main");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });
});
