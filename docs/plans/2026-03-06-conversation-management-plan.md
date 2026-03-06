# Conversation Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add conversation history and parallel conversation support by exposing the Claude Agent SDK's session management through the pod server and reworking the editor's Chat tab into a session list + chat view.

**Architecture:** The pod server gets REST endpoints wrapping the SDK's `listSessions()` and `getSessionMessages()`, plus a delete endpoint. The WebSocket protocol extends to accept a `session` query param for resume and emits `session_info` with the active session ID. The editor Chat tab becomes a two-state view: session list (default) and chat view (selected session).

**Tech Stack:** Claude Agent SDK session APIs, Hono REST routes, Vue 3 composables, Vitest

---

## Phase 1: Pod Server — Sessions REST API

### Task 1: Sessions route — list and messages endpoints

**Files:**

- Create: `packages/pod-server/src/routes/sessions.ts`
- Modify: `packages/pod-server/src/app.ts:6-15`
- Test: `packages/pod-server/tests/sessions.test.ts`

**Step 1: Write the failing test for GET /api/sessions**

Create `packages/pod-server/tests/sessions.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
  listSessions: vi.fn(),
  getSessionMessages: vi.fn(),
}));

import { listSessions, getSessionMessages } from "@anthropic-ai/claude-agent-sdk";

const mockListSessions = vi.mocked(listSessions);
const mockGetSessionMessages = vi.mocked(getSessionMessages);

describe("sessions API", () => {
  it("GET /api/sessions returns session list sorted by lastModified desc", async () => {
    mockListSessions.mockResolvedValue([
      {
        sessionId: "aaa",
        summary: "First conversation",
        lastModified: 1000,
        fileSize: 100,
        firstPrompt: "Hello",
      },
      {
        sessionId: "bbb",
        summary: "Second conversation",
        lastModified: 2000,
        fileSize: 200,
        firstPrompt: "Help me",
      },
    ]);

    const { app } = createApp();
    const res = await app.request("/api/sessions");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sessions).toHaveLength(2);
    // Sorted by lastModified desc — bbb first
    expect(body.sessions[0].sessionId).toBe("bbb");
    expect(body.sessions[1].sessionId).toBe("aaa");
    expect(body.sessions[0]).toEqual({
      sessionId: "bbb",
      title: "Second conversation",
      lastModified: 2000,
      firstPrompt: "Help me",
    });
  });

  it("GET /api/sessions returns empty array when no sessions", async () => {
    mockListSessions.mockResolvedValue([]);

    const { app } = createApp();
    const res = await app.request("/api/sessions");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sessions).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/pod-server && npx vitest run tests/sessions.test.ts`
Expected: FAIL — route does not exist, 404

**Step 3: Write minimal implementation**

Create `packages/pod-server/src/routes/sessions.ts`:

```typescript
import { listSessions, getSessionMessages } from "@anthropic-ai/claude-agent-sdk";
import { Hono } from "hono";

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || "/workspace";

export const sessions = new Hono();

sessions.get("/api/sessions", async (c) => {
  const raw = await listSessions({ dir: WORKSPACE_DIR });
  const sorted = raw.sort((a, b) => b.lastModified - a.lastModified);
  const sessions = sorted.map((s) => ({
    sessionId: s.sessionId,
    title: s.customTitle || s.summary || s.firstPrompt || "Untitled",
    lastModified: s.lastModified,
    firstPrompt: s.firstPrompt ?? null,
  }));
  return c.json({ sessions });
});
```

Register the route in `packages/pod-server/src/app.ts` — add import and `app.route("/", sessions)` alongside the existing files and health routes:

```typescript
import { sessions } from "./routes/sessions.js";
// ... in createApp():
app.route("/", sessions);
```

**Step 4: Run test to verify it passes**

Run: `cd packages/pod-server && npx vitest run tests/sessions.test.ts`
Expected: PASS

**Step 5: Add failing test for GET /api/sessions/:id/messages**

Append to the describe block in `packages/pod-server/tests/sessions.test.ts`:

```typescript
it("GET /api/sessions/:id/messages returns mapped messages", async () => {
  mockGetSessionMessages.mockResolvedValue([
    {
      type: "user",
      uuid: "u1",
      session_id: "sess1",
      message: { role: "user", content: [{ type: "text", text: "Hello" }] },
      parent_tool_use_id: null,
    },
    {
      type: "assistant",
      uuid: "a1",
      session_id: "sess1",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "Hi there!" },
          { type: "tool_use", id: "t1", name: "bash", input: { command: "ls" } },
        ],
      },
      parent_tool_use_id: null,
    },
  ]);

  const { app } = createApp();
  const res = await app.request("/api/sessions/sess1/messages");
  expect(res.status).toBe(200);

  const body = await res.json();
  expect(body.messages).toHaveLength(2);
  expect(body.messages[0]).toEqual({
    role: "user",
    content: "Hello",
  });
  expect(body.messages[1]).toEqual({
    role: "assistant",
    content: "Hi there!",
    toolUse: [{ name: "bash", input: '{\n  "command": "ls"\n}' }],
  });
});

it("GET /api/sessions/:id/messages returns empty array for unknown session", async () => {
  mockGetSessionMessages.mockResolvedValue([]);

  const { app } = createApp();
  const res = await app.request("/api/sessions/unknown/messages");
  expect(res.status).toBe(200);

  const body = await res.json();
  expect(body.messages).toEqual([]);
});
```

**Step 6: Run test to verify it fails**

Run: `cd packages/pod-server && npx vitest run tests/sessions.test.ts`
Expected: FAIL — route not found

**Step 7: Implement the messages endpoint**

Add to `packages/pod-server/src/routes/sessions.ts`:

```typescript
interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  id?: string;
  input?: unknown;
}

interface MessageContent {
  role?: string;
  content?: ContentBlock[] | string;
}

sessions.get("/api/sessions/:id/messages", async (c) => {
  const sessionId = c.req.param("id");
  const raw = await getSessionMessages(sessionId, { dir: WORKSPACE_DIR });

  const messages = raw
    .filter((m) => m.type === "user" || m.type === "assistant")
    .map((m) => {
      const msg = m.message as MessageContent;
      const blocks = Array.isArray(msg.content) ? msg.content : [];

      const text = blocks
        .filter((b): b is ContentBlock & { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("");

      const toolUse = blocks
        .filter((b) => b.type === "tool_use")
        .map((b) => ({
          name: b.name!,
          input: JSON.stringify(b.input, null, 2),
        }));

      const result: Record<string, unknown> = {
        role: m.type,
        content: typeof msg.content === "string" ? msg.content : text,
      };

      if (toolUse.length > 0) {
        result.toolUse = toolUse;
      }

      return result;
    });

  return c.json({ messages });
});
```

**Step 8: Run test to verify it passes**

Run: `cd packages/pod-server && npx vitest run tests/sessions.test.ts`
Expected: PASS

**Step 9: Commit**

```bash
git add packages/pod-server/src/routes/sessions.ts packages/pod-server/src/app.ts packages/pod-server/tests/sessions.test.ts
git commit -m "Add sessions REST API for listing and reading conversation history"
```

### Task 2: Sessions route — delete endpoint

**Files:**

- Modify: `packages/pod-server/src/routes/sessions.ts`
- Test: `packages/pod-server/tests/sessions.test.ts`

**Step 1: Write the failing test for DELETE /api/sessions/:id**

Append to `packages/pod-server/tests/sessions.test.ts`. The delete endpoint needs to find the session's transcript file and remove it. We mock `listSessions` to find the file path, and `fs.unlink` to remove it:

```typescript
import { vol } from "memfs";

vi.mock("node:fs/promises", async () => {
  const memfs = await import("memfs");
  return memfs.fs.promises;
});

// In the describe block:
it("DELETE /api/sessions/:id removes session and returns 204", async () => {
  // Create a fake session file
  vol.fromJSON({
    "/home/node/.claude/projects/-workspace/sessions/sess1.jsonl": "{}",
  });

  mockListSessions.mockResolvedValue([
    {
      sessionId: "sess1",
      summary: "Test",
      lastModified: 1000,
      fileSize: 100,
      cwd: "/workspace",
    },
  ]);

  const { app } = createApp();
  const res = await app.request("/api/sessions/sess1", { method: "DELETE" });
  expect(res.status).toBe(204);
});

it("DELETE /api/sessions/:id returns 404 for unknown session", async () => {
  mockListSessions.mockResolvedValue([]);

  const { app } = createApp();
  const res = await app.request("/api/sessions/unknown", { method: "DELETE" });
  expect(res.status).toBe(404);
});
```

Note: The exact file discovery mechanism depends on how the SDK stores transcripts. During implementation, verify the actual path structure by checking `listSessions()` output or the SDK source. The approach may need adjustment — if the SDK doesn't expose file paths, we may need to search `~/.claude/projects/` for files containing the session ID.

**Step 2: Run test to verify it fails**

Run: `cd packages/pod-server && npx vitest run tests/sessions.test.ts`
Expected: FAIL — no DELETE handler

**Step 3: Implement delete**

Add to `packages/pod-server/src/routes/sessions.ts`:

```typescript
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { readdirSync, existsSync } from "node:fs";

async function findSessionFile(sessionId: string): Promise<string | null> {
  // The SDK stores transcripts under ~/.claude/projects/<encoded-dir>/
  // We search for JSONL files containing the session ID
  const claudeDir = join(homedir(), ".claude", "projects");
  if (!existsSync(claudeDir)) return null;

  for (const projectDir of readdirSync(claudeDir)) {
    const sessionsDir = join(claudeDir, projectDir);
    if (!existsSync(sessionsDir)) continue;
    for (const file of readdirSync(sessionsDir)) {
      if (file.endsWith(".jsonl") && file.includes(sessionId)) {
        return join(sessionsDir, file);
      }
    }
  }
  return null;
}

sessions.delete("/api/sessions/:id", async (c) => {
  const sessionId = c.req.param("id");
  const filePath = await findSessionFile(sessionId);

  if (!filePath) {
    return c.json({ error: "Session not found" }, 404);
  }

  await unlink(filePath);
  return new Response(null, { status: 204 });
});
```

Note: The `findSessionFile` implementation above is a best-effort approach. During implementation, verify the actual directory structure the SDK uses by inspecting `~/.claude/projects/` in a running pod after at least one conversation. The SDK may use a different naming scheme. Adjust the search logic accordingly.

**Step 4: Run test to verify it passes**

Run: `cd packages/pod-server && npx vitest run tests/sessions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/pod-server/src/routes/sessions.ts packages/pod-server/tests/sessions.test.ts
git commit -m "Add DELETE endpoint for removing conversation sessions"
```

---

## Phase 2: Pod Server — WebSocket Session Support

### Task 3: WebSocket accepts session query param and uses resume/continue

**Files:**

- Modify: `packages/pod-server/src/routes/ws.ts`
- Modify: `packages/pod-server/tests/ws.test.ts`

**Step 1: Write the failing test for session resume**

Add to `packages/pod-server/tests/ws.test.ts`:

```typescript
it("passes resume option when session query param is provided", async () => {
  mockMessages = [{ type: "assistant", session_id: "existing-session", message: { content: [] } }];

  ws = new WebSocket(`${serverUrl}/ws?session=existing-session`);
  await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve()));
  ws.addEventListener("message", (event) => {
    received.push(JSON.parse(event.data as string));
  });

  ws.send(JSON.stringify({ type: "user_message", content: "continue" }));
  await waitForMessages(3); // query_start, sdk_event, query_end

  const callArgs = mockQuery.mock.calls[0][0];
  expect(callArgs.options.resume).toBe("existing-session");
});

it("does not pass resume option when no session query param", async () => {
  mockMessages = [{ type: "assistant", session_id: "new-session", message: { content: [] } }];

  ws = new WebSocket(`${serverUrl}/ws`);
  await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve()));
  ws.addEventListener("message", (event) => {
    received.push(JSON.parse(event.data as string));
  });

  ws.send(JSON.stringify({ type: "user_message", content: "hello" }));
  await waitForMessages(3);

  const callArgs = mockQuery.mock.calls[0][0];
  expect(callArgs.options.resume).toBeUndefined();
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/pod-server && npx vitest run tests/ws.test.ts`
Expected: FAIL — resume is not passed

**Step 3: Implement session support in ws.ts**

Modify `packages/pod-server/src/routes/ws.ts`. The key changes:

1. Parse `session` from the URL query params on WebSocket upgrade
2. Track `sessionId` and `isFirstQuery` in `ConnectionState`
3. First query: if `sessionId` is set, pass `resume: sessionId`. Otherwise fresh query.
4. Subsequent queries: pass `continue: true`
5. Extract `session_id` from the first streamed message and send `session_info`

Replace the `ConnectionState` interface:

```typescript
interface ConnectionState {
  activeQuery: Query | null;
  pendingPrompt: string | null;
  closed: boolean;
  sessionId: string | null; // Set from query param or first streamed message
  isFirstQuery: boolean; // True until first query completes
}
```

Update `runQuery` to build options based on session state:

```typescript
async function runQuery(
  ws: WSContext<NodeWebSocket>,
  prompt: string,
  state: ConnectionState,
): Promise<void> {
  const options: Record<string, unknown> = {
    cwd: WORKSPACE_DIR,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    systemPrompt: { type: "preset", preset: "claude_code" },
    settingSources: ["project"],
  };

  if (state.isFirstQuery && state.sessionId) {
    options.resume = state.sessionId;
  } else if (!state.isFirstQuery) {
    options.continue = true;
  }

  const activeQuery = query({ prompt, options });
  state.activeQuery = activeQuery;
  sendJson(ws, { type: "query_start" });

  let sessionIdCaptured = false;

  try {
    for await (const message of activeQuery) {
      // Capture session_id from first message that has it
      if (!sessionIdCaptured && "session_id" in message && (message as any).session_id) {
        state.sessionId = (message as any).session_id;
        sessionIdCaptured = true;
      }
      sendJson(ws, { type: "sdk_event", event: message });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendJson(ws, { type: "error", message: errorMessage });
  } finally {
    // Send session_info after first query
    if (state.isFirstQuery && state.sessionId) {
      sendJson(ws, { type: "session_info", sessionId: state.sessionId });
    }
    state.isFirstQuery = false;
    state.activeQuery = null;
    sendJson(ws, { type: "query_end" });
  }

  if (state.pendingPrompt !== null && !state.closed) {
    const nextPrompt = state.pendingPrompt;
    state.pendingPrompt = null;
    await runQuery(ws, nextPrompt, state);
  }
}
```

Update the WebSocket handler to parse the session param:

```typescript
app.get(
  "/ws",
  upgradeWebSocket((c) => {
    const sessionParam = new URL(c.req.url).searchParams.get("session");

    const state: ConnectionState = {
      activeQuery: null,
      pendingPrompt: null,
      closed: false,
      sessionId: sessionParam,
      isFirstQuery: true,
    };

    return {
      // ... rest stays the same
    };
  }),
);
```

**Step 4: Run test to verify it passes**

Run: `cd packages/pod-server && npx vitest run tests/ws.test.ts`
Expected: PASS

**Step 5: Add test for session_info message and continue on subsequent queries**

```typescript
it("sends session_info after first query with session_id from stream", async () => {
  mockMessages = [{ type: "assistant", session_id: "new-sess-123", message: { content: [] } }];

  ws = new WebSocket(`${serverUrl}/ws`);
  await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve()));
  ws.addEventListener("message", (event) => {
    received.push(JSON.parse(event.data as string));
  });

  ws.send(JSON.stringify({ type: "user_message", content: "hello" }));
  const messages = await waitForMessages(4); // query_start, sdk_event, session_info, query_end

  expect(messages[2]).toEqual({ type: "session_info", sessionId: "new-sess-123" });
});

it("uses continue option on subsequent queries in same connection", async () => {
  // First query
  mockMessages = [{ type: "assistant", session_id: "sess-1", message: { content: [] } }];

  ws = new WebSocket(`${serverUrl}/ws`);
  await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve()));
  ws.addEventListener("message", (event) => {
    received.push(JSON.parse(event.data as string));
  });

  ws.send(JSON.stringify({ type: "user_message", content: "first" }));
  await waitForMessages(4); // query_start, sdk_event, session_info, query_end

  // Second query
  mockMessages = [{ type: "assistant", session_id: "sess-1", message: { content: [] } }];
  ws.send(JSON.stringify({ type: "user_message", content: "second" }));
  await waitForMessages(3); // query_start, sdk_event, query_end

  const secondCallArgs = mockQuery.mock.calls[1][0];
  expect(secondCallArgs.options.continue).toBe(true);
  expect(secondCallArgs.options.resume).toBeUndefined();
});
```

**Step 6: Run tests**

Run: `cd packages/pod-server && npx vitest run tests/ws.test.ts`
Expected: PASS

**Step 7: Run all pod-server tests to check for regressions**

Run: `cd packages/pod-server && npx vitest run`
Expected: All existing tests still pass

**Step 8: Commit**

```bash
git add packages/pod-server/src/routes/ws.ts packages/pod-server/tests/ws.test.ts
git commit -m "Add session resume and continue support to WebSocket bridge"
```

---

## Phase 3: Editor — Sessions Composable

### Task 4: Create useSessions composable

**Files:**

- Create: `packages/editor/src/composables/useSessions.ts`
- Test: `packages/editor/tests/sessions.test.ts`

**Step 1: Write the failing test**

Create `packages/editor/tests/sessions.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useSessions } from "../src/composables/useSessions";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("useSessions composable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchSessions populates sessions ref sorted by lastModified", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessions: [
            { sessionId: "a", title: "First", lastModified: 2000, firstPrompt: "Hello" },
            { sessionId: "b", title: "Second", lastModified: 1000, firstPrompt: "Hi" },
          ],
        }),
    });

    const { sessions, fetchSessions } = useSessions();
    await fetchSessions();

    expect(sessions.value).toHaveLength(2);
    expect(sessions.value[0].sessionId).toBe("a");
    expect(mockFetch).toHaveBeenCalledWith("/api/sessions");
  });

  it("loadMessages returns mapped ChatMessage array", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          messages: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi!", toolUse: [{ name: "bash", input: "{}" }] },
          ],
        }),
    });

    const { loadMessages } = useSessions();
    const messages = await loadMessages("sess1");

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].toolUse).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/sessions/sess1/messages");
  });

  it("deleteSession calls DELETE and removes from local list", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            sessions: [
              { sessionId: "a", title: "First", lastModified: 2000, firstPrompt: "Hello" },
            ],
          }),
      })
      .mockResolvedValueOnce({ ok: true, status: 204 });

    const { sessions, fetchSessions, deleteSession } = useSessions();
    await fetchSessions();
    expect(sessions.value).toHaveLength(1);

    await deleteSession("a");

    expect(sessions.value).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledWith("/api/sessions/a", { method: "DELETE" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/editor && npx vitest run tests/sessions.test.ts`
Expected: FAIL — module not found

**Step 3: Implement useSessions**

Create `packages/editor/src/composables/useSessions.ts`:

```typescript
import type { ChatMessage } from "./useWebSocket";
import { ref } from "vue";

export interface SessionSummary {
  sessionId: string;
  title: string;
  lastModified: number;
  firstPrompt: string | null;
}

export function useSessions() {
  const sessions = ref<SessionSummary[]>([]);
  const loading = ref(false);

  async function fetchSessions() {
    loading.value = true;
    try {
      const res = await fetch("/api/sessions");
      const body = await res.json();
      sessions.value = body.sessions;
    } finally {
      loading.value = false;
    }
  }

  async function loadMessages(sessionId: string): Promise<ChatMessage[]> {
    const res = await fetch(`/api/sessions/${sessionId}/messages`);
    const body = await res.json();
    return body.messages;
  }

  async function deleteSession(sessionId: string) {
    await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    sessions.value = sessions.value.filter((s) => s.sessionId !== sessionId);
  }

  return { sessions, loading, fetchSessions, loadMessages, deleteSession };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/editor && npx vitest run tests/sessions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/editor/src/composables/useSessions.ts packages/editor/tests/sessions.test.ts
git commit -m "Add useSessions composable for conversation list management"
```

### Task 5: Update useWebSocket to support session param and session_info

**Files:**

- Modify: `packages/editor/src/composables/useWebSocket.ts`
- Modify: `packages/editor/tests/chat.test.ts`

**Step 1: Write the failing test**

Add to the `useWebSocket composable` describe block in `packages/editor/tests/chat.test.ts`:

```typescript
it("connects with session query param when sessionId provided", () => {
  const ws = useWebSocket({ sessionId: "test-session" });
  expect(MockWebSocket.instances[0].url).toContain("/ws?session=test-session");
  ws.close();
});

it("connects without session param when no sessionId", () => {
  const ws = useWebSocket();
  expect(MockWebSocket.instances[0].url).toMatch(/\/ws$/);
  ws.close();
});

it("captures sessionId from session_info message", () => {
  const ws = useWebSocket();
  MockWebSocket.instances[0].simulateOpen();

  MockWebSocket.instances[0].simulateMessage({
    type: "session_info",
    sessionId: "new-session-id",
  });

  expect(ws.sessionId.value).toBe("new-session-id");
  ws.close();
});

it("accepts initial messages to pre-populate history", () => {
  const initial = [
    { role: "user" as const, content: "Hello" },
    { role: "assistant" as const, content: "Hi there!" },
  ];
  const ws = useWebSocket({ initialMessages: initial });

  expect(ws.messages.value).toHaveLength(2);
  expect(ws.messages.value[0].content).toBe("Hello");
  ws.close();
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/editor && npx vitest run tests/chat.test.ts`
Expected: FAIL — useWebSocket doesn't accept options

**Step 3: Implement changes to useWebSocket**

Modify `packages/editor/src/composables/useWebSocket.ts`:

Change the function signature to accept options:

```typescript
export interface UseWebSocketOptions {
  sessionId?: string;
  initialMessages?: ChatMessage[];
}

export function useWebSocket(options?: UseWebSocketOptions) {
  const messages = ref<ChatMessage[]>(options?.initialMessages ? [...options.initialMessages] : []);
  const isConnected = ref(false);
  const isStreaming = ref(false);
  const sessionId = ref<string | null>(options?.sessionId ?? null);
```

Update `buildWsUrl`:

```typescript
function buildWsUrl(): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const base = `${protocol}//${location.host}/ws`;
  if (options?.sessionId) {
    return `${base}?session=${encodeURIComponent(options.sessionId)}`;
  }
  return base;
}
```

Add `session_info` handling to `handleMessage`:

```typescript
      case "session_info":
        if (parsed.sessionId) {
          sessionId.value = parsed.sessionId as string;
        }
        break;
```

Update the `InboundMessage` interface to include `sessionId`:

```typescript
interface InboundMessage {
  type: "query_start" | "query_end" | "error" | "sdk_event" | "session_info";
  event?: SdkAssistantEvent;
  message?: string;
  sessionId?: string;
}
```

Return `sessionId` from the composable:

```typescript
return {
  messages,
  isConnected,
  isStreaming,
  sessionId,
  send,
  interrupt,
  close,
};
```

**Step 4: Run test to verify it passes**

Run: `cd packages/editor && npx vitest run tests/chat.test.ts`
Expected: PASS (all existing + new tests)

**Step 5: Commit**

```bash
git add packages/editor/src/composables/useWebSocket.ts packages/editor/tests/chat.test.ts
git commit -m "Extend useWebSocket with session ID support and initial messages"
```

---

## Phase 4: Editor — Chat Tab Rework

### Task 6: Create SessionList component

**Files:**

- Create: `packages/editor/src/components/SessionList.vue`
- Add tests to: `packages/editor/tests/sessions.test.ts`

**Step 1: Write the failing test**

Add to `packages/editor/tests/sessions.test.ts`:

```typescript
import { flushPromises, mount } from "@vue/test-utils";
import SessionList from "../src/components/SessionList.vue";

describe("SessionList component", () => {
  it("renders session cards with title and relative time", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessions: [
            {
              sessionId: "a",
              title: "Fix the login bug",
              lastModified: Date.now() - 3600000,
              firstPrompt: "Fix the login bug",
            },
          ],
        }),
    });

    const wrapper = mount(SessionList);
    await flushPromises();

    expect(wrapper.find("[data-testid='session-card']").exists()).toBe(true);
    expect(wrapper.text()).toContain("Fix the login bug");
  });

  it("emits select with sessionId when card is tapped", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessions: [
            { sessionId: "a", title: "Chat 1", lastModified: Date.now(), firstPrompt: "Hello" },
          ],
        }),
    });

    const wrapper = mount(SessionList);
    await flushPromises();

    await wrapper.find("[data-testid='session-card']").trigger("click");
    expect(wrapper.emitted("select")).toBeTruthy();
    expect(wrapper.emitted("select")![0]).toEqual(["a"]);
  });

  it("emits new-session when new conversation button is clicked", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessions: [] }),
    });

    const wrapper = mount(SessionList);
    await flushPromises();

    await wrapper.find("[data-testid='new-session-button']").trigger("click");
    expect(wrapper.emitted("new-session")).toBeTruthy();
  });

  it("shows empty state when no sessions exist", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessions: [] }),
    });

    const wrapper = mount(SessionList);
    await flushPromises();

    expect(wrapper.find("[data-testid='empty-state']").exists()).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/editor && npx vitest run tests/sessions.test.ts`
Expected: FAIL — component not found

**Step 3: Implement SessionList component**

Create `packages/editor/src/components/SessionList.vue`:

```vue
<script setup lang="ts">
import { onMounted } from "vue";
import { useSessions } from "../composables/useSessions";

const emit = defineEmits<{
  select: [sessionId: string];
  "new-session": [];
}>();

const { sessions, loading, fetchSessions, deleteSession } = useSessions();

onMounted(() => {
  fetchSessions();
});

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function handleDelete(sessionId: string) {
  await deleteSession(sessionId);
}
</script>

<template>
  <div class="session-list">
    <div class="session-header">
      <h2 class="session-title">Conversations</h2>
      <button class="new-button" data-testid="new-session-button" @click="emit('new-session')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="new-icon">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <span class="loading-text">Loading...</span>
    </div>

    <div v-else-if="sessions.length === 0" class="empty-state" data-testid="empty-state">
      <span class="empty-label">No conversations yet</span>
      <button class="start-button" data-testid="new-session-button" @click="emit('new-session')">
        Start a conversation
      </button>
    </div>

    <div v-else class="session-cards">
      <div
        v-for="session in sessions"
        :key="session.sessionId"
        class="session-card"
        data-testid="session-card"
        @click="emit('select', session.sessionId)"
      >
        <div class="card-content">
          <span class="card-title">{{ session.title }}</span>
          <span class="card-time">{{ formatRelativeTime(session.lastModified) }}</span>
        </div>
        <button
          class="delete-button"
          data-testid="delete-session-button"
          @click.stop="handleDelete(session.sessionId)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="delete-icon">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 12px 8px;
  flex-shrink: 0;
}

.session-title {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.new-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-surface);
  color: var(--color-accent);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.new-icon {
  width: 18px;
  height: 18px;
}

.session-cards {
  flex: 1;
  overflow-y: auto;
  padding: 4px 12px 12px;
  -webkit-overflow-scrolling: touch;
}

.session-card {
  display: flex;
  align-items: center;
  padding: 14px 12px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.session-card:active {
  background: var(--color-bg-surface);
}

.card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-title {
  font-size: 0.875rem;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-time {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.delete-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.delete-button:active {
  background: var(--color-bg-surface);
  color: #f85149;
}

.delete-icon {
  width: 16px;
  height: 16px;
}

.loading-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.loading-text,
.empty-label {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.start-button {
  padding: 10px 20px;
  border: 1px solid var(--color-accent);
  border-radius: 8px;
  background: none;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.start-button:active {
  background: var(--color-bg-surface);
}
</style>
```

**Step 4: Run test to verify it passes**

Run: `cd packages/editor && npx vitest run tests/sessions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/editor/src/components/SessionList.vue packages/editor/tests/sessions.test.ts
git commit -m "Add SessionList component for conversation list display"
```

### Task 7: Rework ChatView into two-state session list + chat

**Files:**

- Modify: `packages/editor/src/views/ChatView.vue`
- Modify: `packages/editor/tests/chat.test.ts`

**Step 1: Write the failing test for the two-state flow**

Add a new describe block to `packages/editor/tests/chat.test.ts`:

```typescript
describe("chatView session management", () => {
  beforeEach(() => {
    // Mock fetch for session list
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ sessions: [] }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Re-stub WebSocket for other tests
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  it("shows session list by default when entering chat tab", async () => {
    const router = createTestRouter();
    router.push("/chat");
    await router.isReady();

    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.find("[data-testid='new-session-button']").exists()).toBe(true);
  });

  it("switches to chat view when new-session is clicked", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);

    const router = createTestRouter();
    router.push("/chat");
    await router.isReady();

    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();

    await wrapper.find("[data-testid='new-session-button']").trigger("click");
    await flushPromises();

    // Should now show chat input instead of session list
    expect(wrapper.find("textarea").exists()).toBe(true);
  });

  it("shows back button in chat view that returns to session list", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);

    const router = createTestRouter();
    router.push("/chat");
    await router.isReady();

    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();

    // Enter chat view
    await wrapper.find("[data-testid='new-session-button']").trigger("click");
    await flushPromises();

    // Click back
    await wrapper.find("[data-testid='back-button']").trigger("click");
    await flushPromises();

    // Should be back to session list
    expect(wrapper.find("[data-testid='new-session-button']").exists()).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/editor && npx vitest run tests/chat.test.ts`
Expected: FAIL — ChatView still renders directly

**Step 3: Rework ChatView.vue**

Replace `packages/editor/src/views/ChatView.vue` with a two-state view:

```vue
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import ChatInput from "../components/ChatInput.vue";
import ChatMessage from "../components/ChatMessage.vue";
import SessionList from "../components/SessionList.vue";
import { useSessions } from "../composables/useSessions";
import { useWebSocket, type ChatMessage as ChatMessageType } from "../composables/useWebSocket";

type ViewState = "list" | "chat";

const viewState = ref<ViewState>("list");
const activeSessionId = ref<string | null>(null);

let ws: ReturnType<typeof useWebSocket> | null = null;
const messageListRef = ref<HTMLDivElement | null>(null);
const { loadMessages } = useSessions();

// Reactive proxies for the template
const messages = ref<ChatMessageType[]>([]);
const isStreaming = ref(false);
const isConnected = ref(false);

function scrollToBottom() {
  nextTick(() => {
    const el = messageListRef.value;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  });
}

async function openSession(sessionId: string) {
  activeSessionId.value = sessionId;
  const history = await loadMessages(sessionId);
  startChat(history, sessionId);
}

function startNewSession() {
  activeSessionId.value = null;
  startChat([], undefined);
}

function startChat(initialMessages: ChatMessageType[], sessionId?: string) {
  ws = useWebSocket({ sessionId, initialMessages });
  messages.value = ws.messages.value;
  isStreaming.value = ws.isStreaming.value;
  isConnected.value = ws.isConnected.value;

  watch(
    () => ws!.messages.value,
    (val) => {
      messages.value = val;
      scrollToBottom();
    },
    { deep: true },
  );

  watch(
    () => ws!.isStreaming.value,
    (val) => {
      isStreaming.value = val;
      scrollToBottom();
    },
  );

  watch(
    () => ws!.isConnected.value,
    (val) => {
      isConnected.value = val;
    },
  );

  watch(
    () => ws!.sessionId.value,
    (val) => {
      if (val) activeSessionId.value = val;
    },
  );

  viewState.value = "chat";
  scrollToBottom();
}

function goBack() {
  if (ws) {
    ws.close();
    ws = null;
  }
  messages.value = [];
  isStreaming.value = false;
  isConnected.value = false;
  activeSessionId.value = null;
  viewState.value = "list";
}

function handleSend(content: string) {
  ws?.send(content);
  scrollToBottom();
}

function handleInterrupt() {
  ws?.interrupt();
}

onBeforeUnmount(() => {
  ws?.close();
});
</script>

<template>
  <div class="view chat-view" data-testid="chat-view">
    <!-- Session List State -->
    <SessionList v-if="viewState === 'list'" @select="openSession" @new-session="startNewSession" />

    <!-- Chat State -->
    <template v-else>
      <div class="chat-header">
        <button class="back-button" data-testid="back-button" @click="goBack">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="back-icon">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <span class="chat-label">Chat</span>
      </div>

      <div ref="messageListRef" class="message-list">
        <div v-if="messages.length === 0" class="empty-state">
          <span class="empty-label">Start a conversation</span>
        </div>
        <ChatMessage v-for="(msg, index) in messages" :key="index" :message="msg" />
        <div v-if="isStreaming" class="streaming-indicator" data-testid="streaming-indicator">
          <span class="streaming-dot" />
          <span class="streaming-dot" />
          <span class="streaming-dot" />
        </div>
      </div>
      <ChatInput :is-streaming="isStreaming" @send="handleSend" @interrupt="handleInterrupt" />
    </template>
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.back-button:active {
  background: var(--color-bg-surface);
}

.back-icon {
  width: 18px;
  height: 18px;
}

.chat-label {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  -webkit-overflow-scrolling: touch;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-label {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.streaming-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  align-self: flex-start;
}

.streaming-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-muted);
  animation: pulse 1.4s ease-in-out infinite;
}

.streaming-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.streaming-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes pulse {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
```

**Step 4: Run tests**

Run: `cd packages/editor && npx vitest run tests/chat.test.ts`
Expected: PASS — new session management tests pass. Some existing `chatView integration` tests may need updating since the ChatView now shows the session list first instead of directly showing the chat input. Update those tests to click "new session" first before asserting chat behavior.

**Step 5: Fix any broken existing tests**

The existing `chatView integration` tests assumed the chat view opens directly with a WebSocket. They now need to first click the "new session" button:

Update the existing integration tests to navigate through the session list:

```typescript
describe("chatView integration", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ sessions: [] }),
      }),
    );
  });

  it("connects to WebSocket after clicking new session", async () => {
    const router = createTestRouter();
    router.push("/chat");
    await router.isReady();

    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();

    await wrapper.find("[data-testid='new-session-button']").trigger("click");
    await flushPromises();

    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(1);
  });

  // Update other integration tests similarly...
});
```

**Step 6: Run all editor tests**

Run: `cd packages/editor && npx vitest run`
Expected: All tests pass

**Step 7: Commit**

```bash
git add packages/editor/src/views/ChatView.vue packages/editor/tests/chat.test.ts
git commit -m "Rework Chat tab into session list + chat view with back navigation"
```

---

## Phase 5: Verification

### Task 8: Run full test suite and typecheck

**Step 1: Run all tests**

Run: `bun run test`
Expected: All tests pass across all packages

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: No type errors

**Step 3: Run lint**

Run: `bun run lint`
Expected: No lint errors (or fix any that come up)

**Step 4: Commit any fixes**

If typecheck/lint required changes:

```bash
git add -A
git commit -m "Fix typecheck and lint issues"
```

### Task 9: Code review

Dispatch `superpowers:code-reviewer` to review all changes against this plan.

### Task 10: Update documentation

Update `CLAUDE.md` to document:

- The new sessions REST endpoints on the pod server
- The WebSocket session protocol changes
- The Chat tab's two-state behavior

---

## Implementation Notes

**SDK session file discovery (Task 2):** The delete endpoint needs to find transcript files on disk. The SDK stores them under `~/.claude/projects/<encoded-cwd>/`. The exact path encoding needs to be verified during implementation. If the SDK doesn't expose the file path directly, search the projects directory for JSONL files matching the session ID.

**Message mapping (Task 1):** The SDK's `SessionMessage.message` field is typed as `unknown`. During implementation, inspect actual message payloads to confirm the structure matches what we expect (`{ role, content: ContentBlock[] }`). The `content` field may be a string for user messages and an array for assistant messages.

**WebSocket URL parsing (Task 3):** The Hono WebSocket upgrade handler receives the request context. Use `c.req.url` or `c.req.query("session")` to extract the session param. Verify which API is available in the Hono version used.

**Test isolation (Task 7):** The reworked ChatView tests need both `fetch` (for session list) and `WebSocket` (for chat) mocks active simultaneously. Ensure both stubs are set up in the beforeEach.
