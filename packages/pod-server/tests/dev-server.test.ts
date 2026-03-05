import type { ChildProcess, spawn, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DevServerSupervisor } from "../src/dev-server.js";

/** Creates a mock child process that can emit events */
function createMockChild(): ChildProcess {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    pid: 1234,
    stdin: null,
    stdout: null,
    stderr: null,
    stdio: [null, null, null] as const,
    connected: false,
    exitCode: null,
    signalCode: null,
    spawnargs: [],
    spawnfile: "",
    killed: false,
    kill: vi.fn(() => true),
    send: vi.fn(),
    disconnect: vi.fn(),
    unref: vi.fn(),
    ref: vi.fn(),
    [Symbol.dispose]: vi.fn(),
  }) as unknown as ChildProcess;
}

describe("devServerSupervisor", () => {
  let mockSpawn: ReturnType<typeof vi.fn>;
  let mockChildren: ChildProcess[];
  let pendingTimers: Array<{ callback: () => void; delay: number; id: number }>;
  let timerIdCounter: number;
  let mockSetTimeout: typeof setTimeout;
  let mockClearTimeout: typeof clearTimeout;

  beforeEach(() => {
    mockChildren = [];
    pendingTimers = [];
    timerIdCounter = 0;

    mockSpawn = vi.fn((_cmd: string, _args: string[], _opts: SpawnOptions) => {
      const child = createMockChild();
      mockChildren.push(child);
      return child;
    });

    mockSetTimeout = vi.fn((callback: () => void, delay?: number) => {
      const id = ++timerIdCounter;
      pendingTimers.push({ callback, delay: delay ?? 0, id });
      return id as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout;

    mockClearTimeout = vi.fn((id: ReturnType<typeof setTimeout>) => {
      const idx = pendingTimers.findIndex((t) => t.id === (id as unknown as number));
      if (idx !== -1) pendingTimers.splice(idx, 1);
    }) as unknown as typeof clearTimeout;
  });

  afterEach(() => {
    mockChildren = [];
    pendingTimers = [];
  });

  function createSupervisor(overrides?: Record<string, unknown>) {
    return new DevServerSupervisor({
      command: "pnpm dev",
      cwd: "/workspace",
      port: 3001,
      spawnFn: mockSpawn as unknown as typeof spawn,
      setTimeoutFn: mockSetTimeout,
      clearTimeoutFn: mockClearTimeout,
      stableThresholdMs: 10_000,
      maxBackoffMs: 30_000,
      ...overrides,
    });
  }

  /** Flush one pending timer (the oldest one) */
  function flushNextTimer() {
    const timer = pendingTimers.shift();
    if (timer) timer.callback();
  }

  it("spawns the dev server on start()", () => {
    const supervisor = createSupervisor();
    supervisor.start();

    expect(mockSpawn).toHaveBeenCalledOnce();
    expect(mockSpawn).toHaveBeenCalledWith("pnpm", ["dev"], {
      cwd: "/workspace",
      env: expect.objectContaining({ PORT: "3001" }),
      stdio: "inherit",
    });
    expect(supervisor.isRunning).toBe(true);

    supervisor.stop();
  });

  it("restarts after the child process exits unexpectedly", () => {
    const supervisor = createSupervisor();
    supervisor.start();

    expect(mockSpawn).toHaveBeenCalledTimes(1);

    // Simulate crash
    mockChildren[0].emit("exit", 1, null);

    // A restart timer should be scheduled
    expect(pendingTimers).toHaveLength(1);

    // Flush the timer to trigger restart
    flushNextTimer();

    expect(mockSpawn).toHaveBeenCalledTimes(2);

    supervisor.stop();
  });

  it("applies exponential backoff on repeated crashes", () => {
    const supervisor = createSupervisor();
    supervisor.start();

    // Crash 1 => backoff should be 1000ms (2^0 * 1000)
    mockChildren[0].emit("exit", 1, null);
    expect(pendingTimers).toHaveLength(1);
    expect(pendingTimers[0].delay).toBe(1000);

    // Flush and spawn second process
    flushNextTimer();

    // Crash 2 => backoff should be 2000ms (2^1 * 1000)
    mockChildren[1].emit("exit", 1, null);
    expect(pendingTimers).toHaveLength(1);
    expect(pendingTimers[0].delay).toBe(2000);

    // Flush and spawn third process
    flushNextTimer();

    // Crash 3 => backoff should be 4000ms (2^2 * 1000)
    mockChildren[2].emit("exit", 1, null);
    expect(pendingTimers).toHaveLength(1);
    expect(pendingTimers[0].delay).toBe(4000);

    supervisor.stop();
  });

  it("caps backoff at maxBackoffMs", () => {
    const supervisor = createSupervisor({ maxBackoffMs: 5000 });
    supervisor.start();

    // Simulate many rapid crashes to exceed the cap
    for (let i = 0; i < 10; i++) {
      mockChildren[i].emit("exit", 1, null);
      const delay = pendingTimers[0].delay;
      expect(delay).toBeLessThanOrEqual(5000);
      flushNextTimer();
    }

    supervisor.stop();
  });

  it("resets backoff after stable running", () => {
    let fakeNow = 1000;
    const originalDateNow = Date.now;
    Date.now = () => fakeNow;

    try {
      const supervisor = createSupervisor({ stableThresholdMs: 5000 });

      // start() -> spawn() sets lastStartTime = 1000
      supervisor.start();

      // Quick crash (uptime = 500ms < 5000ms) => consecutive crash #1
      fakeNow = 1500;
      mockChildren[0].emit("exit", 1, null);
      expect(pendingTimers[0].delay).toBe(1000);
      flushNextTimer(); // spawn() sets lastStartTime = 1500

      // Another quick crash (uptime = 500ms) => consecutive crash #2
      fakeNow = 2000;
      mockChildren[1].emit("exit", 1, null);
      expect(pendingTimers[0].delay).toBe(2000);
      flushNextTimer(); // spawn() sets lastStartTime = 2000

      // Process runs stably this time: uptime = 8000ms > stableThresholdMs
      // Backoff should reset, causing delay=0 (immediate restart)
      fakeNow = 10_000;
      mockChildren[2].emit("exit", 1, null);
      expect(pendingTimers[0].delay).toBe(0);

      supervisor.stop();
    } finally {
      Date.now = originalDateNow;
    }
  });

  it("stop() kills the child process", () => {
    const supervisor = createSupervisor();
    supervisor.start();

    expect(mockChildren).toHaveLength(1);
    const child = mockChildren[0];

    supervisor.stop();

    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(supervisor.isRunning).toBe(false);
  });

  it("stop() cancels pending restart timer", () => {
    const supervisor = createSupervisor();
    supervisor.start();

    // Simulate crash
    mockChildren[0].emit("exit", 1, null);
    expect(pendingTimers).toHaveLength(1);

    // Stop should clear the timer
    supervisor.stop();
    expect(mockClearTimeout).toHaveBeenCalled();
    expect(supervisor.isRunning).toBe(false);
  });

  it("does not restart after stop()", () => {
    const supervisor = createSupervisor();
    supervisor.start();

    supervisor.stop();

    // Simulate exit after stop
    mockChildren[0].emit("exit", 0, null);

    // No restart timer should be scheduled
    expect(pendingTimers).toHaveLength(0);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  it("start() is idempotent when already running", () => {
    const supervisor = createSupervisor();
    supervisor.start();
    supervisor.start(); // second call should be a no-op

    expect(mockSpawn).toHaveBeenCalledTimes(1);

    supervisor.stop();
  });

  it("handles spawn error event", () => {
    const supervisor = createSupervisor();
    supervisor.start();

    // Simulate spawn error (e.g., command not found)
    mockChildren[0].emit("error", new Error("ENOENT"));

    // Should schedule a restart
    expect(pendingTimers).toHaveLength(1);

    supervisor.stop();
  });

  it("passes port via env var", () => {
    const supervisor = createSupervisor({ port: 4000 });
    supervisor.start();

    expect(mockSpawn).toHaveBeenCalledWith(
      "pnpm",
      ["dev"],
      expect.objectContaining({
        env: expect.objectContaining({ PORT: "4000" }),
      }),
    );

    supervisor.stop();
  });

  it("splits multi-word command into command and args", () => {
    const supervisor = createSupervisor({ command: "npm run dev -- --host" });
    supervisor.start();

    expect(mockSpawn).toHaveBeenCalledWith(
      "npm",
      ["run", "dev", "--", "--host"],
      expect.anything(),
    );

    supervisor.stop();
  });
});
