import type { SpawnOptions } from "node:child_process";
import { spawn } from "node:child_process";

export type SpawnAsyncFn = (
  command: string,
  args: string[],
  cwd: string,
) => Promise<{ stdout: string; stderr: string }>;

/**
 * Spawn a child process and capture its stdout/stderr.
 * Resolves with { stdout, stderr } on exit code 0, rejects otherwise.
 */
export function spawnAsync(
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
        reject(new Error(`${command} ${args.join(" ")} failed: exit code ${code}\n${stderr}`));
      }
    });
  });
}
