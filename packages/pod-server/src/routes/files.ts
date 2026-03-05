import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fdir as Fdir } from "fdir";
import { Hono } from "hono";

const IGNORE_PATTERNS = new Set([
  "node_modules",
  ".git",
  ".DS_Store",
  ".next",
  ".nuxt",
  ".output",
  ".cache",
  ".turbo",
  "dist",
  "coverage",
  "__pycache__",
]);

function getWorkspaceDir(): string {
  return process.env.WORKSPACE_DIR || "/workspace";
}

function resolveSafePath(workspaceDir: string, requestedPath: string): string | null {
  const resolved = path.resolve(workspaceDir, requestedPath);
  if (!resolved.startsWith(workspaceDir + path.sep) && resolved !== workspaceDir) {
    return null;
  }
  return resolved;
}

const files = new Hono();

files.get("/api/files", async (c) => {
  const workspaceDir = getWorkspaceDir();

  const crawler = new Fdir()
    .withRelativePaths()
    .exclude((dirName) => IGNORE_PATTERNS.has(dirName))
    .crawl(workspaceDir);

  const paths = await crawler.withPromise();
  const sorted = paths.sort();

  return c.json({ files: sorted });
});

files.get("/api/files/*", async (c) => {
  const workspaceDir = getWorkspaceDir();
  const requestedPath = c.req.path.slice("/api/files/".length);

  if (!requestedPath) {
    return c.json({ error: "Path is required" }, 400);
  }

  const decoded = decodeURIComponent(requestedPath);
  const resolved = resolveSafePath(workspaceDir, decoded);

  if (!resolved) {
    return c.json({ error: "Path traversal not allowed" }, 403);
  }

  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) {
      return c.json({ error: "Not a file" }, 400);
    }

    const content = await readFile(resolved, "utf-8");
    return c.text(content);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return c.json({ error: "File not found" }, 404);
    }
    throw err;
  }
});

files.put("/api/files/*", async (c) => {
  const workspaceDir = getWorkspaceDir();
  const requestedPath = c.req.path.slice("/api/files/".length);

  if (!requestedPath) {
    return c.json({ error: "Path is required" }, 400);
  }

  const decoded = decodeURIComponent(requestedPath);
  const resolved = resolveSafePath(workspaceDir, decoded);

  if (!resolved) {
    return c.json({ error: "Path traversal not allowed" }, 403);
  }

  const parentDir = path.dirname(resolved);
  await mkdir(parentDir, { recursive: true });

  const body = await c.req.text();
  await writeFile(resolved, body, "utf-8");

  return c.json({ ok: true }, 200);
});

export { files };
