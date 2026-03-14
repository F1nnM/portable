import type { SpawnAsyncFn } from "./spawn-async.js";
import { setLastBuiltCommit } from "./build-state.js";
import { spawnAsync as defaultSpawnAsync } from "./spawn-async.js";

export interface RecordInitialCommitOptions {
  workspaceDir: string;
  /** Inject for testing. */
  spawnAsync?: SpawnAsyncFn;
}

/**
 * Records the current HEAD commit as the initial "last built" commit.
 * Called after workspace setup (which includes a build step) completes.
 * If the workspace is not a git repo, this silently does nothing.
 */
export async function recordInitialBuiltCommit(options: RecordInitialCommitOptions): Promise<void> {
  const { workspaceDir, spawnAsync = defaultSpawnAsync } = options;

  try {
    const { stdout } = await spawnAsync("git", ["rev-parse", "HEAD"], workspaceDir);
    setLastBuiltCommit(stdout.trim());
  } catch {
    // Not a git repo or git not available -- silently skip
    console.warn("[startup] Could not record initial built commit:", "git rev-parse HEAD failed");
  }
}
