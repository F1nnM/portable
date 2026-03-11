import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const { app } = createApp();

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
  it("returns branch, commits, staged, unstaged, and remote info", async () => {
    const response = await app.request("/api/git");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("branch");
    expect(body).toHaveProperty("commits");
    expect(body).toHaveProperty("staged");
    expect(body).toHaveProperty("unstaged");
    expect(body).toHaveProperty("ahead");
    expect(body).toHaveProperty("behind");
    expect(body).toHaveProperty("hasRemote");
    // Local repo has no remote
    expect(body.hasRemote).toBe(false);
    expect(body.ahead).toBe(0);
    expect(body.behind).toBe(0);
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

describe("git api - GET /api/git/diff/:path", () => {
  it("returns diff for unstaged modified file", async () => {
    writeFileSync(path.join(workspaceDir, "README.md"), "# Modified Content");

    const response = await app.request("/api/git/diff/README.md");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.diff).toContain("-# Hello");
    expect(body.diff).toContain("+# Modified Content");

    // Clean up
    execSync("git checkout -- README.md", { cwd: workspaceDir });
  });

  it("returns diff for staged file when staged=true", async () => {
    writeFileSync(path.join(workspaceDir, "README.md"), "# Staged Change");
    execSync("git add README.md", { cwd: workspaceDir });

    const response = await app.request("/api/git/diff/README.md?staged=true");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.diff).toContain("-# Hello");
    expect(body.diff).toContain("+# Staged Change");

    // Clean up
    execSync("git reset HEAD README.md", { cwd: workspaceDir });
    execSync("git checkout -- README.md", { cwd: workspaceDir });
  });

  it("returns 404 when file has no changes", async () => {
    const response = await app.request("/api/git/diff/README.md");
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toBe("No changes for this file");
  });

  it("supports nested file paths", async () => {
    writeFileSync(path.join(workspaceDir, "src/main.ts"), 'console.log("modified");');

    const response = await app.request("/api/git/diff/src/main.ts");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.diff).toContain("main.ts");

    // Clean up
    execSync("git checkout -- src/main.ts", { cwd: workspaceDir });
  });

  it("returns diff for new untracked file using --no-index", async () => {
    writeFileSync(path.join(workspaceDir, "newfile.txt"), "new content");

    const response = await app.request("/api/git/diff/newfile.txt");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.diff).toContain("new content");

    // Clean up
    rmSync(path.join(workspaceDir, "newfile.txt"));
  });
});

describe("git api - POST /api/git/stage", () => {
  it("stages specific files", async () => {
    writeFileSync(path.join(workspaceDir, "to-stage.txt"), "stage me");

    const response = await app.request("/api/git/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: ["to-stage.txt"] }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    // Verify file is staged
    const statusRes = await app.request("/api/git");
    const status = await statusRes.json();
    expect(status.staged.some((f: { path: string }) => f.path === "to-stage.txt")).toBe(true);

    // Clean up
    execSync("git reset HEAD to-stage.txt", { cwd: workspaceDir });
    rmSync(path.join(workspaceDir, "to-stage.txt"));
  });

  it("stages all files", async () => {
    writeFileSync(path.join(workspaceDir, "a.txt"), "a");
    writeFileSync(path.join(workspaceDir, "b.txt"), "b");

    const response = await app.request("/api/git/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    expect(response.status).toBe(200);

    const statusRes = await app.request("/api/git");
    const status = await statusRes.json();
    expect(status.staged.some((f: { path: string }) => f.path === "a.txt")).toBe(true);
    expect(status.staged.some((f: { path: string }) => f.path === "b.txt")).toBe(true);

    // Clean up
    execSync("git reset HEAD a.txt b.txt", { cwd: workspaceDir });
    rmSync(path.join(workspaceDir, "a.txt"));
    rmSync(path.join(workspaceDir, "b.txt"));
  });

  it("returns 400 with no paths or all", async () => {
    const response = await app.request("/api/git/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });
});

describe("git api - POST /api/git/unstage", () => {
  it("unstages specific files", async () => {
    writeFileSync(path.join(workspaceDir, "staged-file.txt"), "content");
    execSync("git add staged-file.txt", { cwd: workspaceDir });

    const response = await app.request("/api/git/unstage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: ["staged-file.txt"] }),
    });
    expect(response.status).toBe(200);

    // Verify file is no longer staged
    const statusRes = await app.request("/api/git");
    const status = await statusRes.json();
    expect(status.staged.some((f: { path: string }) => f.path === "staged-file.txt")).toBe(false);
    expect(status.unstaged.some((f: { path: string }) => f.path === "staged-file.txt")).toBe(true);

    // Clean up
    rmSync(path.join(workspaceDir, "staged-file.txt"));
  });

  it("unstages all files", async () => {
    writeFileSync(path.join(workspaceDir, "x.txt"), "x");
    writeFileSync(path.join(workspaceDir, "y.txt"), "y");
    execSync("git add x.txt y.txt", { cwd: workspaceDir });

    const response = await app.request("/api/git/unstage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    expect(response.status).toBe(200);

    const statusRes = await app.request("/api/git");
    const status = await statusRes.json();
    expect(status.staged.length).toBe(0);

    // Clean up
    rmSync(path.join(workspaceDir, "x.txt"));
    rmSync(path.join(workspaceDir, "y.txt"));
  });

  it("returns 400 with no paths or all", async () => {
    const response = await app.request("/api/git/unstage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });
});

describe("git api - POST /api/git/commit", () => {
  it("commits staged changes", async () => {
    writeFileSync(path.join(workspaceDir, "commit-test.txt"), "commit me");
    execSync("git add commit-test.txt", { cwd: workspaceDir });

    const response = await app.request("/api/git/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Test commit" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    // Verify commit appears in log
    const statusRes = await app.request("/api/git");
    const status = await statusRes.json();
    expect(status.commits[0].message).toBe("Test commit");
    expect(status.staged.length).toBe(0);
  });

  it("returns 400 with empty message", async () => {
    const response = await app.request("/api/git/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    expect(response.status).toBe(400);
  });

  it("returns 400 with whitespace-only message", async () => {
    const response = await app.request("/api/git/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    });
    expect(response.status).toBe(400);
  });

  it("returns 500 when nothing is staged", async () => {
    const response = await app.request("/api/git/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Nothing to commit" }),
    });
    expect(response.status).toBe(500);
  });
});

describe("git api - POST /api/git/push", () => {
  it("returns 500 when no remote configured", async () => {
    const response = await app.request("/api/git/push", { method: "POST" });
    expect(response.status).toBe(500);
  });
});

describe("git api - POST /api/git/pull", () => {
  it("returns 500 when no remote configured", async () => {
    const response = await app.request("/api/git/pull", { method: "POST" });
    expect(response.status).toBe(500);
  });
});

describe("git api - non-git workspace", () => {
  let nonGitDir: string;
  let savedWorkspaceDir: string | undefined;

  beforeAll(async () => {
    nonGitDir = await mkdtemp(path.join(tmpdir(), "pod-server-nongit-test-"));
    // Create a plain file so it's a valid directory but not a git repo
    writeFileSync(path.join(nonGitDir, "README.md"), "# Not a git repo");
    savedWorkspaceDir = process.env.WORKSPACE_DIR;
    process.env.WORKSPACE_DIR = nonGitDir;
  });

  afterAll(() => {
    process.env.WORKSPACE_DIR = savedWorkspaceDir;
    rmSync(nonGitDir, { recursive: true, force: true });
  });

  it("returns 500 for non-git workspace", async () => {
    const response = await app.request("/api/git");
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body).toEqual({ error: "Not a git repository or git is not available" });
  });
});
