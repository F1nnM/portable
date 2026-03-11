import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Hono } from "hono";

const execFileAsync = promisify(execFile);

function getWorkspaceDir(): string {
  return process.env.WORKSPACE_DIR || "/workspace";
}

interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

interface GitFileChange {
  path: string;
  status: string;
}

const STATUS_LABELS: Record<string, string> = {
  M: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "copied",
  "?": "untracked",
};

function statusLabel(code: string): string {
  return STATUS_LABELS[code] || code;
}

async function gitExec(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout;
}

const git = new Hono();

git.get("/api/git", async (c) => {
  const workspace = getWorkspaceDir();

  try {
    // Get current branch
    const branch = (await gitExec(["rev-parse", "--abbrev-ref", "HEAD"], workspace)).trim();

    // Get commit log (last 50)
    const logOutput = (
      await gitExec(["log", "--format=%H%n%h%n%s%n%an%n%aI", "-50"], workspace)
    ).trim();

    const commits: GitCommit[] = [];
    if (logOutput) {
      const lines = logOutput.split("\n");
      for (let i = 0; i + 4 < lines.length; i += 5) {
        commits.push({
          hash: lines[i],
          shortHash: lines[i + 1],
          message: lines[i + 2],
          author: lines[i + 3],
          date: lines[i + 4],
        });
      }
    }

    // Get status (staged and unstaged)
    const statusOutput = await gitExec(["status", "--porcelain=v1"], workspace);

    const staged: GitFileChange[] = [];
    const unstaged: GitFileChange[] = [];

    for (const line of statusOutput.split("\n")) {
      if (line.length < 4) continue;
      const indexStatus = line[0];
      const workTreeStatus = line[1];
      const filePath = line.slice(3);

      if (indexStatus !== " " && indexStatus !== "?") {
        staged.push({ path: filePath, status: statusLabel(indexStatus) });
      }
      if (workTreeStatus !== " " && workTreeStatus !== undefined) {
        unstaged.push({
          path: filePath,
          status: statusLabel(workTreeStatus === "?" ? "?" : workTreeStatus),
        });
      }
    }

    // Get remote tracking info
    let ahead = 0;
    let behind = 0;
    let hasRemote = false;
    try {
      const upstream = (
        await gitExec(["rev-parse", "--abbrev-ref", `${branch}@{upstream}`], workspace)
      ).trim();
      if (upstream) {
        hasRemote = true;
        const revList = (
          await gitExec(["rev-list", "--left-right", "--count", `${upstream}...HEAD`], workspace)
        ).trim();
        const parts = revList.split(/\s+/);
        if (parts.length === 2) {
          behind = Number.parseInt(parts[0], 10) || 0;
          ahead = Number.parseInt(parts[1], 10) || 0;
        }
      }
    } catch {
      // No upstream configured
    }

    return c.json({ branch, commits, staged, unstaged, ahead, behind, hasRemote });
  } catch {
    return c.json({ error: "Not a git repository or git is not available" }, 500);
  }
});

git.get("/api/git/diff/:path{.+}", async (c) => {
  const workspace = getWorkspaceDir();
  const filePath = c.req.param("path");

  try {
    const staged = c.req.query("staged") === "true";

    // Try regular diff first
    const args = staged ? ["diff", "--cached", "--", filePath] : ["diff", "--", filePath];

    let diff: string;
    try {
      diff = await gitExec(args, workspace);
    } catch {
      diff = "";
    }

    // If no regular diff, check if it's an untracked file and generate diff with --no-index
    if (!diff && !staged) {
      try {
        // Check if the file is untracked
        const statusOutput = await gitExec(["status", "--porcelain", "--", filePath], workspace);
        if (statusOutput.startsWith("??")) {
          // Use --no-index to diff against /dev/null for untracked files
          const { stdout } = await execFileAsync(
            "git",
            ["diff", "--no-index", "/dev/null", filePath],
            { cwd: workspace },
          ).catch((err: { stdout?: string }) => {
            // git diff --no-index exits with code 1 when there are differences
            if (err.stdout) return { stdout: err.stdout };
            throw err;
          });
          diff = stdout;
        }
      } catch {
        // Ignore errors in untracked file detection
      }
    }

    if (!diff) {
      return c.json({ error: "No changes for this file" }, 404);
    }

    return c.json({ diff });
  } catch {
    return c.json({ error: "Failed to get diff" }, 500);
  }
});

// Stage files
git.post("/api/git/stage", async (c) => {
  const workspace = getWorkspaceDir();
  try {
    const body = await c.req.json<{ paths?: string[]; all?: boolean }>();

    if (body.all) {
      await gitExec(["add", "-A"], workspace);
    } else if (body.paths && body.paths.length > 0) {
      await gitExec(["add", "--", ...body.paths], workspace);
    } else {
      return c.json({ error: "Provide 'paths' array or 'all: true'" }, 400);
    }

    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to stage files";
    return c.json({ error: message }, 500);
  }
});

// Unstage files
git.post("/api/git/unstage", async (c) => {
  const workspace = getWorkspaceDir();
  try {
    const body = await c.req.json<{ paths?: string[]; all?: boolean }>();

    if (body.all) {
      await gitExec(["reset", "HEAD"], workspace);
    } else if (body.paths && body.paths.length > 0) {
      await gitExec(["reset", "HEAD", "--", ...body.paths], workspace);
    } else {
      return c.json({ error: "Provide 'paths' array or 'all: true'" }, 400);
    }

    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to unstage files";
    return c.json({ error: message }, 500);
  }
});

// Commit staged changes
git.post("/api/git/commit", async (c) => {
  const workspace = getWorkspaceDir();
  try {
    const body = await c.req.json<{ message: string }>();

    if (!body.message || !body.message.trim()) {
      return c.json({ error: "Commit message is required" }, 400);
    }

    await gitExec(["commit", "-m", body.message.trim()], workspace);
    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to commit";
    return c.json({ error: message }, 500);
  }
});

// Push to remote
git.post("/api/git/push", async (c) => {
  const workspace = getWorkspaceDir();
  try {
    await gitExec(["push"], workspace);
    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to push";
    return c.json({ error: message }, 500);
  }
});

// Pull from remote
git.post("/api/git/pull", async (c) => {
  const workspace = getWorkspaceDir();
  try {
    await gitExec(["pull"], workspace);
    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to pull";
    return c.json({ error: message }, 500);
  }
});

export { git };
