import type { SpawnOptions } from "node:child_process";
import { spawn } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { setPhase } from "./setup-state.js";

export type ExecFn = (
  file: string,
  args: readonly string[],
  options?: SpawnOptions,
) => Promise<void>;

export interface SetupOptions {
  workspaceDir: string;
  githubRepoUrl?: string;
  githubToken?: string;
  /** Build command to run after install. Default: "bun run build". */
  buildCommand?: string;
  /** Inject for testing. Defaults to spawn-based async exec. */
  execFn?: ExecFn;
  /** Inject for testing. Defaults to fs.existsSync. */
  existsSyncFn?: typeof existsSync;
  /** Inject for testing. Defaults to fs.readdirSync. */
  readdirSyncFn?: typeof readdirSync;
}

function ensureGitignoreEntry(
  workspaceDir: string,
  entry: string,
  existsSyncFn: typeof existsSync,
): void {
  const gitignorePath = join(workspaceDir, ".gitignore");
  if (!existsSyncFn(gitignorePath)) return;

  const content = readFileSync(gitignorePath, "utf-8");
  if (content.split("\n").some((line) => line.trim() === entry)) return;

  const separator = content.endsWith("\n") ? "" : "\n";
  appendFileSync(gitignorePath, `${separator}${entry}\n`);
}

const POST_COMMIT_HOOK_CONTENT = `#!/bin/sh
# Auto-rebuild (debounced) and push on commit
curl -s -X POST "http://localhost:3000/api/rebuild?debounce=3000" &
git push &
`;

/**
 * Install a git post-commit hook that triggers a rebuild and pushes.
 * Idempotent: skips if the hook already contains /api/rebuild.
 */
export function installPostCommitHook(
  workspaceDir: string,
  options?: {
    existsSyncFn?: typeof existsSync;
    readFileSyncFn?: typeof readFileSync;
    writeFileSyncFn?: typeof writeFileSync;
    mkdirSyncFn?: typeof mkdirSync;
    chmodSyncFn?: typeof chmodSync;
  },
): void {
  const exists = options?.existsSyncFn ?? existsSync;
  const readFile = options?.readFileSyncFn ?? readFileSync;
  const writeFile = options?.writeFileSyncFn ?? writeFileSync;
  const mkdir = options?.mkdirSyncFn ?? mkdirSync;
  const chmod = options?.chmodSyncFn ?? chmodSync;

  const gitDir = join(workspaceDir, ".git");
  if (!exists(gitDir)) return;

  const hooksDir = join(gitDir, "hooks");
  const hookPath = join(hooksDir, "post-commit");

  // Idempotency: skip if hook already contains /api/rebuild
  if (exists(hookPath)) {
    const existing = readFile(hookPath, "utf-8");
    if (existing.includes("/api/rebuild")) return;
  }

  mkdir(hooksDir, { recursive: true });
  writeFile(hookPath, POST_COMMIT_HOOK_CONTENT);
  chmod(hookPath, 0o755);
}

function spawnAsync(file: string, args: readonly string[], options?: SpawnOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${file} ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

/**
 * Runs workspace setup steps:
 * 1. Clone the repo if workspace is empty and GITHUB_REPO_URL is set
 * 2. Install dependencies if node_modules is missing
 * 3. Build the application (runs the configured build command)
 */
export async function setupWorkspace(options: SetupOptions): Promise<void> {
  const {
    workspaceDir,
    githubRepoUrl,
    githubToken,
    buildCommand = "bun run build",
    execFn = spawnAsync,
    existsSyncFn = existsSync,
    readdirSyncFn = readdirSync,
  } = options;

  const execOpts: SpawnOptions = {
    cwd: workspaceDir,
    stdio: "inherit",
  };

  // Step 1: Clone repo if workspace is empty
  const workspaceHasFiles = hasFiles(workspaceDir, existsSyncFn, readdirSyncFn);

  if (!workspaceHasFiles && githubRepoUrl) {
    let cloneUrl = githubRepoUrl;

    // If a GitHub token is provided, inject it into the URL for authentication
    if (githubToken && cloneUrl.startsWith("https://")) {
      cloneUrl = cloneUrl.replace("https://", `https://x-access-token:${githubToken}@`);
    }

    setPhase("cloning");
    // Remove lost+found (created by ext4 on empty PVCs) so git clone succeeds
    const lostFound = join(workspaceDir, "lost+found");
    if (existsSyncFn(lostFound)) {
      rmSync(lostFound, { recursive: true });
    }
    console.log(`[setup] Cloning ${githubRepoUrl} into ${workspaceDir}...`);
    await execFn("git", ["clone", cloneUrl, "."], execOpts);
    console.log("[setup] Clone complete.");
  } else if (!workspaceHasFiles) {
    console.log("[setup] Workspace is empty and no GITHUB_REPO_URL set, skipping clone.");
  } else {
    console.log("[setup] Workspace already has files, skipping clone.");
  }

  // Ensure .claude/ is gitignored so session data stays out of the repo
  ensureGitignoreEntry(workspaceDir, ".claude/", existsSyncFn);

  // Install git post-commit hook for auto-rebuild and push
  installPostCommitHook(workspaceDir);

  // Step 2: Install dependencies if node_modules is missing
  const nodeModulesPath = join(workspaceDir, "node_modules");
  const hasNodeModules = existsSyncFn(nodeModulesPath);

  if (!hasNodeModules) {
    setPhase("installing");
    console.log("[setup] Installing dependencies with bun...");
    await execFn("bun", ["install"], execOpts);
    console.log("[setup] Install complete.");
  } else {
    console.log("[setup] node_modules exists, skipping install.");
  }

  // Step 3: Build the application
  const buildParts = buildCommand.split(/\s+/);
  setPhase("building");
  console.log(`[setup] Building with: ${buildCommand}...`);
  await execFn(buildParts[0], buildParts.slice(1), execOpts);
  console.log("[setup] Build complete.");
}

function hasFiles(
  dir: string,
  existsSyncFn: typeof existsSync,
  readdirSyncFn: typeof readdirSync,
): boolean {
  if (!existsSyncFn(dir)) return false;
  const entries = readdirSyncFn(dir);
  // Filter out common hidden/system entries that might be on an empty PVC
  return entries.filter((e) => e !== "." && e !== ".." && e !== "lost+found").length > 0;
}
