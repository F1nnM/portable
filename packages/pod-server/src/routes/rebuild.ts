import type { DevServerSupervisor } from "../dev-server.js";
import { Hono } from "hono";
import {
  getBuildState,
  setBuildingState,
  setLastBuildError,
  setLastBuiltCommit,
} from "../build-state.js";
import { spawnAsync as defaultSpawnAsync } from "../spawn-async.js";

export interface RebuildOptions {
  supervisor: DevServerSupervisor;
  workspaceDir: string;
  /** Inject for testing. */
  spawnAsync?: (
    command: string,
    args: string[],
    cwd: string,
  ) => Promise<{ stdout: string; stderr: string }>;
  /** Inject for testing debounce timers. */
  setTimeoutFn?: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
  /** Inject for testing debounce timers. */
  clearTimeoutFn?: (id: ReturnType<typeof setTimeout>) => void;
}

export function rebuild(options: RebuildOptions): Hono {
  const {
    supervisor,
    workspaceDir,
    spawnAsync = defaultSpawnAsync,
    setTimeoutFn = globalThis.setTimeout.bind(globalThis),
    clearTimeoutFn = globalThis.clearTimeout.bind(globalThis),
  } = options;

  const app = new Hono();
  let building = false;
  let pendingRebuild = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function runBuild(): Promise<void> {
    building = true;
    setBuildingState(true);
    try {
      await spawnAsync("bun", ["run", "build"], workspaceDir);
      const { stdout } = await spawnAsync("git", ["rev-parse", "HEAD"], workspaceDir);
      const commit = stdout.trim();
      setLastBuiltCommit(commit);
      setLastBuildError(null);
      supervisor.restart();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Build failed";
      setLastBuildError(message);
      throw err;
    } finally {
      building = false;
      setBuildingState(false);

      if (pendingRebuild) {
        pendingRebuild = false;
        // Fire-and-forget the pending rebuild
        runBuild().catch(() => {
          // Error already stored in build state
        });
      }
    }
  }

  app.post("/api/rebuild", async (c) => {
    const debounceParam = c.req.query("debounce");

    if (debounceParam) {
      const ms = Number.parseInt(debounceParam, 10);

      if (Number.isNaN(ms) || ms < 0) {
        return c.json({ status: "error", message: "Invalid debounce value" }, 400);
      }

      if (debounceTimer !== null) {
        clearTimeoutFn(debounceTimer);
      }

      debounceTimer = setTimeoutFn(() => {
        debounceTimer = null;
        runBuild().catch(() => {
          // Error already stored in build state
        });
      }, ms);

      return c.json({ status: "scheduled" }, 202);
    }

    if (building) {
      pendingRebuild = true;
      return c.json({ status: "queued" }, 202);
    }

    try {
      await runBuild();
      return c.json({ status: "ok" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Build failed";
      return c.json({ status: "error", message }, 500);
    }
  });

  app.get("/api/rebuild/status", async (c) => {
    const state = getBuildState();

    try {
      const { stdout: headOut } = await spawnAsync("git", ["rev-parse", "HEAD"], workspaceDir);
      const currentHead = headOut.trim();

      const { stdout: statusOut } = await spawnAsync(
        "git",
        ["status", "--porcelain"],
        workspaceDir,
      );
      const isDirty = statusOut.trim().length > 0;

      let unbuiltCommitCount: number | null = null;
      if (state.lastBuiltCommit) {
        const { stdout: countOut } = await spawnAsync(
          "git",
          ["rev-list", "--count", `${state.lastBuiltCommit}..HEAD`],
          workspaceDir,
        );
        unbuiltCommitCount = Number.parseInt(countOut.trim(), 10);
      }

      return c.json({
        lastBuiltCommit: state.lastBuiltCommit,
        currentHead,
        isDirty,
        isBuilding: state.isBuilding,
        lastBuildError: state.lastBuildError,
        unbuiltCommitCount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read git status";
      return c.json({ status: "error", message }, 500);
    }
  });

  return app;
}
