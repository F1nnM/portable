import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

// vi.mock is auto-hoisted by vitest to run before imports
const mockInterrupt = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn();
let mockMessages: Array<{ type: string; [key: string]: unknown }> = [];
let mockError: Error | null = null;

function createMockAsyncGenerator() {
  let interrupted = false;

  const generator = {
    async next() {
      if (interrupted || mockMessages.length === 0) {
        return { done: true as const, value: undefined };
      }
      const msg = mockMessages.shift()!;
      if (mockError) {
        throw mockError;
      }
      return { done: false as const, value: msg };
    },
    async return() {
      return { done: true as const, value: undefined };
    },
    async throw(e: Error) {
      throw e;
    },
    [Symbol.asyncIterator]() {
      return this;
    },
    interrupt: mockInterrupt.mockImplementation(async () => {
      interrupted = true;
    }),
    close: mockClose.mockImplementation(() => {
      interrupted = true;
    }),
  };

  return generator;
}

let mockQuery = vi.fn().mockImplementation(() => createMockAsyncGenerator());

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

interface ServerType {
  close: (cb: () => void) => void;
}

describe("websocket bridge", () => {
  let ws: WebSocket;
  let serverUrl: string;
  let server: ServerType;
  let received: Array<Record<string, unknown>>;

  function waitForMessages(count: number, timeout = 3000): Promise<Array<Record<string, unknown>>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timed out waiting for ${count} messages, got ${received.length}`)),
        timeout,
      );
      const check = () => {
        if (received.length >= count) {
          clearTimeout(timer);
          resolve(received.splice(0, count));
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  }

  beforeEach(async () => {
    mockMessages = [];
    mockError = null;
    mockQuery = vi.fn().mockImplementation(() => createMockAsyncGenerator());
    vi.clearAllMocks();

    const { app, registerWsRoute } = createApp();
    const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
    registerWsRoute(upgradeWebSocket);

    received = [];

    await new Promise<void>((resolve) => {
      server = serve({ fetch: app.fetch, port: 0 }, (info) => {
        serverUrl = `ws://localhost:${info.port}`;
        resolve();
      });
      injectWebSocket(server);
    });
  });

  afterEach(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
      await new Promise((resolve) => {
        ws.addEventListener("close", resolve);
      });
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("accepts WebSocket upgrade on /ws", async () => {
    ws = new WebSocket(`${serverUrl}/ws`);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", (e) => reject(e));
    });
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  it("sends query_start and query_end when user_message triggers a query", async () => {
    mockMessages = [{ type: "system", session_id: "test-session" }];

    ws = new WebSocket(`${serverUrl}/ws`);
    await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve()));
    ws.addEventListener("message", (event) => {
      received.push(JSON.parse(event.data as string));
    });

    ws.send(JSON.stringify({ type: "user_message", content: "hello" }));

    const messages = await waitForMessages(4);

    expect(messages[0]).toEqual({ type: "query_start" });
    expect(messages[1]).toEqual({
      type: "sdk_event",
      event: { type: "system", session_id: "test-session" },
    });
    expect(messages[2]).toEqual({ type: "session_info", sessionId: "test-session" });
    expect(messages[3]).toEqual({ type: "query_end" });

    expect(mockQuery).toHaveBeenCalledOnce();
    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.prompt).toBe("hello");
    expect(callArgs.options.permissionMode).toBe("bypassPermissions");
    expect(callArgs.options.allowDangerouslySkipPermissions).toBe(true);
  });

  it("forwards SDK events to browser as sdk_event messages", async () => {
    mockMessages = [
      { type: "assistant", message: { content: [{ type: "text", text: "hi" }] } },
      {
        type: "result",
        subtype: "success",
        result: "done",
        total_cost_usd: 0.01,
        duration_ms: 100,
      },
    ];

    ws = new WebSocket(`${serverUrl}/ws`);
    await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve()));
    ws.addEventListener("message", (event) => {
      received.push(JSON.parse(event.data as string));
    });

    ws.send(JSON.stringify({ type: "user_message", content: "test" }));

    const messages = await waitForMessages(4);

    expect(messages[0]).toEqual({ type: "query_start" });
    expect(messages[1].type).toBe("sdk_event");
    expect((messages[1].event as Record<string, unknown>).type).toBe("assistant");
    expect(messages[2].type).toBe("sdk_event");
    expect((messages[2].event as Record<string, unknown>).type).toBe("result");
    expect(messages[3]).toEqual({ type: "query_end" });
  });

  it("calls interrupt() on the active query when interrupt message is sent", async () => {
    // Create a long-running generator that doesn't complete immediately
    let resolveWait: () => void;
    const waitPromise = new Promise<void>((resolve) => {
      resolveWait = resolve;
    });

    mockQuery = vi.fn().mockImplementation(() => {
      let interrupted = false;
      let firstYielded = false;
      return {
        async next() {
          if (interrupted) {
            return { done: true as const, value: undefined };
          }
          if (!firstYielded) {
            firstYielded = true;
            return {
              done: false as const,
              value: { type: "system", session_id: "s1" },
            };
          }
          // Block until interrupted
          await waitPromise;
          return { done: true as const, value: undefined };
        },
        async return() {
          return { done: true as const, value: undefined };
        },
        async throw(e: Error) {
          throw e;
        },
        [Symbol.asyncIterator]() {
          return this;
        },
        interrupt: vi.fn().mockImplementation(async () => {
          interrupted = true;
          resolveWait!();
        }),
        close: vi.fn(),
      };
    });

    ws = new WebSocket(`${serverUrl}/ws`);
    await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve()));
    ws.addEventListener("message", (event) => {
      received.push(JSON.parse(event.data as string));
    });

    ws.send(JSON.stringify({ type: "user_message", content: "long task" }));

    // Wait for query_start and the first sdk_event
    await waitForMessages(2);

    ws.send(JSON.stringify({ type: "interrupt" }));

    // Wait for session_info and query_end (session_id was captured from first message)
    const remaining = await waitForMessages(2);
    expect(remaining[0]).toEqual({ type: "session_info", sessionId: "s1" });
    expect(remaining[1]).toEqual({ type: "query_end" });

    const activeQuery = mockQuery.mock.results[0].value;
    expect(activeQuery.interrupt).toHaveBeenCalledOnce();
  });

  it("calls close() on disconnect to clean up the active query", async () => {
    let resolveWait: () => void;
    const waitPromise = new Promise<void>((resolve) => {
      resolveWait = resolve;
    });

    const closeFn = vi.fn().mockImplementation(() => {
      resolveWait!();
    });

    mockQuery = vi.fn().mockImplementation(() => {
      let firstYielded = false;
      return {
        async next() {
          if (!firstYielded) {
            firstYielded = true;
            return {
              done: false as const,
              value: { type: "system", session_id: "s1" },
            };
          }
          await waitPromise;
          return { done: true as const, value: undefined };
        },
        async return() {
          return { done: true as const, value: undefined };
        },
        async throw(e: Error) {
          throw e;
        },
        [Symbol.asyncIterator]() {
          return this;
        },
        interrupt: vi.fn(),
        close: closeFn,
      };
    });

    ws = new WebSocket(`${serverUrl}/ws`);
    await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve()));
    ws.addEventListener("message", (event) => {
      received.push(JSON.parse(event.data as string));
    });

    ws.send(JSON.stringify({ type: "user_message", content: "test" }));

    // Wait for query_start + first event
    await waitForMessages(2);

    // Disconnect
    ws.close();

    // Give the server a moment to react to the close event
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(closeFn).toHaveBeenCalledOnce();
  });

  it("forwards SDK errors as error messages to the browser", async () => {
    mockQuery = vi.fn().mockImplementation(() => {
      return {
        async next() {
          throw new Error("SDK connection failed");
        },
        async return() {
          return { done: true as const, value: undefined };
        },
        async throw(e: Error) {
          throw e;
        },
        [Symbol.asyncIterator]() {
          return this;
        },
        interrupt: vi.fn(),
        close: vi.fn(),
      };
    });

    ws = new WebSocket(`${serverUrl}/ws`);
    await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve()));
    ws.addEventListener("message", (event) => {
      received.push(JSON.parse(event.data as string));
    });

    ws.send(JSON.stringify({ type: "user_message", content: "fail" }));

    const messages = await waitForMessages(3);

    expect(messages[0]).toEqual({ type: "query_start" });
    expect(messages[1]).toEqual({ type: "error", message: "SDK connection failed" });
    expect(messages[2]).toEqual({ type: "query_end" });
  });

  it("passes resume option when session query param is provided", async () => {
    mockMessages = [
      { type: "assistant", session_id: "existing-session", message: { content: [] } },
    ];

    ws = new WebSocket(`${serverUrl}/ws?session=existing-session`);
    await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve()));
    ws.addEventListener("message", (event) => {
      received.push(JSON.parse(event.data as string));
    });

    ws.send(JSON.stringify({ type: "user_message", content: "continue" }));
    await waitForMessages(4); // query_start, sdk_event, session_info, query_end

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
    await waitForMessages(4); // query_start, sdk_event, session_info, query_end

    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.options.resume).toBeUndefined();
  });

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

  it("interrupts current query and starts new one when message arrives during active query", async () => {
    let resolveFirst: () => void;
    const firstQueryDone = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    let callCount = 0;
    mockQuery = vi.fn().mockImplementation(({ prompt }: { prompt: string }) => {
      callCount++;
      const isFirst = callCount === 1;
      let yielded = false;
      return {
        async next() {
          if (!yielded) {
            yielded = true;
            return {
              done: false as const,
              value: { type: "assistant", content: `response to: ${prompt}` },
            };
          }
          if (isFirst) {
            await firstQueryDone;
          }
          return { done: true as const, value: undefined };
        },
        async return() {
          return { done: true as const, value: undefined };
        },
        async throw(e: Error) {
          throw e;
        },
        [Symbol.asyncIterator]() {
          return this;
        },
        interrupt: vi.fn().mockImplementation(async () => {
          resolveFirst!();
        }),
        close: vi.fn(),
      };
    });

    ws = new WebSocket(`${serverUrl}/ws`);
    await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve()));
    ws.addEventListener("message", (event) => {
      received.push(JSON.parse(event.data as string));
    });

    // Send first message
    ws.send(JSON.stringify({ type: "user_message", content: "first" }));
    // Wait for query_start + first sdk_event
    await waitForMessages(2);

    // Send second message while first is still active -- should interrupt
    ws.send(JSON.stringify({ type: "user_message", content: "second" }));

    // The first query should be interrupted and a second started
    // Expect: query_end (first), query_start (second), sdk_event (second), query_end (second)
    const remaining = await waitForMessages(4);
    expect(remaining[0]).toEqual({ type: "query_end" });
    expect(remaining[1]).toEqual({ type: "query_start" });
    expect(remaining[2].type).toBe("sdk_event");
    expect(remaining[3]).toEqual({ type: "query_end" });
  });
});
