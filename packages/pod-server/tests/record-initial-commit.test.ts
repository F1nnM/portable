import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBuildState, resetBuildState } from "../src/build-state.js";
import { recordInitialBuiltCommit } from "../src/record-initial-commit.js";

beforeEach(() => {
  resetBuildState();
});

describe("recordInitialBuiltCommit", () => {
  it("sets lastBuiltCommit to HEAD after setup", async () => {
    const mockSpawnAsync = vi.fn().mockResolvedValue({ stdout: "abc123def\n", stderr: "" });

    await recordInitialBuiltCommit({
      workspaceDir: "/workspace",
      spawnAsync: mockSpawnAsync,
    });

    expect(mockSpawnAsync).toHaveBeenCalledWith("git", ["rev-parse", "HEAD"], "/workspace");
    expect(getBuildState().lastBuiltCommit).toBe("abc123def");
  });

  it("trims whitespace from the commit hash", async () => {
    const mockSpawnAsync = vi.fn().mockResolvedValue({ stdout: "  deadbeef456  \n", stderr: "" });

    await recordInitialBuiltCommit({
      workspaceDir: "/workspace",
      spawnAsync: mockSpawnAsync,
    });

    expect(getBuildState().lastBuiltCommit).toBe("deadbeef456");
  });

  it("does not set lastBuiltCommit when git rev-parse fails", async () => {
    const mockSpawnAsync = vi.fn().mockRejectedValue(new Error("not a git repo"));

    await recordInitialBuiltCommit({
      workspaceDir: "/workspace",
      spawnAsync: mockSpawnAsync,
    });

    expect(getBuildState().lastBuiltCommit).toBeNull();
  });
});
