import type { SpawnOptions } from "node:child_process";
import type { DevServerSupervisor } from "../dev-server.js";
import { spawn } from "node:child_process";
import { Hono } from "hono";

function defaultSpawnAsync(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, { cwd } satisfies SpawnOptions);
    child.stdout?.on("data", (d) => (stdout += String(d)));
    child.stderr?.on("data", (d) => (stderr += String(d)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Build failed: exit code ${code}\n${stderr}`));
      }
    });
  });
}

export interface RebuildOptions {
  supervisor: DevServerSupervisor;
  workspaceDir: string;
  /** Inject for testing. */
  spawnAsync?: (
    command: string,
    args: string[],
    cwd: string,
  ) => Promise<{ stdout: string; stderr: string }>;
}

export function rebuild(options: RebuildOptions): Hono {
  const { supervisor, workspaceDir, spawnAsync = defaultSpawnAsync } = options;
  const app = new Hono();
  let building = false;

  app.post("/api/rebuild", async (c) => {
    if (building) {
      return c.json({ status: "error", message: "Build already in progress" }, 409);
    }

    building = true;
    try {
      await spawnAsync("bun", ["run", "build"], workspaceDir);
      supervisor.restart();
      return c.json({ status: "ok" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Build failed";
      return c.json({ status: "error", message }, 500);
    } finally {
      building = false;
    }
  });

  return app;
}
