import type { SpawnOptions } from "node:child_process";
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
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
  /** Inject for testing. Defaults to spawn-based async exec. */
  execFn?: ExecFn;
  /** Inject for testing. Defaults to fs.existsSync. */
  existsSyncFn?: typeof existsSync;
  /** Inject for testing. Defaults to fs.readdirSync. */
  readdirSyncFn?: typeof readdirSync;
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
 */
export async function setupWorkspace(options: SetupOptions): Promise<void> {
  const {
    workspaceDir,
    githubRepoUrl,
    githubToken,
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
    console.log(`[setup] Cloning ${githubRepoUrl} into ${workspaceDir}...`);
    await execFn("git", ["clone", cloneUrl, "."], execOpts);
    console.log("[setup] Clone complete.");
  } else if (!workspaceHasFiles) {
    console.log("[setup] Workspace is empty and no GITHUB_REPO_URL set, skipping clone.");
  } else {
    console.log("[setup] Workspace already has files, skipping clone.");
  }

  // Step 2: Install dependencies if node_modules is missing
  const nodeModulesPath = join(workspaceDir, "node_modules");
  const hasNodeModules = existsSyncFn(nodeModulesPath);

  if (!hasNodeModules) {
    // Detect package manager
    const packageManager = detectPackageManager(workspaceDir, existsSyncFn);
    setPhase("installing");
    console.log(`[setup] Installing dependencies with ${packageManager}...`);
    await execFn(packageManager, ["install"], execOpts);
    console.log("[setup] Install complete.");
  } else {
    console.log("[setup] node_modules exists, skipping install.");
  }
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

function detectPackageManager(dir: string, existsSyncFn: typeof existsSync): string {
  if (existsSyncFn(join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSyncFn(join(dir, "yarn.lock"))) return "yarn";
  return "npm";
}
