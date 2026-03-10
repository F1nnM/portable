import type { existsSync, readdirSync } from "node:fs";
import type { ExecFn } from "../src/setup.js";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupWorkspace } from "../src/setup.js";

function createMocks(options: { files?: string[]; nodeModulesExists?: boolean }) {
  const { files = [], nodeModulesExists = false } = options;

  const mockExecFn = vi.fn().mockResolvedValue(undefined);

  const mockExistsSync = vi.fn((path: string) => {
    if (typeof path === "string" && path.endsWith("/node_modules")) {
      return nodeModulesExists;
    }
    // Workspace directory exists if it has files
    if (path === "/workspace") {
      return files.length > 0;
    }
    return false;
  });

  const mockReaddirSync = vi.fn((_path: string) => {
    return files;
  });

  return { mockExecFn, mockExistsSync, mockReaddirSync };
}

describe("setupWorkspace", () => {
  it("clones repo when workspace is empty and GITHUB_REPO_URL is set", async () => {
    const { mockExecFn, mockExistsSync, mockReaddirSync } = createMocks({
      files: [],
      nodeModulesExists: false,
    });

    // Workspace dir doesn't exist => no files
    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/workspace") return false;
      return false;
    });

    await setupWorkspace({
      workspaceDir: "/workspace",
      githubRepoUrl: "https://github.com/user/repo.git",
      execFn: mockExecFn as unknown as ExecFn,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    expect(mockExecFn).toHaveBeenCalledWith(
      "git",
      ["clone", "https://github.com/user/repo.git", "."],
      expect.objectContaining({ cwd: "/workspace" }),
    );
  });

  it("injects GitHub token into clone URL when provided", async () => {
    const { mockExecFn, mockExistsSync, mockReaddirSync } = createMocks({
      files: [],
      nodeModulesExists: false,
    });

    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/workspace") return false;
      return false;
    });

    await setupWorkspace({
      workspaceDir: "/workspace",
      githubRepoUrl: "https://github.com/user/repo.git",
      githubToken: "ghp_test123",
      execFn: mockExecFn as unknown as ExecFn,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    expect(mockExecFn).toHaveBeenCalledWith(
      "git",
      ["clone", "https://x-access-token:ghp_test123@github.com/user/repo.git", "."],
      expect.objectContaining({ cwd: "/workspace" }),
    );
  });

  it("skips clone when workspace already has files", async () => {
    const { mockExecFn, mockExistsSync, mockReaddirSync } = createMocks({
      files: ["package.json", "src"],
      nodeModulesExists: true,
    });

    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/workspace") return true;
      if (typeof path === "string" && path.endsWith("/node_modules")) return true;
      return false;
    });

    await setupWorkspace({
      workspaceDir: "/workspace",
      githubRepoUrl: "https://github.com/user/repo.git",
      execFn: mockExecFn as unknown as ExecFn,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    // Should NOT have called git clone
    const cloneCalls = mockExecFn.mock.calls.filter((call: unknown[]) => call[0] === "git");
    expect(cloneCalls).toHaveLength(0);
  });

  it("skips clone when no GITHUB_REPO_URL is set", async () => {
    const { mockExecFn, mockExistsSync, mockReaddirSync } = createMocks({
      files: [],
      nodeModulesExists: false,
    });

    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/workspace") return false;
      return false;
    });

    await setupWorkspace({
      workspaceDir: "/workspace",
      // No githubRepoUrl
      execFn: mockExecFn as unknown as ExecFn,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    // No clone call
    const cloneCalls = mockExecFn.mock.calls.filter((call: unknown[]) => call[0] === "git");
    expect(cloneCalls).toHaveLength(0);
  });

  it("runs bun install when node_modules is missing", async () => {
    const { mockExecFn, mockExistsSync, mockReaddirSync } = createMocks({
      files: ["package.json"],
      nodeModulesExists: false,
    });

    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/workspace") return true;
      if (typeof path === "string" && path.endsWith("/node_modules")) return false;
      return false;
    });

    await setupWorkspace({
      workspaceDir: "/workspace",
      execFn: mockExecFn as unknown as ExecFn,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    expect(mockExecFn).toHaveBeenCalledWith(
      "bun",
      ["install"],
      expect.objectContaining({ cwd: "/workspace" }),
    );
  });

  it("skips install when node_modules exists", async () => {
    const { mockExecFn, mockExistsSync, mockReaddirSync } = createMocks({
      files: ["package.json", "node_modules"],
      nodeModulesExists: true,
    });

    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/workspace") return true;
      if (typeof path === "string" && path.endsWith("/node_modules")) return true;
      return false;
    });

    await setupWorkspace({
      workspaceDir: "/workspace",
      execFn: mockExecFn as unknown as ExecFn,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    // No install call
    expect(mockExecFn).not.toHaveBeenCalled();
  });

  describe("ensureGitignoreEntry (via setupWorkspace)", () => {
    let tempDir: string;

    afterEach(() => {
      if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("appends .claude/ to existing .gitignore after clone", async () => {
      tempDir = await mkdtemp(path.join(tmpdir(), "setup-gitignore-"));
      // Create a .gitignore without .claude/
      writeFileSync(path.join(tempDir, ".gitignore"), "node_modules\n.env\n");
      // Create a dummy file so hasFiles() returns true (skip clone)
      writeFileSync(path.join(tempDir, "package.json"), "{}");
      // Create node_modules so install is skipped
      mkdirSync(path.join(tempDir, "node_modules"), { recursive: true });

      const mockExecFn = vi.fn().mockResolvedValue(undefined);

      await setupWorkspace({
        workspaceDir: tempDir,
        execFn: mockExecFn as unknown as ExecFn,
      });

      const content = readFileSync(path.join(tempDir, ".gitignore"), "utf-8");
      expect(content).toContain(".claude/");
      // Original content should still be there
      expect(content).toContain("node_modules");
      expect(content).toContain(".env");
    });

    it("does not duplicate .claude/ in .gitignore if already present", async () => {
      tempDir = await mkdtemp(path.join(tmpdir(), "setup-gitignore-"));
      writeFileSync(path.join(tempDir, ".gitignore"), "node_modules\n.claude/\n.env\n");
      writeFileSync(path.join(tempDir, "package.json"), "{}");
      mkdirSync(path.join(tempDir, "node_modules"), { recursive: true });

      const mockExecFn = vi.fn().mockResolvedValue(undefined);

      await setupWorkspace({
        workspaceDir: tempDir,
        execFn: mockExecFn as unknown as ExecFn,
      });

      const content = readFileSync(path.join(tempDir, ".gitignore"), "utf-8");
      // Count occurrences of .claude/ -- should be exactly 1
      const matches = content.match(/\.claude\//g);
      expect(matches).toHaveLength(1);
    });

    it("handles .gitignore without trailing newline", async () => {
      tempDir = await mkdtemp(path.join(tmpdir(), "setup-gitignore-"));
      // No trailing newline
      writeFileSync(path.join(tempDir, ".gitignore"), "node_modules\n.env");
      writeFileSync(path.join(tempDir, "package.json"), "{}");
      mkdirSync(path.join(tempDir, "node_modules"), { recursive: true });

      const mockExecFn = vi.fn().mockResolvedValue(undefined);

      await setupWorkspace({
        workspaceDir: tempDir,
        execFn: mockExecFn as unknown as ExecFn,
      });

      const content = readFileSync(path.join(tempDir, ".gitignore"), "utf-8");
      expect(content).toContain(".claude/");
      // Verify .claude/ is on its own line (not appended to .env)
      const lines = content.split("\n");
      expect(lines.some((line) => line.trim() === ".claude/")).toBe(true);
      expect(lines.some((line) => line.trim() === ".env")).toBe(true);
    });
  });

  it("ignores lost+found when checking if workspace has files", async () => {
    const { mockExecFn, mockExistsSync, mockReaddirSync } = createMocks({
      files: ["lost+found"],
      nodeModulesExists: false,
    });

    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/workspace") return true;
      if (typeof path === "string" && path.endsWith("/node_modules")) return false;
      return false;
    });

    await setupWorkspace({
      workspaceDir: "/workspace",
      githubRepoUrl: "https://github.com/user/repo.git",
      execFn: mockExecFn as unknown as ExecFn,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    // Should clone because lost+found doesn't count as real files
    const gitCalls = mockExecFn.mock.calls.filter((call: unknown[]) => call[0] === "git");
    expect(gitCalls).toHaveLength(1);
  });
});
