import type { DevServerSupervisor } from "../src/dev-server.js";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { rebuild } from "../src/routes/rebuild.js";

function createTestApp(options: {
  supervisor?: Partial<DevServerSupervisor>;
  spawnAsync?: (...args: unknown[]) => Promise<{ stdout: string; stderr: string }>;
}) {
  const app = new Hono();
  const mockSupervisor = {
    restart: vi.fn(),
    ...options.supervisor,
  } as unknown as DevServerSupervisor;

  const mockSpawnAsync =
    options.spawnAsync ?? vi.fn().mockResolvedValue({ stdout: "", stderr: "" });

  app.route(
    "/",
    rebuild({
      supervisor: mockSupervisor,
      workspaceDir: "/workspace",
      spawnAsync: mockSpawnAsync as typeof rebuild extends (opts: infer O) => Hono
        ? O extends { spawnAsync: infer S }
          ? S
          : never
        : never,
    }),
  );

  return { app, mockSupervisor, mockSpawnAsync };
}

describe("rebuild endpoint - POST /api/rebuild", () => {
  it("runs build and restarts supervisor on success", async () => {
    const { app, mockSupervisor, mockSpawnAsync } = createTestApp({});

    const res = await app.request("/api/rebuild", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });

    expect(mockSpawnAsync).toHaveBeenCalledOnce();
    expect(mockSupervisor.restart).toHaveBeenCalledOnce();
  });

  it("returns 500 when build fails", async () => {
    const { app, mockSupervisor } = createTestApp({
      spawnAsync: vi.fn().mockRejectedValue(new Error("Build failed: exit code 1")),
    });

    const res = await app.request("/api/rebuild", { method: "POST" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.message).toContain("Build failed");

    // Should NOT restart on failure
    expect(mockSupervisor.restart).not.toHaveBeenCalled();
  });

  it("rejects concurrent rebuilds", async () => {
    // Create a build that takes time
    let resolveFirst: () => void;
    const firstBuild = new Promise<{ stdout: string; stderr: string }>((resolve) => {
      resolveFirst = () => resolve({ stdout: "", stderr: "" });
    });
    let callCount = 0;
    const mockSpawnAsync = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return firstBuild;
      return Promise.resolve({ stdout: "", stderr: "" });
    });

    const { app } = createTestApp({ spawnAsync: mockSpawnAsync });

    // Start first build
    const first = app.request("/api/rebuild", { method: "POST" });

    // Try second build while first is running
    const second = await app.request("/api/rebuild", { method: "POST" });
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.status).toBe("error");
    expect(body.message).toContain("already in progress");

    // Complete first build
    resolveFirst!();
    const firstRes = await first;
    expect(firstRes.status).toBe(200);
  });
});
