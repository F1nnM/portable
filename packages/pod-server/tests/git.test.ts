import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";

let workspaceDir: string;

beforeAll(async () => {
  workspaceDir = await mkdtemp(path.join(tmpdir(), "pod-server-git-test-"));
  process.env.WORKSPACE_DIR = workspaceDir;

  // Initialize a git repo with some commits
  execSync("git init", { cwd: workspaceDir });
  execSync('git config user.email "test@test.com"', { cwd: workspaceDir });
  execSync('git config user.name "Test User"', { cwd: workspaceDir });

  writeFileSync(path.join(workspaceDir, "README.md"), "# Hello");
  execSync("git add README.md", { cwd: workspaceDir });
  execSync('git commit -m "Initial commit"', { cwd: workspaceDir });

  mkdirSync(path.join(workspaceDir, "src"), { recursive: true });
  writeFileSync(path.join(workspaceDir, "src/main.ts"), 'console.log("hello");');
  execSync("git add src/main.ts", { cwd: workspaceDir });
  execSync('git commit -m "Add main.ts"', { cwd: workspaceDir });
});

afterAll(() => {
  rmSync(workspaceDir, { recursive: true, force: true });
  delete process.env.WORKSPACE_DIR;
});

describe("git api - GET /api/git", () => {
  it("returns branch, commits, staged, and unstaged", async () => {
    const response = await app.request("/api/git");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("branch");
    expect(body).toHaveProperty("commits");
    expect(body).toHaveProperty("staged");
    expect(body).toHaveProperty("unstaged");
  });

  it("returns the current branch name", async () => {
    const response = await app.request("/api/git");
    const body = await response.json();

    // git init defaults to "master" or "main" depending on config
    expect(typeof body.branch).toBe("string");
    expect(body.branch.length).toBeGreaterThan(0);
  });

  it("returns commit history with correct fields", async () => {
    const response = await app.request("/api/git");
    const body = await response.json();

    expect(body.commits.length).toBe(2);

    const commit = body.commits[0];
    expect(commit).toHaveProperty("hash");
    expect(commit).toHaveProperty("shortHash");
    expect(commit).toHaveProperty("message");
    expect(commit).toHaveProperty("author");
    expect(commit).toHaveProperty("date");

    // Most recent commit first
    expect(body.commits[0].message).toBe("Add main.ts");
    expect(body.commits[1].message).toBe("Initial commit");
  });

  it("returns staged files when present", async () => {
    // Stage a new file
    writeFileSync(path.join(workspaceDir, "staged.txt"), "staged content");
    execSync("git add staged.txt", { cwd: workspaceDir });

    const response = await app.request("/api/git");
    const body = await response.json();

    expect(body.staged.some((f: { path: string }) => f.path === "staged.txt")).toBe(true);

    // Clean up
    execSync("git reset HEAD staged.txt", { cwd: workspaceDir });
    rmSync(path.join(workspaceDir, "staged.txt"));
  });

  it("returns unstaged files when present", async () => {
    // Create an untracked file
    writeFileSync(path.join(workspaceDir, "untracked.txt"), "untracked content");

    const response = await app.request("/api/git");
    const body = await response.json();

    expect(body.unstaged.some((f: { path: string }) => f.path === "untracked.txt")).toBe(true);

    // Clean up
    rmSync(path.join(workspaceDir, "untracked.txt"));
  });

  it("returns modified unstaged files", async () => {
    // Modify a tracked file without staging
    writeFileSync(path.join(workspaceDir, "README.md"), "# Modified");

    const response = await app.request("/api/git");
    const body = await response.json();

    expect(body.unstaged).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "README.md" })]),
    );

    // Clean up
    execSync("git checkout -- README.md", { cwd: workspaceDir });
  });
});
