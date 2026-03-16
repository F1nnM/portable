# Configurable Pod Operations via .portable.yaml -- Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded bun commands and port 3001 with scaffold-defined `prepare`, `serve`, and `frontendPort` in `.portable.yaml`.

**Architecture:** The pod server reads `.portable.yaml` from the workspace after clone. It uses `prepare` for one-time setup, `serve` for the long-running supervisor command, and `frontendPort` for the PORT env var. The main app learns `frontendPort` via the pod health endpoint and caches it in memory for preview proxy routing.

**Tech Stack:** TypeScript, Hono, Vitest, Nuxt 3, `yaml` npm package for YAML parsing

---

## Phase 1: Pod Server Config and State

### Task 1: Install `yaml` package and create portable config reader module

**Files:**

- Modify: `packages/pod-server/package.json` (add `yaml` dependency)
- Modify: `packages/app/package.json` (add `yaml` dependency)
- Create: `packages/pod-server/src/portable-config.ts`
- Create: `packages/pod-server/tests/portable-config.test.ts`

**Step 1: Install the `yaml` package in both packages**

```bash
cd packages/pod-server && bun add yaml
cd ../app && bun add yaml
```

**Step 2: Write the failing tests**

```typescript
// packages/pod-server/tests/portable-config.test.ts
import { rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readPortableConfig } from "../src/portable-config.js";

describe("readPortableConfig", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("reads all fields from .portable.yaml", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "portable-config-"));
    writeFileSync(
      path.join(tempDir, ".portable.yaml"),
      "prepare: bun install\nserve: bun install && bun run build && bun run preview\nfrontendPort: 3000\n",
    );

    const config = readPortableConfig(tempDir);
    expect(config).toEqual({
      prepare: "bun install",
      serve: "bun install && bun run build && bun run preview",
      frontendPort: 3000,
    });
  });

  it("returns empty config when file is missing", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "portable-config-"));

    const config = readPortableConfig(tempDir);
    expect(config).toEqual({});
  });

  it("returns partial config when some fields are missing", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "portable-config-"));
    writeFileSync(path.join(tempDir, ".portable.yaml"), "prepare: npm install\n");

    const config = readPortableConfig(tempDir);
    expect(config).toEqual({ prepare: "npm install" });
  });

  it("ignores scaffold section and unknown keys", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "portable-config-"));
    writeFileSync(
      path.join(tempDir, ".portable.yaml"),
      "prepare: bun install\nserve: bun run preview\nfrontendPort: 8080\nscaffold:\n  repo: https://github.com/user/repo\n  path: scaffolds/nuxt\n  version: abc123\n",
    );

    const config = readPortableConfig(tempDir);
    expect(config).toEqual({
      prepare: "bun install",
      serve: "bun run preview",
      frontendPort: 8080,
    });
  });

  it("handles frontendPort as number from YAML", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "portable-config-"));
    writeFileSync(path.join(tempDir, ".portable.yaml"), "frontendPort: 3001\n");

    const config = readPortableConfig(tempDir);
    expect(config).toEqual({ frontendPort: 3001 });
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `cd packages/pod-server && npx vitest run tests/portable-config.test.ts`
Expected: FAIL -- module `../src/portable-config.js` not found

**Step 4: Write minimal implementation**

```typescript
// packages/pod-server/src/portable-config.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export interface PortableConfig {
  prepare?: string;
  serve?: string;
  frontendPort?: number;
}

/**
 * Reads and parses .portable.yaml from the workspace directory.
 * Returns an empty object if the file is missing or unparseable.
 * Only extracts known operational fields (prepare, serve, frontendPort).
 */
export function readPortableConfig(workspaceDir: string): PortableConfig {
  const filePath = join(workspaceDir, ".portable.yaml");
  if (!existsSync(filePath)) return {};

  try {
    const content = readFileSync(filePath, "utf-8");
    const parsed = parse(content);
    if (!parsed || typeof parsed !== "object") return {};

    const config: PortableConfig = {};
    if (typeof parsed.prepare === "string") config.prepare = parsed.prepare;
    if (typeof parsed.serve === "string") config.serve = parsed.serve;
    if (typeof parsed.frontendPort === "number") config.frontendPort = parsed.frontendPort;
    return config;
  } catch {
    return {};
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `cd packages/pod-server && npx vitest run tests/portable-config.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/pod-server/src/portable-config.ts packages/pod-server/tests/portable-config.test.ts packages/pod-server/package.json packages/app/package.json bun.lock
git commit -m "Add portable config reader using yaml package"
```

---

### Task 2: Rename build-state to serve-state

**Files:**

- Modify: `packages/pod-server/src/build-state.ts` -> rename to `packages/pod-server/src/serve-state.ts`
- Modify: `packages/pod-server/tests/build-state.test.ts` -> rename to `packages/pod-server/tests/serve-state.test.ts`
- Modify: `packages/pod-server/src/routes/rebuild.ts` (update imports)
- Modify: `packages/pod-server/tests/rebuild.test.ts` (update imports)
- Delete: `packages/pod-server/src/record-initial-commit.ts`
- Delete: `packages/pod-server/tests/record-initial-commit.test.ts`

**Step 1: Write the updated serve-state tests**

Rename the file and update the interface to use serve-oriented naming:

```typescript
// packages/pod-server/tests/serve-state.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  getServeState,
  resetServeState,
  setIsRestarting,
  setLastServeCommit,
  setLastServeError,
} from "../src/serve-state.js";

describe("serve-state", () => {
  beforeEach(() => {
    resetServeState();
  });

  it("has correct initial state", () => {
    const state = getServeState();
    expect(state).toEqual({
      lastServeCommit: null,
      isRestarting: false,
      lastServeError: null,
    });
  });

  it("setLastServeCommit updates lastServeCommit", () => {
    setLastServeCommit("abc123");
    expect(getServeState().lastServeCommit).toBe("abc123");
  });

  it("setIsRestarting updates isRestarting", () => {
    setIsRestarting(true);
    expect(getServeState().isRestarting).toBe(true);

    setIsRestarting(false);
    expect(getServeState().isRestarting).toBe(false);
  });

  it("setLastServeError updates lastServeError", () => {
    setLastServeError("something went wrong");
    expect(getServeState().lastServeError).toBe("something went wrong");

    setLastServeError(null);
    expect(getServeState().lastServeError).toBeNull();
  });

  it("resetServeState returns all values to initial state", () => {
    setLastServeCommit("def456");
    setIsRestarting(true);
    setLastServeError("error");

    resetServeState();

    expect(getServeState()).toEqual({
      lastServeCommit: null,
      isRestarting: false,
      lastServeError: null,
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/pod-server && npx vitest run tests/serve-state.test.ts`
Expected: FAIL -- module not found

**Step 3: Write the serve-state module**

```typescript
// packages/pod-server/src/serve-state.ts
export interface ServeState {
  lastServeCommit: string | null;
  isRestarting: boolean;
  lastServeError: string | null;
}

let lastServeCommit: string | null = null;
let isRestarting = false;
let lastServeError: string | null = null;

export function getServeState(): ServeState {
  return { lastServeCommit, isRestarting, lastServeError };
}

export function setLastServeCommit(commit: string): void {
  lastServeCommit = commit;
}

export function setIsRestarting(restarting: boolean): void {
  isRestarting = restarting;
}

export function setLastServeError(error: string | null): void {
  lastServeError = error;
}

export function resetServeState(): void {
  lastServeCommit = null;
  isRestarting = false;
  lastServeError = null;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/pod-server && npx vitest run tests/serve-state.test.ts`
Expected: PASS

**Step 5: Delete old files**

Delete `packages/pod-server/src/build-state.ts`, `packages/pod-server/tests/build-state.test.ts`, `packages/pod-server/src/record-initial-commit.ts`, `packages/pod-server/tests/record-initial-commit.test.ts`.

**Step 6: Commit**

```bash
git add -A packages/pod-server/src/serve-state.ts packages/pod-server/tests/serve-state.test.ts
git rm packages/pod-server/src/build-state.ts packages/pod-server/tests/build-state.test.ts
git rm packages/pod-server/src/record-initial-commit.ts packages/pod-server/tests/record-initial-commit.test.ts
git commit -m "Replace build-state with serve-state, remove record-initial-commit"
```

---

### Task 3: Update setup-state phases

**Files:**

- Modify: `packages/pod-server/src/setup-state.ts`

**Step 1: Update the SetupPhase type**

Change from `"initializing" | "cloning" | "installing" | "building" | "starting_server" | "ready"` to `"initializing" | "cloning" | "preparing" | "serving" | "ready"`.

```typescript
// packages/pod-server/src/setup-state.ts
export type SetupPhase = "initializing" | "cloning" | "preparing" | "serving" | "ready";

let phase: SetupPhase = "initializing";

export function getPhase(): SetupPhase {
  return phase;
}

export function setPhase(newPhase: SetupPhase): void {
  phase = newPhase;
}
```

**Step 2: Run all pod-server tests to verify nothing breaks from the type change**

Run: `cd packages/pod-server && npx vitest run`
Expected: Compilation errors in setup.ts (uses old phase names) -- this is expected and will be fixed in Task 4.

**Step 3: Commit**

```bash
git add packages/pod-server/src/setup-state.ts
git commit -m "Update setup phases to preparing/serving"
```

---

### Task 4: Rewrite setup.ts to use portable config

**Files:**

- Modify: `packages/pod-server/src/setup.ts`
- Modify: `packages/pod-server/tests/setup.test.ts`

The setup function must be rewritten to:

1. Clone (unchanged)
2. Read `.portable.yaml` from workspace
3. Run `prepare` command if defined (replacing hardcoded `bun install`)
4. Remove the hardcoded build step entirely (serve handles it now)
5. Return the parsed config so index.ts can use it for the supervisor

**Step 1: Rewrite setup tests**

Update the tests to reflect the new behavior. The key changes:

- No more `bun install` or `bun run build` calls -- setup runs the `prepare` command from config
- `setupWorkspace` returns the parsed `PortableConfig`
- Tests should create `.portable.yaml` in the workspace to test config-driven behavior

```typescript
// packages/pod-server/tests/setup.test.ts
import type { existsSync, readdirSync } from "node:fs";
import type { ExecFn } from "../src/setup.js";
import type { PortableConfig } from "../src/portable-config.js";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installPostCommitHook, setupWorkspace } from "../src/setup.js";

function createMocks(options: { files?: string[] }) {
  const { files = [] } = options;

  const mockExecFn = vi.fn().mockResolvedValue(undefined);

  const mockExistsSync = vi.fn((p: string) => {
    if (p === "/workspace") return files.length > 0;
    return false;
  });

  const mockReaddirSync = vi.fn((_p: string) => files);

  return { mockExecFn, mockExistsSync, mockReaddirSync };
}

describe("setupWorkspace", () => {
  it("clones repo when workspace is empty and GITHUB_REPO_URL is set", async () => {
    const { mockExecFn, mockExistsSync, mockReaddirSync } = createMocks({ files: [] });
    mockExistsSync.mockImplementation((p: string) => {
      if (p === "/workspace") return false;
      return false;
    });

    await setupWorkspace({
      workspaceDir: "/workspace",
      githubRepoUrl: "https://github.com/user/repo.git",
      execFn: mockExecFn as unknown as ExecFn,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    expect(mockExecFn).toHaveBeenCalledWith(
      "git",
      ["clone", "https://github.com/user/repo.git", "."],
      expect.objectContaining({ cwd: "/workspace" }),
    );
  });

  it("injects GitHub token into clone URL when provided", async () => {
    const { mockExecFn, mockExistsSync, mockReaddirSync } = createMocks({ files: [] });
    mockExistsSync.mockImplementation(() => false);

    await setupWorkspace({
      workspaceDir: "/workspace",
      githubRepoUrl: "https://github.com/user/repo.git",
      githubToken: "ghp_test123",
      execFn: mockExecFn as unknown as ExecFn,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    expect(mockExecFn).toHaveBeenCalledWith(
      "git",
      ["clone", "https://x-access-token:ghp_test123@github.com/user/repo.git", "."],
      expect.objectContaining({ cwd: "/workspace" }),
    );
  });

  it("skips clone when workspace already has files", async () => {
    const { mockExecFn, mockExistsSync, mockReaddirSync } = createMocks({
      files: ["package.json", "src"],
    });
    mockExistsSync.mockImplementation((p: string) => {
      if (p === "/workspace") return true;
      return false;
    });

    await setupWorkspace({
      workspaceDir: "/workspace",
      githubRepoUrl: "https://github.com/user/repo.git",
      execFn: mockExecFn as unknown as ExecFn,
      existsSyncFn: mockExistsSync as unknown as typeof existsSync,
      readdirSyncFn: mockReaddirSync as unknown as typeof readdirSync,
    });

    const cloneCalls = mockExecFn.mock.calls.filter((call: unknown[]) => call[0] === "git");
    expect(cloneCalls).toHaveLength(0);
  });

  it("runs prepare command from config", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "setup-prepare-"));
    try {
      writeFileSync(path.join(tempDir, "package.json"), "{}");
      writeFileSync(
        path.join(tempDir, ".portable.yaml"),
        "prepare: bun install\nserve: bun run preview\nfrontendPort: 3000\n",
      );

      const mockExecFn = vi.fn().mockResolvedValue(undefined);

      const config = await setupWorkspace({
        workspaceDir: tempDir,
        execFn: mockExecFn as unknown as ExecFn,
      });

      expect(mockExecFn).toHaveBeenCalledWith(
        "bun",
        ["install"],
        expect.objectContaining({ cwd: tempDir }),
      );
      expect(config).toEqual({
        prepare: "bun install",
        serve: "bun run preview",
        frontendPort: 3000,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("skips prepare when config has no prepare field", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "setup-no-prepare-"));
    try {
      writeFileSync(path.join(tempDir, "package.json"), "{}");
      writeFileSync(
        path.join(tempDir, ".portable.yaml"),
        "serve: bun run preview\nfrontendPort: 3000\n",
      );

      const mockExecFn = vi.fn().mockResolvedValue(undefined);

      await setupWorkspace({
        workspaceDir: tempDir,
        execFn: mockExecFn as unknown as ExecFn,
      });

      expect(mockExecFn).not.toHaveBeenCalled();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("skips prepare when no .portable.yaml exists", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "setup-no-yaml-"));
    try {
      writeFileSync(path.join(tempDir, "package.json"), "{}");

      const mockExecFn = vi.fn().mockResolvedValue(undefined);

      const config = await setupWorkspace({
        workspaceDir: tempDir,
        execFn: mockExecFn as unknown as ExecFn,
      });

      expect(mockExecFn).not.toHaveBeenCalled();
      expect(config).toEqual({});
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns parsed portable config", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "setup-config-"));
    try {
      writeFileSync(path.join(tempDir, "package.json"), "{}");
      writeFileSync(
        path.join(tempDir, ".portable.yaml"),
        "prepare: npm install\nserve: npm run build && npm start\nfrontendPort: 8080\n",
      );

      const mockExecFn = vi.fn().mockResolvedValue(undefined);

      const config = await setupWorkspace({
        workspaceDir: tempDir,
        execFn: mockExecFn as unknown as ExecFn,
      });

      expect(config).toEqual({
        prepare: "npm install",
        serve: "npm run build && npm start",
        frontendPort: 8080,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // Keep existing gitignore and post-commit hook tests (unchanged)
  // ...
});

// Keep installPostCommitHook tests (unchanged)
```

Note: The existing `installPostCommitHook` tests and `.gitignore` tests remain unchanged. Only the setup flow tests change.

**Step 2: Run tests to verify they fail**

Run: `cd packages/pod-server && npx vitest run tests/setup.test.ts`
Expected: FAIL -- setup no longer has buildCommand, no longer calls bun install/build by default

**Step 3: Rewrite setup.ts**

The key changes:

- Remove `buildCommand` option
- Remove hardcoded `bun install` and `bun run build` steps
- Read `.portable.yaml` after clone
- Run `prepare` command if defined in config
- Return `PortableConfig`

```typescript
// packages/pod-server/src/setup.ts
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
import type { PortableConfig } from "./portable-config.js";
import { readPortableConfig } from "./portable-config.js";
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

// ... ensureGitignoreEntry, POST_COMMIT_HOOK_CONTENT, installPostCommitHook, spawnAsync, hasFiles unchanged ...

/**
 * Runs workspace setup steps:
 * 1. Clone the repo if workspace is empty and GITHUB_REPO_URL is set
 * 2. Read .portable.yaml from workspace
 * 3. Run prepare command if defined in config
 *
 * Returns the parsed PortableConfig.
 */
export async function setupWorkspace(options: SetupOptions): Promise<PortableConfig> {
  const {
    workspaceDir,
    githubRepoUrl,
    githubToken,
    execFn = spawnAsync,
    existsSyncFn = existsSync,
    readdirSyncFn = readdirSync,
  } = options;

  const execOpts: SpawnOptions = { cwd: workspaceDir, stdio: "inherit" };

  // Step 1: Clone repo if workspace is empty
  const workspaceHasFiles = hasFiles(workspaceDir, existsSyncFn, readdirSyncFn);

  if (!workspaceHasFiles && githubRepoUrl) {
    let cloneUrl = githubRepoUrl;
    if (githubToken && cloneUrl.startsWith("https://")) {
      cloneUrl = cloneUrl.replace("https://", `https://x-access-token:${githubToken}@`);
    }
    setPhase("cloning");
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

  // Ensure .claude/ is gitignored
  ensureGitignoreEntry(workspaceDir, ".claude/", existsSyncFn);

  // Install git post-commit hook
  installPostCommitHook(workspaceDir, { existsSyncFn });

  // Step 2: Read .portable.yaml
  const config = readPortableConfig(workspaceDir);

  // Step 3: Run prepare command if defined
  if (config.prepare) {
    setPhase("preparing");
    const parts = config.prepare.split(/\s+/);
    console.log(`[setup] Running prepare: ${config.prepare}...`);
    await execFn(parts[0], parts.slice(1), execOpts);
    console.log("[setup] Prepare complete.");
  }

  return config;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/pod-server && npx vitest run tests/setup.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/pod-server/src/setup.ts packages/pod-server/tests/setup.test.ts
git commit -m "Rewrite setup to use portable config instead of hardcoded commands"
```

---

### Task 5: Rewrite rebuild route to restart serve

**Files:**

- Modify: `packages/pod-server/src/routes/rebuild.ts`
- Modify: `packages/pod-server/tests/rebuild.test.ts`

The rebuild endpoint no longer runs `bun run build`. It just tells the supervisor to restart (which re-runs the serve command). Build state tracking uses serve-state.

**Step 1: Rewrite rebuild tests**

```typescript
// packages/pod-server/tests/rebuild.test.ts
import type { DevServerSupervisor } from "../src/dev-server.js";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServeState, resetServeState } from "../src/serve-state.js";
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

  if (options?.setTimeoutFn) rebuildOptions.setTimeoutFn = options.setTimeoutFn;
  if (options?.clearTimeoutFn) rebuildOptions.clearTimeoutFn = options.clearTimeoutFn;

  app.route("/", rebuild(rebuildOptions));

  return { app, mockSupervisor, mockSpawnAsync };
}

beforeEach(() => {
  resetServeState();
});

describe("post /api/rebuild", () => {
  it("restarts supervisor and records commit on success", async () => {
    const { app, mockSupervisor, mockSpawnAsync } = createTestApp({
      spawnAsync: vi.fn().mockResolvedValue({ stdout: "abc123\n", stderr: "" }),
    });

    const res = await app.request("/api/rebuild", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });

    // Should NOT call bun run build -- just restart
    const bunCalls = mockSpawnAsync.mock.calls.filter(
      (c: [string, string[], string]) => c[0] === "bun",
    );
    expect(bunCalls).toHaveLength(0);

    expect(mockSupervisor.restart).toHaveBeenCalledOnce();
    expect(getServeState().lastServeCommit).toBe("abc123");
  });

  it("stores error when git rev-parse fails", async () => {
    const { app, mockSupervisor } = createTestApp({
      spawnAsync: vi.fn().mockRejectedValue(new Error("git not found")),
    });

    const res = await app.request("/api/rebuild", { method: "POST" });
    expect(res.status).toBe(500);

    expect(mockSupervisor.restart).not.toHaveBeenCalled();
    expect(getServeState().lastServeError).toContain("git not found");
  });

  it("debounced rebuild schedules and returns 202", async () => {
    const timers: { cb: () => void; ms: number; id: number }[] = [];
    let nextId = 1;
    const setTimeoutFn = vi.fn((cb: () => void, ms: number) => {
      const id = nextId++;
      timers.push({ cb, ms, id });
      return id as unknown as ReturnType<typeof setTimeout>;
    });
    const clearTimeoutFn = vi.fn();

    const { app } = createTestApp({
      spawnAsync: vi.fn().mockResolvedValue({ stdout: "abc123\n", stderr: "" }),
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
  });

  it("coalesces multiple debounced calls", async () => {
    const timers: { cb: () => void; ms: number; id: number }[] = [];
    let nextId = 1;
    const setTimeoutFn = vi.fn((cb: () => void, ms: number) => {
      const id = nextId++;
      timers.push({ cb, ms, id });
      return id as unknown as ReturnType<typeof setTimeout>;
    });
    const clearTimeoutFn = vi.fn();

    const { app } = createTestApp({
      spawnAsync: vi.fn().mockResolvedValue({ stdout: "abc\n", stderr: "" }),
      setTimeoutFn,
      clearTimeoutFn,
    });

    await app.request("/api/rebuild?debounce=500", { method: "POST" });
    await app.request("/api/rebuild?debounce=500", { method: "POST" });
    await app.request("/api/rebuild?debounce=500", { method: "POST" });

    expect(clearTimeoutFn).toHaveBeenCalledTimes(2);
    expect(setTimeoutFn).toHaveBeenCalledTimes(3);
  });
});

describe("get /api/rebuild/status", () => {
  it("returns correct status fields", async () => {
    const { app } = createTestApp({
      spawnAsync: vi.fn().mockImplementation((_cmd: string, args: string[]) => {
        if (args[0] === "rev-parse") return Promise.resolve({ stdout: "head123\n", stderr: "" });
        if (args[0] === "status") return Promise.resolve({ stdout: "", stderr: "" });
        return Promise.resolve({ stdout: "", stderr: "" });
      }),
    });

    const res = await app.request("/api/rebuild/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      lastServeCommit: null,
      currentHead: "head123",
      isDirty: false,
      isRestarting: false,
      lastServeError: null,
      unbuiltCommitCount: null,
    });
  });

  it("returns unbuiltCommitCount when lastServeCommit is set", async () => {
    const { app } = createTestApp({
      spawnAsync: vi.fn().mockImplementation((_cmd: string, args: string[]) => {
        if (args[0] === "rev-parse") return Promise.resolve({ stdout: "head456\n", stderr: "" });
        if (args[0] === "status") return Promise.resolve({ stdout: "", stderr: "" });
        if (args[0] === "rev-list") return Promise.resolve({ stdout: "3\n", stderr: "" });
        return Promise.resolve({ stdout: "", stderr: "" });
      }),
    });

    const { setLastServeCommit } = await import("../src/serve-state.js");
    setLastServeCommit("oldhash");

    const res = await app.request("/api/rebuild/status");
    const body = await res.json();
    expect(body.lastServeCommit).toBe("oldhash");
    expect(body.unbuiltCommitCount).toBe(3);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/pod-server && npx vitest run tests/rebuild.test.ts`
Expected: FAIL

**Step 3: Rewrite rebuild.ts**

```typescript
// packages/pod-server/src/routes/rebuild.ts
import type { DevServerSupervisor } from "../dev-server.js";
import { Hono } from "hono";
import {
  getServeState,
  setIsRestarting,
  setLastServeCommit,
  setLastServeError,
} from "../serve-state.js";
import { spawnAsync as defaultSpawnAsync } from "../spawn-async.js";

export interface RebuildOptions {
  supervisor: DevServerSupervisor;
  workspaceDir: string;
  spawnAsync?: (
    command: string,
    args: string[],
    cwd: string,
  ) => Promise<{ stdout: string; stderr: string }>;
  setTimeoutFn?: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
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
  let restarting = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function restartServe(): Promise<void> {
    restarting = true;
    setIsRestarting(true);
    try {
      const { stdout } = await spawnAsync("git", ["rev-parse", "HEAD"], workspaceDir);
      const commit = stdout.trim();
      setLastServeCommit(commit);
      setLastServeError(null);
      supervisor.restart();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Restart failed";
      setLastServeError(message);
      throw err;
    } finally {
      restarting = false;
      setIsRestarting(false);
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
        restartServe().catch(() => {});
      }, ms);
      return c.json({ status: "scheduled" }, 202);
    }

    if (restarting) {
      return c.json({ status: "queued" }, 202);
    }

    try {
      await restartServe();
      return c.json({ status: "ok" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Restart failed";
      return c.json({ status: "error", message }, 500);
    }
  });

  app.get("/api/rebuild/status", async (c) => {
    const state = getServeState();

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
      if (state.lastServeCommit) {
        const { stdout: countOut } = await spawnAsync(
          "git",
          ["rev-list", "--count", `${state.lastServeCommit}..HEAD`],
          workspaceDir,
        );
        unbuiltCommitCount = Number.parseInt(countOut.trim(), 10);
      }

      return c.json({
        lastServeCommit: state.lastServeCommit,
        currentHead,
        isDirty,
        isRestarting: state.isRestarting,
        lastServeError: state.lastServeError,
        unbuiltCommitCount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read git status";
      return c.json({ status: "error", message }, 500);
    }
  });

  return app;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/pod-server && npx vitest run tests/rebuild.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/pod-server/src/routes/rebuild.ts packages/pod-server/tests/rebuild.test.ts
git commit -m "Rewrite rebuild to restart serve instead of running separate build"
```

---

### Task 6: Update health endpoint to expose config

**Files:**

- Modify: `packages/pod-server/src/routes/health.ts`
- Modify: `packages/pod-server/tests/smoke.test.ts` (if health tests exist there)

**Step 1: Update health.ts**

The health endpoint needs access to the portable config. Since the config is read after clone (async), store it in module-level state similar to setup-state.

Add config storage to `portable-config.ts`:

```typescript
// Add to packages/pod-server/src/portable-config.ts
let currentConfig: PortableConfig = {};

export function setCurrentConfig(config: PortableConfig): void {
  currentConfig = config;
}

export function getCurrentConfig(): PortableConfig {
  return currentConfig;
}
```

Update health.ts to include config in response:

```typescript
// packages/pod-server/src/routes/health.ts
import { Hono } from "hono";
import { getCurrentConfig } from "../portable-config.js";
import { getPhase } from "../setup-state.js";

const health = new Hono();

health.get("/health", (c) => {
  const phase = getPhase();
  const config = getCurrentConfig();
  const configResponse: Record<string, unknown> = {};
  if (config.frontendPort !== undefined) {
    configResponse.frontendPort = config.frontendPort;
  }

  if (phase === "ready") {
    return c.json({ status: "ok", phase: "ready", config: configResponse }, 200);
  }
  return c.json({ status: "setting_up", phase, config: configResponse }, 503);
});

export { health };
```

**Step 2: Write a test for the config in health response**

Add to the smoke test or create a health test that verifies the config field is present.

**Step 3: Run tests**

Run: `cd packages/pod-server && npx vitest run`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/pod-server/src/routes/health.ts packages/pod-server/src/portable-config.ts
git commit -m "Expose portable config in health endpoint response"
```

---

### Task 7: Update index.ts to wire everything together

**Files:**

- Modify: `packages/pod-server/src/index.ts`

The entrypoint must:

1. Remove hardcoded `DevServerSupervisor` creation before setup
2. Run `setupWorkspace` which returns the config
3. Create `DevServerSupervisor` from config (if `serve` is defined)
4. Store config via `setCurrentConfig` for the health endpoint
5. Record initial serve commit via serve-state

```typescript
// packages/pod-server/src/index.ts
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { createApp } from "./app.js";
import { DevServerSupervisor } from "./dev-server.js";
import { setCurrentConfig } from "./portable-config.js";
import { setLastServeCommit } from "./serve-state.js";
import { setPhase } from "./setup-state.js";
import { setupWorkspace } from "./setup.js";
import { spawnAsync } from "./spawn-async.js";

const port = Number.parseInt(process.env.PORT || "3000", 10);
const workspaceDir = process.env.WORKSPACE_DIR || "/workspace";

// Create app without supervisor initially -- it will be set after setup
let supervisor: DevServerSupervisor | undefined;

const { app, registerWsRoute } = createApp({ workspaceDir });
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
registerWsRoute(upgradeWebSocket);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Pod server listening on port ${info.port}`);
});

injectWebSocket(server);

async function startup() {
  const config = await setupWorkspace({
    workspaceDir,
    githubRepoUrl: process.env.GITHUB_REPO_URL,
    githubToken: process.env.GITHUB_TOKEN,
  });

  setCurrentConfig(config);

  // Record initial commit for serve state
  try {
    const { stdout } = await spawnAsync("git", ["rev-parse", "HEAD"], workspaceDir);
    setLastServeCommit(stdout.trim());
  } catch {
    // Not a git repo -- skip
  }

  if (config.serve) {
    setPhase("serving");

    supervisor = new DevServerSupervisor({
      command: config.serve,
      cwd: workspaceDir,
      port: config.frontendPort ?? 3000,
    });

    // Pass supervisor to rebuild route by recreating the app route
    // Actually: the app.ts createApp needs to support late-binding the supervisor.
    // Simpler approach: pass a getter function or make rebuild route accept a mutable ref.
    // For now: we need to refactor createApp to accept a supervisor getter.
    supervisor.start();
  }

  setPhase("ready");

  process.on("SIGTERM", () => {
    supervisor?.stop();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    supervisor?.stop();
    process.exit(0);
  });
}

startup().catch((err) => {
  console.error("[startup] Fatal error during setup:", err);
  process.exit(1);
});
```

Note: The supervisor needs to be available to the rebuild route. Since the supervisor is created after setup, `app.ts` needs a small refactor -- the rebuild route should accept a supervisor reference that can be set later. The simplest approach: use a mutable container object `{ supervisor?: DevServerSupervisor }` passed at `createApp` time, then populated after setup.

Update `app.ts`:

```typescript
// packages/pod-server/src/app.ts
export interface AppConfig {
  supervisorRef?: { current?: DevServerSupervisor };
  workspaceDir?: string;
}

export function createApp(config?: AppConfig) {
  const app = new Hono();

  app.route("/", health);
  app.route("/", files);
  app.route("/", git);
  app.route("/", activeSessions);
  app.route("/", sessions);

  if (config?.supervisorRef && config?.workspaceDir) {
    // Create a proxy supervisor that delegates to supervisorRef.current
    const proxySuper = {
      restart: () => config.supervisorRef!.current?.restart(),
    } as DevServerSupervisor;
    app.route("/", rebuild({ supervisor: proxySuper, workspaceDir: config.workspaceDir }));
  }

  // ... rest unchanged
}
```

Then in index.ts:

```typescript
const supervisorRef: { current?: DevServerSupervisor } = {};
const { app, registerWsRoute } = createApp({ supervisorRef, workspaceDir });
// ... after setup:
supervisorRef.current = supervisor;
```

**Step 1: Make these changes**

**Step 2: Run all pod-server tests**

Run: `cd packages/pod-server && npx vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/pod-server/src/index.ts packages/pod-server/src/app.ts
git commit -m "Wire index.ts to use portable config for supervisor and setup"
```

---

## Phase 2: Scaffold and Main App

### Task 8: Add operational config to scaffold .portable.yaml

**Files:**

- Create: `scaffolds/nuxt-postgres/.portable.yaml`

**Step 1: Create the file**

```yaml
prepare: bun install
serve: bun install && bun run build && bun run preview
frontendPort: 3000
```

**Step 2: Commit**

```bash
git add scaffolds/nuxt-postgres/.portable.yaml
git commit -m "Add operational config to nuxt-postgres scaffold"
```

---

### Task 9: Rewrite scaffold-version.ts to use `yaml` package and merge config

**Files:**

- Modify: `packages/app/server/utils/scaffold-version.ts`
- Modify: `packages/app/tests/scaffold-version.test.ts`
- Modify: `packages/app/server/utils/github.ts` (update pushScaffoldToRepo)

The `yaml` dependency was already added to `packages/app` in Task 1. Now rewrite `scaffold-version.ts` to use `yaml.parse()` and `yaml.stringify()` instead of the hand-rolled regex parser. The `generatePortableYaml` function must merge the `scaffold:` section into existing `.portable.yaml` content from the scaffold.

**Step 1: Write tests for the new behavior**

```typescript
// packages/app/tests/scaffold-version.test.ts
import { describe, expect, it } from "vitest";
import { generatePortableYaml, parsePortableYaml } from "~/server/utils/scaffold-version";

describe("generatePortableYaml", () => {
  it("generates YAML with only scaffold section when no existing content", () => {
    const result = generatePortableYaml({
      repoUrl: "https://github.com/user/portable",
      scaffoldPath: "scaffolds/nuxt-postgres",
      version: "abc123",
    });

    expect(result).toContain("scaffold:");
    expect(result).toContain("repo: https://github.com/user/portable");
    expect(result).toContain("path: scaffolds/nuxt-postgres");
    expect(result).toContain("version: abc123");
  });

  it("merges scaffold section into existing config content", () => {
    const existing = "prepare: bun install\nserve: bun run preview\nfrontendPort: 3000\n";
    const result = generatePortableYaml(
      {
        repoUrl: "https://github.com/user/portable",
        scaffoldPath: "scaffolds/nuxt-postgres",
        version: "abc123",
      },
      existing,
    );

    // Parse the result to verify structure
    const { parse } = require("yaml");
    const parsed = parse(result);
    expect(parsed.prepare).toBe("bun install");
    expect(parsed.serve).toBe("bun run preview");
    expect(parsed.frontendPort).toBe(3000);
    expect(parsed.scaffold.repo).toBe("https://github.com/user/portable");
    expect(parsed.scaffold.version).toBe("abc123");
  });

  it("replaces existing scaffold section in content", () => {
    const existing = "prepare: bun install\nscaffold:\n  repo: old\n  path: old\n  version: old\n";
    const result = generatePortableYaml(
      {
        repoUrl: "https://github.com/user/portable",
        scaffoldPath: "scaffolds/nuxt-postgres",
        version: "new123",
      },
      existing,
    );

    const { parse } = require("yaml");
    const parsed = parse(result);
    expect(parsed.prepare).toBe("bun install");
    expect(parsed.scaffold.version).toBe("new123");
  });
});

describe("parsePortableYaml", () => {
  it("parses valid .portable.yaml content", () => {
    const yaml =
      "scaffold:\n  repo: https://github.com/user/portable\n  path: scaffolds/nuxt-postgres\n  version: abc123\n";
    const result = parsePortableYaml(yaml);
    expect(result).toEqual({
      repo: "https://github.com/user/portable",
      path: "scaffolds/nuxt-postgres",
      version: "abc123",
    });
  });

  it("returns null for invalid YAML", () => {
    expect(parsePortableYaml("not yaml at all {{{")).toBeNull();
  });

  it("returns null for YAML missing scaffold key", () => {
    expect(parsePortableYaml("other: data\n")).toBeNull();
  });

  it("roundtrips with generatePortableYaml", () => {
    const config = {
      repoUrl: "https://github.com/user/portable",
      scaffoldPath: "scaffolds/nuxt-postgres",
      version: "abc123def456",
    };
    const yaml = generatePortableYaml(config);
    const parsed = parsePortableYaml(yaml);
    expect(parsed).toEqual({
      repo: config.repoUrl,
      path: config.scaffoldPath,
      version: config.version,
    });
  });
});
```

**Step 2: Rewrite scaffold-version.ts using `yaml` package**

```typescript
// packages/app/server/utils/scaffold-version.ts
import { parse, stringify } from "yaml";

export interface PortableYamlConfig {
  repoUrl: string;
  scaffoldPath: string;
  version: string;
}

export interface PortableYamlData {
  repo: string;
  path: string;
  version: string;
}

/**
 * Generates .portable.yaml content with a scaffold section.
 * If existingContent is provided, parses it and merges the scaffold section
 * into it, preserving all other fields (prepare, serve, frontendPort, etc.).
 */
export function generatePortableYaml(config: PortableYamlConfig, existingContent?: string): string {
  const scaffoldSection = {
    repo: config.repoUrl,
    path: config.scaffoldPath,
    version: config.version,
  };

  let data: Record<string, unknown> = {};
  if (existingContent) {
    try {
      const parsed = parse(existingContent);
      if (parsed && typeof parsed === "object") {
        data = parsed;
      }
    } catch {
      // If existing content is unparseable, start fresh
    }
  }

  data.scaffold = scaffoldSection;
  return stringify(data);
}

export function parsePortableYaml(content: string): PortableYamlData | null {
  try {
    const parsed = parse(content);
    if (!parsed?.scaffold) return null;
    const { repo, path, version } = parsed.scaffold;
    if (typeof repo === "string" && typeof path === "string" && typeof version === "string") {
      return { repo, path, version };
    }
    return null;
  } catch {
    return null;
  }
}
```

**Step 3: Update pushScaffoldToRepo in github.ts**

Instead of generating a standalone `.portable.yaml`, read the scaffold's existing `.portable.yaml` file (if it exists) and pass its content to `generatePortableYaml` as `existingContent`:

```typescript
// In pushScaffoldToRepo, replace the .portable.yaml generation block:
if (config.scaffoldVersion) {
  const existingYaml = files.find((f) => f.path === ".portable.yaml");
  const merged = generatePortableYaml(
    {
      repoUrl: config.scaffoldRepoUrl,
      scaffoldPath: `scaffolds/${scaffoldId}`,
      version: config.scaffoldVersion,
    },
    existingYaml?.content,
  );
  if (existingYaml) {
    existingYaml.content = merged;
  } else {
    files.push({ path: ".portable.yaml", content: merged });
  }
}
```

**Step 4: Run tests**

Run: `cd packages/app && npx vitest run tests/scaffold-version.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/app/server/utils/scaffold-version.ts packages/app/tests/scaffold-version.test.ts packages/app/server/utils/github.ts
git commit -m "Rewrite scaffold-version to use yaml package with merge support"
```

---

### Task 10: Frontend port cache and proxy update

**Files:**

- Create: `packages/app/server/utils/frontend-port-cache.ts`
- Modify: `packages/app/server/utils/proxy-shared.ts`
- Modify: `packages/app/server/plugins/proxy.ts`
- Modify: `packages/app/server/api/projects/[slug]/status.get.ts`

**Step 1: Create the frontend port cache**

```typescript
// packages/app/server/utils/frontend-port-cache.ts
const portCache = new Map<string, number>();

export function getFrontendPort(slug: string): number | undefined {
  return portCache.get(slug);
}

export function setFrontendPort(slug: string, port: number): void {
  portCache.set(slug, port);
}

export function clearFrontendPort(slug: string): void {
  portCache.delete(slug);
}
```

**Step 2: Update `buildProxyTarget` to accept a port parameter**

Change `proxy-shared.ts`:

```typescript
export function buildProxyTarget(slug: string, namespace: string, port?: number): string {
  const targetPort = port ?? 3001;
  return `http://project-${slug}.${namespace}.svc.cluster.local:${targetPort}`;
}
```

**Step 3: Update the proxy plugin to use the cache**

In `proxy.ts`, before building the proxy target, check the frontend port cache. If no cached port, fetch from the pod's health endpoint. If no frontendPort in the response, return a 503 with a "dev server not configured" message.

**Step 4: Update status endpoint to populate the cache**

In `status.get.ts`, when polling the pod's health and getting back a `config.frontendPort`, call `setFrontendPort(slug, port)`.

**Step 5: Write tests and verify**

Run: `cd packages/app && npx vitest run`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/app/server/utils/frontend-port-cache.ts packages/app/server/utils/proxy-shared.ts packages/app/server/plugins/proxy.ts packages/app/server/api/projects/[slug]/status.get.ts
git commit -m "Use cached frontend port from pod health for preview proxy"
```

---

### Task 11: Update app.vue to use new status field names

**Files:**

- Modify: `packages/app/pages/projects/[slug]/app.vue`

The `RebuildStatus` interface needs to match the new field names from the rebuild status endpoint:

```typescript
interface RebuildStatus {
  lastServeCommit: string | null;
  currentHead: string;
  isDirty: boolean;
  isRestarting: boolean;
  lastServeError: string | null;
  unbuiltCommitCount: number | null;
}
```

Update all references in the template from `isBuilding` to `isRestarting`, `lastBuildError` to `lastServeError`, `lastBuiltCommit` to `lastServeCommit`.

**Step 1: Make the changes**

**Step 2: Verify by running typecheck**

Run: `cd packages/app && npx nuxi typecheck`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add packages/app/pages/projects/[slug]/app.vue
git commit -m "Update app page to use serve-state field names"
```

---

## Phase 3: Cleanup

### Task 12: Update CLAUDE.md and documentation

**Files:**

- Modify: `CLAUDE.md` (update pod server docs, env vars, setup phases)
- Modify: `docs/pod-server.md` (if it exists, update accordingly)

Update all references to:

- `DEV_SERVER_COMMAND` -> removed
- `bun install` / `bun run build` / `bun run preview` -> now in `.portable.yaml`
- Port 3001 -> configurable via `frontendPort`
- Setup phases -> `initializing -> cloning -> preparing -> serving -> ready`
- Build state -> serve state
- New `.portable.yaml` format documentation

**Step 1: Make the changes**

**Step 2: Commit**

```bash
git add CLAUDE.md docs/
git commit -m "Update documentation for portable config changes"
```

---

### Task 13: Run full test suite and fix any remaining issues

**Step 1: Run all tests**

Run: `cd /home/finn/Repos/portable && bun run test`
Expected: PASS

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Run linting**

Run: `bun run lint`
Expected: PASS

**Step 4: Fix any failures**

Address any remaining issues from the full test/type/lint pass.

**Step 5: Final commit if needed**

```bash
git add -A
git commit -m "Fix remaining issues from portable config migration"
```
