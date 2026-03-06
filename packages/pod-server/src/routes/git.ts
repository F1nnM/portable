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

    return c.json({ branch, commits, staged, unstaged });
  } catch {
    return c.json({ error: "Not a git repository or git is not available" }, 500);
  }
});

export { git };
