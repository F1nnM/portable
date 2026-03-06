import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";

let workspaceDir: string;

beforeAll(async () => {
  workspaceDir = await mkdtemp(path.join(tmpdir(), "pod-server-test-"));
  process.env.WORKSPACE_DIR = workspaceDir;

  // Create a test file structure
  mkdirSync(path.join(workspaceDir, "src"), { recursive: true });
  mkdirSync(path.join(workspaceDir, "node_modules", "some-pkg"), { recursive: true });
  mkdirSync(path.join(workspaceDir, ".git", "objects"), { recursive: true });

  writeFileSync(path.join(workspaceDir, "README.md"), "# Hello");
  writeFileSync(path.join(workspaceDir, "src", "main.ts"), 'console.log("hello");');
  writeFileSync(
    path.join(workspaceDir, "node_modules", "some-pkg", "index.js"),
    "module.exports = {}",
  );
  writeFileSync(path.join(workspaceDir, ".git", "objects", "abc"), "gitobj");
});

afterAll(() => {
  rmSync(workspaceDir, { recursive: true, force: true });
  delete process.env.WORKSPACE_DIR;
});

describe("health route (after refactor)", () => {
  it("returns 503 with setting_up phase when not ready", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ status: "setting_up", phase: "initializing" });
  });
});

describe("file tree - GET /api/files", () => {
  it("returns a file tree excluding node_modules and .git", async () => {
    const response = await app.request("/api/files");
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toHaveProperty("files");
    expect(Array.isArray(body.files)).toBe(true);

    // Should include real files
    expect(body.files).toContain("README.md");
    expect(body.files).toContain("src/main.ts");

    // Should NOT include node_modules or .git
    const hasNodeModules = body.files.some((f: string) => f.includes("node_modules"));
    const hasGit = body.files.some((f: string) => f.startsWith(".git"));
    expect(hasNodeModules).toBe(false);
    expect(hasGit).toBe(false);
  });
});

describe("file read - GET /api/files/:path", () => {
  it("returns file content for an existing file", async () => {
    const response = await app.request("/api/files/README.md");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("# Hello");
  });

  it("returns file content for nested paths", async () => {
    const response = await app.request("/api/files/src/main.ts");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe('console.log("hello");');
  });

  it("returns 404 for nonexistent files", async () => {
    const response = await app.request("/api/files/nonexistent.txt");
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: "File not found" });
  });

  it("returns 404 for literal path traversal (Hono normalizes ../)", async () => {
    // Hono resolves literal ../ at the routing layer, so /api/files/../../../etc/passwd
    // becomes /etc/passwd which does not match /api/files/* -- returns 404
    const response = await app.request("/api/files/../../../etc/passwd");
    expect(response.status).toBe(404);
  });

  it("returns 403 for encoded path traversal", async () => {
    const response = await app.request("/api/files/..%2F..%2F..%2Fetc%2Fpasswd");
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: "Path traversal not allowed" });
  });

  it("returns 403 for mixed path traversal", async () => {
    const response = await app.request("/api/files/subdir/..%2F..%2F..%2Fetc%2Fpasswd");
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: "Path traversal not allowed" });
  });
});

describe("file write - PUT /api/files/:path", () => {
  it("writes file content", async () => {
    const response = await app.request("/api/files/test-write.txt", {
      method: "PUT",
      body: "new file content",
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });

    // Verify file was written by reading it back
    const readResponse = await app.request("/api/files/test-write.txt");
    expect(readResponse.status).toBe(200);
    const text = await readResponse.text();
    expect(text).toBe("new file content");
  });

  it("creates parent directories on write", async () => {
    const response = await app.request("/api/files/deep/nested/dir/file.txt", {
      method: "PUT",
      body: "deeply nested content",
    });
    expect(response.status).toBe(200);

    // Verify it's readable
    const readResponse = await app.request("/api/files/deep/nested/dir/file.txt");
    expect(readResponse.status).toBe(200);
    const text = await readResponse.text();
    expect(text).toBe("deeply nested content");
  });

  it("returns 403 for path traversal on write (encoded)", async () => {
    const response = await app.request("/api/files/..%2F..%2F..%2Ftmp%2Fevil.txt", {
      method: "PUT",
      body: "evil content",
    });
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: "Path traversal not allowed" });
  });
});
