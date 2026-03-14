import type { DevServerSupervisor } from "../src/dev-server.js";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBuildState, resetBuildState } from "../src/build-state.js";
import { rebuild } from "../src/routes/rebuild.js";

function createTestApp(options?: {
  supervisor?: Partial<DevServerSupervisor>;
  spawnAsync?: (
    command: string,
    args: string[],
    cwd: string,
  ) => Promise<{ stdout: string; stderr: string }>;
  setTimeoutFn?: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (id: ReturnType<typeof setTimeout>) => void;
}) {
  const app = new Hono();
  const mockSupervisor = {
    restart: vi.fn(),
    ...options?.supervisor,
  } as unknown as DevServerSupervisor;

  const mockSpawnAsync =
    options?.spawnAsync ?? vi.fn().mockResolvedValue({ stdout: "", stderr: "" });

  const rebuildOptions: Parameters<typeof rebuild>[0] = {
    supervisor: mockSupervisor,
    workspaceDir: "/workspace",
    spawnAsync: mockSpawnAsync,
  };

  if (options?.setTimeoutFn) {
    rebuildOptions.setTimeoutFn = options.setTimeoutFn;
  }
  if (options?.clearTimeoutFn) {
    rebuildOptions.clearTimeoutFn = options.clearTimeoutFn;
  }

  app.route("/", rebuild(rebuildOptions));

  return { app, mockSupervisor, mockSpawnAsync };
}

beforeEach(() => {
  resetBuildState();
});

describe("post /api/rebuild", () => {
  it("runs build and restarts supervisor on success", async () => {
    const { app, mockSupervisor, mockSpawnAsync } = createTestApp({
      spawnAsync: vi.fn().mockImplementation((cmd: string) => {
        if (cmd === "git") {
          return Promise.resolve({ stdout: "abc123\n", stderr: "" });
        }
        return Promise.resolve({ stdout: "", stderr: "" });
      }),
    });

    const res = await app.request("/api/rebuild", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });

    expect(mockSpawnAsync).toHaveBeenCalledWith("bun", ["run", "build"], "/workspace");
    expect(mockSupervisor.restart).toHaveBeenCalledOnce();
  });

  it("returns 500 when build fails", async () => {
    const { app, mockSupervisor } = createTestApp({
      spawnAsync: vi.fn().mockImplementation((cmd: string) => {
        if (cmd === "git") {
          return Promise.resolve({ stdout: "abc123\n", stderr: "" });
        }
        return Promise.reject(new Error("Build failed: exit code 1"));
      }),
    });

    const res = await app.request("/api/rebuild", { method: "POST" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.message).toContain("Build failed");

    expect(mockSupervisor.restart).not.toHaveBeenCalled();
  });

  it("records HEAD commit and clears error on successful build", async () => {
    const { app } = createTestApp({
      spawnAsync: vi.fn().mockImplementation((cmd: string, args: string[]) => {
        if (cmd === "git" && args[0] === "rev-parse") {
          return Promise.resolve({ stdout: "deadbeef123\n", stderr: "" });
        }
        return Promise.resolve({ stdout: "", stderr: "" });
      }),
    });

    await app.request("/api/rebuild", { method: "POST" });

    const state = getBuildState();
    expect(state.lastBuiltCommit).toBe("deadbeef123");
    expect(state.lastBuildError).toBeNull();
    expect(state.isBuilding).toBe(false);
  });

  it("stores error on build failure", async () => {
    const { app } = createTestApp({
      spawnAsync: vi.fn().mockImplementation((cmd: string) => {
        if (cmd === "git") {
          return Promise.resolve({ stdout: "abc123\n", stderr: "" });
        }
        return Promise.reject(new Error("Build failed: exit code 1\nSyntax error"));
      }),
    });

    await app.request("/api/rebuild", { method: "POST" });

    const state = getBuildState();
    expect(state.lastBuildError).toContain("Build failed");
    expect(state.isBuilding).toBe(false);
  });

  it("queues rebuild when build is already in progress", async () => {
    let resolveBuild: () => void;
    const buildPromise = new Promise<{ stdout: string; stderr: string }>((resolve) => {
      resolveBuild = () => resolve({ stdout: "", stderr: "" });
    });

    let callCount = 0;
    const mockSpawnAsync = vi.fn().mockImplementation((cmd: string) => {
      if (cmd === "git") {
        return Promise.resolve({ stdout: "abc123\n", stderr: "" });
      }
      callCount++;
      if (callCount === 1) return buildPromise;
      return Promise.resolve({ stdout: "", stderr: "" });
    });

    const { app } = createTestApp({ spawnAsync: mockSpawnAsync });

    // Start first build
    const first = app.request("/api/rebuild", { method: "POST" });

    // Try second build while first is running -- should be queued
    const second = await app.request("/api/rebuild", { method: "POST" });
    expect(second.status).toBe(202);
    const body = await second.json();
    expect(body.status).toBe("queued");

    // Complete first build
    resolveBuild!();
    const firstRes = await first;
    expect(firstRes.status).toBe(200);

    // Wait for the pending build to complete
    await vi.waitFor(() => {
      const buildCalls = mockSpawnAsync.mock.calls.filter(
        (c: [string, string[], string]) => c[0] === "bun",
      );
      expect(buildCalls.length).toBe(2);
    });
  });

  it("debounced build schedules and returns 202", async () => {
    const timers: { cb: () => void; ms: number; id: number }[] = [];
    let nextId = 1;
    const setTimeoutFn = vi.fn((cb: () => void, ms: number) => {
      const id = nextId++;
      timers.push({ cb, ms, id });
      return id as unknown as ReturnType<typeof setTimeout>;
    });
    const clearTimeoutFn = vi.fn();

    const { app } = createTestApp({
      spawnAsync: vi.fn().mockImplementation((cmd: string) => {
        if (cmd === "git") {
          return Promise.resolve({ stdout: "abc123\n", stderr: "" });
        }
        return Promise.resolve({ stdout: "", stderr: "" });
      }),
      setTimeoutFn,
      clearTimeoutFn,
    });

    const res = await app.request("/api/rebuild?debounce=500", { method: "POST" });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.status).toBe("scheduled");

    expect(setTimeoutFn).toHaveBeenCalledWith(expect.any(Function), 500);
  });

  it("returns 400 for invalid debounce value", async () => {
    const { app } = createTestApp();

    const res = await app.request("/api/rebuild?debounce=abc", { method: "POST" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.message).toContain("Invalid debounce");
  });

  it("returns 400 for negative debounce value", async () => {
    const { app } = createTestApp();

    const res = await app.request("/api/rebuild?debounce=-100", { method: "POST" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe("error");
  });

  it("coalesces multiple debounced calls into a single build", async () => {
    const timers: { cb: () => void; ms: number; id: number }[] = [];
    let nextId = 1;
    const setTimeoutFn = vi.fn((cb: () => void, ms: number) => {
      const id = nextId++;
      timers.push({ cb, ms, id });
      return id as unknown as ReturnType<typeof setTimeout>;
    });
    const clearTimeoutFn = vi.fn();

    const mockSpawnAsync = vi.fn().mockImplementation((cmd: string) => {
      if (cmd === "git") {
        return Promise.resolve({ stdout: "abc123\n", stderr: "" });
      }
      return Promise.resolve({ stdout: "", stderr: "" });
    });

    const { app } = createTestApp({
      spawnAsync: mockSpawnAsync,
      setTimeoutFn,
      clearTimeoutFn,
    });

    // First debounced call
    await app.request("/api/rebuild?debounce=500", { method: "POST" });
    // Second debounced call -- should clear the first timer
    await app.request("/api/rebuild?debounce=500", { method: "POST" });
    // Third debounced call -- should clear the second timer
    await app.request("/api/rebuild?debounce=500", { method: "POST" });

    // Only the last timer should remain active; previous two should be cleared
    expect(clearTimeoutFn).toHaveBeenCalledTimes(2);
    expect(setTimeoutFn).toHaveBeenCalledTimes(3);

    // Fire the last timer
    const lastTimer = timers[timers.length - 1];
    lastTimer.cb();

    // Wait for the build to complete
    await vi.waitFor(() => {
      const buildCalls = mockSpawnAsync.mock.calls.filter(
        (c: [string, string[], string]) => c[0] === "bun",
      );
      expect(buildCalls.length).toBe(1);
    });
  });
});

describe("get /api/rebuild/status", () => {
  it("returns correct status fields when no build has happened", async () => {
    const mockSpawnAsync = vi.fn().mockImplementation((cmd: string, args: string[]) => {
      if (cmd === "git" && args[0] === "rev-parse") {
        return Promise.resolve({ stdout: "currenthead123\n", stderr: "" });
      }
      if (cmd === "git" && args[0] === "status") {
        return Promise.resolve({ stdout: "", stderr: "" });
      }
      return Promise.resolve({ stdout: "", stderr: "" });
    });

    const { app } = createTestApp({ spawnAsync: mockSpawnAsync });

    const res = await app.request("/api/rebuild/status");
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toEqual({
      lastBuiltCommit: null,
      currentHead: "currenthead123",
      isDirty: false,
      isBuilding: false,
      lastBuildError: null,
      unbuiltCommitCount: null,
    });
  });

  it("returns isDirty true when workspace has changes", async () => {
    const mockSpawnAsync = vi.fn().mockImplementation((cmd: string, args: string[]) => {
      if (cmd === "git" && args[0] === "rev-parse") {
        return Promise.resolve({ stdout: "abc123\n", stderr: "" });
      }
      if (cmd === "git" && args[0] === "status") {
        return Promise.resolve({ stdout: " M src/index.ts\n", stderr: "" });
      }
      return Promise.resolve({ stdout: "", stderr: "" });
    });

    const { app } = createTestApp({ spawnAsync: mockSpawnAsync });

    const res = await app.request("/api/rebuild/status");
    const body = await res.json();

    expect(body.isDirty).toBe(true);
  });

  it("returns unbuiltCommitCount when lastBuiltCommit is set", async () => {
    const mockSpawnAsync = vi.fn().mockImplementation((cmd: string, args: string[]) => {
      if (cmd === "git" && args[0] === "rev-parse") {
        return Promise.resolve({ stdout: "currenthead456\n", stderr: "" });
      }
      if (cmd === "git" && args[0] === "status") {
        return Promise.resolve({ stdout: "", stderr: "" });
      }
      if (cmd === "git" && args[0] === "rev-list") {
        return Promise.resolve({ stdout: "3\n", stderr: "" });
      }
      return Promise.resolve({ stdout: "", stderr: "" });
    });

    const { app } = createTestApp({ spawnAsync: mockSpawnAsync });

    // Simulate a previous build
    const { setLastBuiltCommit } = await import("../src/build-state.js");
    setLastBuiltCommit("oldhash789");

    const res = await app.request("/api/rebuild/status");
    const body = await res.json();

    expect(body.lastBuiltCommit).toBe("oldhash789");
    expect(body.currentHead).toBe("currenthead456");
    expect(body.unbuiltCommitCount).toBe(3);

    // Verify the rev-list call was made with the right arguments
    const revListCall = mockSpawnAsync.mock.calls.find(
      (c: [string, string[], string]) => c[0] === "git" && c[1][0] === "rev-list",
    );
    expect(revListCall).toBeDefined();
    expect(revListCall![1]).toEqual(["rev-list", "--count", "oldhash789..HEAD"]);
  });

  it("returns build error from last failed build", async () => {
    const mockSpawnAsync = vi.fn().mockImplementation((cmd: string, args: string[]) => {
      if (cmd === "git" && args[0] === "rev-parse") {
        return Promise.resolve({ stdout: "abc\n", stderr: "" });
      }
      if (cmd === "git" && args[0] === "status") {
        return Promise.resolve({ stdout: "", stderr: "" });
      }
      return Promise.resolve({ stdout: "", stderr: "" });
    });

    const { app } = createTestApp({ spawnAsync: mockSpawnAsync });

    const { setLastBuildError } = await import("../src/build-state.js");
    setLastBuildError("Build failed: syntax error");

    const res = await app.request("/api/rebuild/status");
    const body = await res.json();

    expect(body.lastBuildError).toBe("Build failed: syntax error");
  });

  it("returns 500 when git commands fail", async () => {
    const mockSpawnAsync = vi.fn().mockRejectedValue(new Error("git not found"));

    const { app } = createTestApp({ spawnAsync: mockSpawnAsync });

    const res = await app.request("/api/rebuild/status");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.message).toContain("git not found");
  });
});
