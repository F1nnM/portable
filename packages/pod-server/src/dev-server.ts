import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";

export interface DevServerOptions {
  command: string;
  cwd: string;
  port: number;
  /** Inject spawn for testing. Defaults to child_process.spawn. */
  spawnFn?: typeof spawn;
  /** Inject setTimeout for testing. Defaults to globalThis.setTimeout. */
  setTimeoutFn?: typeof setTimeout;
  /** Inject clearTimeout for testing. Defaults to globalThis.clearTimeout. */
  clearTimeoutFn?: typeof clearTimeout;
  /** Seconds the process must run before backoff resets. Default: 10. */
  stableThresholdMs?: number;
  /** Maximum backoff delay in ms. Default: 30000. */
  maxBackoffMs?: number;
}

export class DevServerSupervisor {
  private readonly command: string;
  private readonly args: string[];
  private readonly cwd: string;
  private readonly port: number;
  private readonly spawnFn: typeof spawn;
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private readonly stableThresholdMs: number;
  private readonly maxBackoffMs: number;

  private child: ChildProcess | null = null;
  private running = false;
  private stopping = false;
  private consecutiveCrashes = 0;
  private lastStartTime = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: DevServerOptions) {
    const parts = options.command.split(/\s+/);
    this.command = parts[0];
    this.args = parts.slice(1);
    this.cwd = options.cwd;
    this.port = options.port;
    this.spawnFn = options.spawnFn ?? spawn;
    this.setTimeoutFn = options.setTimeoutFn ?? globalThis.setTimeout.bind(globalThis);
    this.clearTimeoutFn = options.clearTimeoutFn ?? globalThis.clearTimeout.bind(globalThis);
    this.stableThresholdMs = options.stableThresholdMs ?? 10_000;
    this.maxBackoffMs = options.maxBackoffMs ?? 30_000;
  }

  get isRunning(): boolean {
    return this.running && this.child !== null;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.stopping = false;
    this.consecutiveCrashes = 0;
    this.spawn();
  }

  stop(): void {
    this.stopping = true;
    this.running = false;

    if (this.restartTimer !== null) {
      this.clearTimeoutFn(this.restartTimer);
      this.restartTimer = null;
    }

    if (this.child) {
      console.log("[dev-server] Stopping dev server...");
      this.child.kill("SIGTERM");
      this.child = null;
    }
  }

  private spawn(): void {
    if (!this.running || this.stopping) return;

    const env = {
      ...process.env,
      PORT: String(this.port),
    };

    console.log(
      `[dev-server] Starting: ${this.command} ${this.args.join(" ")} (port=${this.port}, cwd=${this.cwd})`,
    );

    this.lastStartTime = Date.now();
    this.child = this.spawnFn(this.command, this.args, {
      cwd: this.cwd,
      env,
      stdio: "inherit",
    });

    this.child.on("error", (err) => {
      console.error(`[dev-server] Failed to start: ${err.message}`);
      this.child = null;
      this.scheduleRestart();
    });

    this.child.on("exit", (code, signal) => {
      this.child = null;

      if (this.stopping) return;

      if (signal) {
        console.log(`[dev-server] Dev server killed by signal ${signal}`);
      } else {
        console.log(`[dev-server] Dev server exited with code ${code}`);
      }

      this.scheduleRestart();
    });
  }

  private scheduleRestart(): void {
    if (!this.running || this.stopping) return;

    const uptime = Date.now() - this.lastStartTime;

    if (uptime >= this.stableThresholdMs) {
      // Process was stable long enough -- reset backoff
      this.consecutiveCrashes = 0;
    } else {
      this.consecutiveCrashes++;
    }

    const delayMs = Math.min(1000 * 2 ** (this.consecutiveCrashes - 1), this.maxBackoffMs);

    // On first crash (consecutiveCrashes=1), delay is 1s.
    // If the process was stable, consecutiveCrashes=0 after reset, so delay would be 0.5s
    // but we clamp to at least 0 (2^-1 = 0.5, but that's fine for immediate restart after stable).
    const effectiveDelay = this.consecutiveCrashes === 0 ? 0 : delayMs;

    if (effectiveDelay > 0) {
      console.log(
        `[dev-server] Restarting in ${effectiveDelay}ms (crash #${this.consecutiveCrashes})`,
      );
    } else {
      console.log("[dev-server] Restarting immediately (was stable)");
    }

    this.restartTimer = this.setTimeoutFn(() => {
      this.restartTimer = null;
      this.spawn();
    }, effectiveDelay);
  }
}
