import type { execSync } from "node:child_process";
import type { existsSync, readdirSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { setupWorkspace } from "../src/setup.js";

function createMocks(options: {
  files?: string[];
  nodeModulesExists?: boolean;
  lockFiles?: string[];
}) {
  const { files = [], nodeModulesExists = false, lockFiles = [] } = options;

  const mockExecSync = vi.fn();

  const mockExistsSync = vi.fn((path: string) => {
    if (typeof path === "string" && path.endsWith("/node_modules")) {
      return nodeModulesExists;
    }
    // Check for lock files
    for (const lock of lockFiles) {
      if (typeof path === "string" && path.endsWith(`/${lock}`)) {
        return true;
      }
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

  return { mockExecSync, mockExistsSync, mockReaddirSync };
}

describe("setupWorkspace", () => {
  it("clones repo when workspace is empty and GITHUB_REPO_URL is set", () => {
    const { mockExecSync, mockExistsSync, mockReaddirSync } = createMocks({
      files: [],
      nodeModulesExists: false,
    });

    // Workspace dir doesn't exist => no files
    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/workspace") return false;
      return false;
    });

    setupWorkspace({
      workspaceDir: "/workspace",
      githubRepoUrl: "https://github.com/user/repo.git",
      execSyncFn: mockExecSync as unknown as typeof execSync,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    expect(mockExecSync).toHaveBeenCalledWith(
      "git clone https://github.com/user/repo.git .",
      expect.objectContaining({ cwd: "/workspace" }),
    );
  });

  it("injects GitHub token into clone URL when provided", () => {
    const { mockExecSync, mockExistsSync, mockReaddirSync } = createMocks({
      files: [],
      nodeModulesExists: false,
    });

    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/workspace") return false;
      return false;
    });

    setupWorkspace({
      workspaceDir: "/workspace",
      githubRepoUrl: "https://github.com/user/repo.git",
      githubToken: "ghp_test123",
      execSyncFn: mockExecSync as unknown as typeof execSync,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    expect(mockExecSync).toHaveBeenCalledWith(
      "git clone https://x-access-token:ghp_test123@github.com/user/repo.git .",
      expect.objectContaining({ cwd: "/workspace" }),
    );
  });

  it("skips clone when workspace already has files", () => {
    const { mockExecSync, mockExistsSync, mockReaddirSync } = createMocks({
      files: ["package.json", "src"],
      nodeModulesExists: true,
    });

    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/workspace") return true;
      if (typeof path === "string" && path.endsWith("/node_modules")) return true;
      return false;
    });

    setupWorkspace({
      workspaceDir: "/workspace",
      githubRepoUrl: "https://github.com/user/repo.git",
      execSyncFn: mockExecSync as unknown as typeof execSync,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    // Should NOT have called git clone
    const cloneCalls = mockExecSync.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("git clone"),
    );
    expect(cloneCalls).toHaveLength(0);
  });

  it("skips clone when no GITHUB_REPO_URL is set", () => {
    const { mockExecSync, mockExistsSync, mockReaddirSync } = createMocks({
      files: [],
      nodeModulesExists: false,
    });

    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/workspace") return false;
      return false;
    });

    setupWorkspace({
      workspaceDir: "/workspace",
      // No githubRepoUrl
      execSyncFn: mockExecSync as unknown as typeof execSync,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    // No clone call
    const cloneCalls = mockExecSync.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("git clone"),
    );
    expect(cloneCalls).toHaveLength(0);
  });

  it("runs npm install when node_modules is missing", () => {
    const { mockExecSync, mockExistsSync, mockReaddirSync } = createMocks({
      files: ["package.json"],
      nodeModulesExists: false,
    });

    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/workspace") return true;
      if (typeof path === "string" && path.endsWith("/node_modules")) return false;
      return false;
    });

    setupWorkspace({
      workspaceDir: "/workspace",
      execSyncFn: mockExecSync as unknown as typeof execSync,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    expect(mockExecSync).toHaveBeenCalledWith(
      "npm install",
      expect.objectContaining({ cwd: "/workspace" }),
    );
  });

  it("skips install when node_modules exists", () => {
    const { mockExecSync, mockExistsSync, mockReaddirSync } = createMocks({
      files: ["package.json", "node_modules"],
      nodeModulesExists: true,
    });

    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/workspace") return true;
      if (typeof path === "string" && path.endsWith("/node_modules")) return true;
      return false;
    });

    setupWorkspace({
      workspaceDir: "/workspace",
      execSyncFn: mockExecSync as unknown as typeof execSync,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    // No install call
    const installCalls = mockExecSync.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("install"),
    );
    expect(installCalls).toHaveLength(0);
  });

  it("detects pnpm from pnpm-lock.yaml", () => {
    const { mockExecSync, mockExistsSync, mockReaddirSync } = createMocks({
      files: ["package.json"],
      nodeModulesExists: false,
    });

    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/workspace") return true;
      if (typeof path === "string" && path.endsWith("/node_modules")) return false;
      if (typeof path === "string" && path.endsWith("/pnpm-lock.yaml")) return true;
      return false;
    });

    setupWorkspace({
      workspaceDir: "/workspace",
      execSyncFn: mockExecSync as unknown as typeof execSync,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    expect(mockExecSync).toHaveBeenCalledWith(
      "pnpm install",
      expect.objectContaining({ cwd: "/workspace" }),
    );
  });

  it("detects yarn from yarn.lock", () => {
    const { mockExecSync, mockExistsSync, mockReaddirSync } = createMocks({
      files: ["package.json"],
      nodeModulesExists: false,
    });

    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/workspace") return true;
      if (typeof path === "string" && path.endsWith("/node_modules")) return false;
      if (typeof path === "string" && path.endsWith("/pnpm-lock.yaml")) return false;
      if (typeof path === "string" && path.endsWith("/yarn.lock")) return true;
      return false;
    });

    setupWorkspace({
      workspaceDir: "/workspace",
      execSyncFn: mockExecSync as unknown as typeof execSync,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    expect(mockExecSync).toHaveBeenCalledWith(
      "yarn install",
      expect.objectContaining({ cwd: "/workspace" }),
    );
  });

  it("ignores lost+found when checking if workspace has files", () => {
    const { mockExecSync, mockExistsSync, mockReaddirSync } = createMocks({
      files: ["lost+found"],
      nodeModulesExists: false,
    });

    mockExistsSync.mockImplementation((path: string) => {
      if (path === "/workspace") return true;
      if (typeof path === "string" && path.endsWith("/node_modules")) return false;
      return false;
    });

    setupWorkspace({
      workspaceDir: "/workspace",
      githubRepoUrl: "https://github.com/user/repo.git",
      execSyncFn: mockExecSync as unknown as typeof execSync,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    // Should clone because lost+found doesn't count as real files
    const cloneCalls = mockExecSync.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("git clone"),
    );
    expect(cloneCalls).toHaveLength(1);
  });
});
