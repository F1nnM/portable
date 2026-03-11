import type { WSContext } from "hono/ws";
import type { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Import after mocking
import {
  attachClient,
  createSession,
  detachClient,
  getActiveSdkSessionIds,
  getSession,
  getSessionBySdkId,
  interruptQuery,
  resetAllSessions,
  sendMessage,
} from "../src/session-manager.js";

// Mock the SDK before importing session-manager
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

// Mock WSContext
function createMockWs() {
  const sent: string[] = [];
  return {
    ws: {
      send(data: string) {
        sent.push(data);
      },
    } as unknown as WSContext<WebSocket>,
    sent,
    getMessages(): Array<Record<string, unknown>> {
      return sent.map((s) => JSON.parse(s));
    },
  };
}

describe("session-manager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMessages = [];
    mockError = null;
    mockQuery = vi.fn().mockImplementation(() => createMockAsyncGenerator());
    vi.clearAllMocks();
    resetAllSessions();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("session CRUD", () => {
    it("creates a session with a unique ID", () => {
      const session = createSession();
      expect(session.id).toBeDefined();
      expect(typeof session.id).toBe("string");
      expect(session.id.length).toBeGreaterThan(0);
    });

    it("creates sessions with distinct IDs", () => {
      const s1 = createSession();
      const s2 = createSession();
      expect(s1.id).not.toBe(s2.id);
    });

    it("retrieves a session by ID", () => {
      const session = createSession();
      const retrieved = getSession(session.id);
      expect(retrieved).toBe(session);
    });

    it("returns undefined for unknown session ID", () => {
      expect(getSession("nonexistent")).toBeUndefined();
    });

    it("creates a session with correct initial state", () => {
      const session = createSession();
      expect(session.sdkSessionId).toBeNull();
      expect(session.activeQuery).toBeNull();
      expect(session.isRunning).toBe(false);
      expect(session.isFirstQuery).toBe(true);
      expect(session.pendingPrompt).toBeNull();
      expect(session.currentQueryEvents).toEqual([]);
      expect(session.clients.size).toBe(0);
      expect(session.cleanupTimer).toBeNull();
    });

    it("creates a session with an SDK session ID for resume", () => {
      const session = createSession("existing-sdk-session");
      expect(session.sdkSessionId).toBe("existing-sdk-session");
    });

    it("looks up a session by SDK session ID", () => {
      const session = createSession("my-sdk-id");
      const found = getSessionBySdkId("my-sdk-id");
      expect(found).toBe(session);
    });

    it("returns undefined for unknown SDK session ID", () => {
      expect(getSessionBySdkId("unknown")).toBeUndefined();
    });
  });

  describe("attach/detach clients", () => {
    it("adds a client to the session", () => {
      const session = createSession();
      const { ws } = createMockWs();
      attachClient(session, ws);
      expect(session.clients.size).toBe(1);
      expect(session.clients.has(ws)).toBe(true);
    });

    it("removes a client from the session", () => {
      const session = createSession();
      const { ws } = createMockWs();
      attachClient(session, ws);
      detachClient(session, ws);
      expect(session.clients.size).toBe(0);
    });

    it("supports multiple clients on the same session", () => {
      const session = createSession();
      const { ws: ws1 } = createMockWs();
      const { ws: ws2 } = createMockWs();
      attachClient(session, ws1);
      attachClient(session, ws2);
      expect(session.clients.size).toBe(2);
    });

    it("cancels cleanup timer when a client attaches", () => {
      const session = createSession();
      // Manually set a cleanup timer to simulate the scenario
      session.cleanupTimer = setTimeout(() => {}, 30000);
      const { ws } = createMockWs();
      attachClient(session, ws);
      expect(session.cleanupTimer).toBeNull();
    });
  });

  describe("sendMessage and query execution", () => {
    it("starts a query and broadcasts events to connected clients", async () => {
      mockMessages = [
        { type: "system", session_id: "sdk-123" },
        { type: "assistant", message: { content: [{ type: "text", text: "Hello" }] } },
      ];

      const session = createSession();
      const { ws, getMessages } = createMockWs();
      attachClient(session, ws);

      sendMessage(session, "Hello");

      // Let the async query run
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      const messages = getMessages();
      expect(messages[0]).toEqual({ type: "query_start" });
      expect(messages.some((m) => m.type === "sdk_event")).toBe(true);
      expect(messages[messages.length - 1]).toEqual({ type: "query_end" });
    });

    it("captures SDK session ID from first event", async () => {
      mockMessages = [{ type: "system", session_id: "captured-id" }];

      const session = createSession();
      const { ws } = createMockWs();
      attachClient(session, ws);

      sendMessage(session, "test");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      expect(session.sdkSessionId).toBe("captured-id");
    });

    it("indexes session by SDK session ID after capture", async () => {
      mockMessages = [{ type: "system", session_id: "new-sdk-id" }];

      const session = createSession();
      const { ws } = createMockWs();
      attachClient(session, ws);

      sendMessage(session, "test");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      expect(getSessionBySdkId("new-sdk-id")).toBe(session);
    });

    it("sends session_info after first query", async () => {
      mockMessages = [{ type: "system", session_id: "info-id" }];

      const session = createSession();
      const { ws, getMessages } = createMockWs();
      attachClient(session, ws);

      sendMessage(session, "test");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      const messages = getMessages();
      expect(messages).toContainEqual({ type: "session_info", sessionId: "info-id" });
    });

    it("does not send session_info on subsequent queries", async () => {
      mockMessages = [{ type: "system", session_id: "once-id" }];

      const session = createSession();
      const { ws, getMessages } = createMockWs();
      attachClient(session, ws);

      sendMessage(session, "first");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      // Clear sent messages for the second query
      const sentBefore = getMessages().length;

      mockMessages = [{ type: "assistant", message: { content: [] } }];
      sendMessage(session, "second");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      const allMessages = getMessages();
      const secondQueryMessages = allMessages.slice(sentBefore);
      expect(secondQueryMessages.some((m) => m.type === "session_info")).toBe(false);
    });

    it("passes resume option on first query with SDK session ID", async () => {
      mockMessages = [{ type: "assistant", session_id: "resume-id", message: { content: [] } }];

      const session = createSession("resume-id");
      const { ws } = createMockWs();
      attachClient(session, ws);

      sendMessage(session, "continue");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      const callArgs = mockQuery.mock.calls[0][0];
      expect(callArgs.options.resume).toBe("resume-id");
    });

    it("passes continue option on subsequent queries", async () => {
      mockMessages = [{ type: "system", session_id: "cont-id" }];

      const session = createSession();
      const { ws } = createMockWs();
      attachClient(session, ws);

      sendMessage(session, "first");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      mockMessages = [{ type: "assistant", message: { content: [] } }];
      sendMessage(session, "second");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      const secondCallArgs = mockQuery.mock.calls[1][0];
      expect(secondCallArgs.options.continue).toBe(true);
      expect(secondCallArgs.options.resume).toBeUndefined();
    });

    it("buffers events in currentQueryEvents", async () => {
      mockMessages = [
        { type: "system", session_id: "buf-id" },
        { type: "assistant", message: { content: [{ type: "text", text: "buffered" }] } },
      ];

      const session = createSession();
      const { ws } = createMockWs();
      attachClient(session, ws);

      sendMessage(session, "test");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      // The buffer should contain query_start, sdk_events, session_info, query_end
      expect(session.currentQueryEvents.length).toBeGreaterThan(0);
      expect(session.currentQueryEvents[0]).toEqual({ type: "query_start" });
      expect(session.currentQueryEvents[session.currentQueryEvents.length - 1]).toEqual({
        type: "query_end",
      });
    });
  });

  describe("query continues after detach", () => {
    it("does not kill the query when all clients disconnect", async () => {
      // Create a long-running query
      let resolveWait: () => void;
      const waitPromise = new Promise<void>((resolve) => {
        resolveWait = resolve;
      });

      mockQuery = vi.fn().mockImplementation(() => {
        let firstYielded = false;
        let interrupted = false;
        return {
          async next() {
            if (interrupted) return { done: true as const, value: undefined };
            if (!firstYielded) {
              firstYielded = true;
              return {
                done: false as const,
                value: { type: "system", session_id: "running-id" },
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
          interrupt: vi.fn().mockImplementation(async () => {
            interrupted = true;
            resolveWait!();
          }),
          close: vi.fn(),
        };
      });

      const session = createSession();
      const { ws } = createMockWs();
      attachClient(session, ws);

      sendMessage(session, "long task");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      // Verify query is running
      expect(session.isRunning).toBe(true);

      // Detach client
      detachClient(session, ws);

      // Query should still be running
      expect(session.isRunning).toBe(true);
      expect(session.activeQuery).not.toBeNull();

      // Clean up
      const activeQuery = mockQuery.mock.results[0].value;
      activeQuery.interrupt();
      await vi.advanceTimersByTimeAsync(0);
    });

    it("buffers events while no clients are connected", async () => {
      // Set up a query that yields multiple messages
      let resolveSecond: () => void;
      const secondPromise = new Promise<void>((resolve) => {
        resolveSecond = resolve;
      });

      let yieldCount = 0;
      mockQuery = vi.fn().mockImplementation(() => {
        return {
          async next() {
            yieldCount++;
            if (yieldCount === 1) {
              return {
                done: false as const,
                value: { type: "system", session_id: "buf-running" },
              };
            }
            if (yieldCount === 2) {
              // Wait, then detach client, then yield another message
              await secondPromise;
              return {
                done: false as const,
                value: {
                  type: "assistant",
                  message: { content: [{ type: "text", text: "after detach" }] },
                },
              };
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
          interrupt: vi.fn(),
          close: vi.fn(),
        };
      });

      const session = createSession();
      const { ws } = createMockWs();
      attachClient(session, ws);

      sendMessage(session, "test");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      // Detach client while query is running
      detachClient(session, ws);

      // Resolve second message, which should be buffered
      resolveSecond!();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      // The session should still have the events buffered
      expect(
        session.currentQueryEvents.some(
          (e) =>
            e.type === "sdk_event" &&
            (e as Record<string, unknown>).event &&
            ((e as Record<string, unknown>).event as Record<string, unknown>).type === "assistant",
        ),
      ).toBe(true);
    });
  });

  describe("reconnect replay", () => {
    it("replays buffered events when a new client attaches to a running session", async () => {
      mockMessages = [{ type: "system", session_id: "replay-id" }];

      const session = createSession();
      const { ws: ws1 } = createMockWs();
      attachClient(session, ws1);

      sendMessage(session, "test");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      // Now detach the first client
      detachClient(session, ws1);

      // Attach a new client -- should get replay since session had events
      const { ws: ws2, getMessages: getMessages2 } = createMockWs();
      attachClient(session, ws2);

      const replayed = getMessages2();
      // Should have replay_start, buffered events, replay_end
      expect(replayed[0]).toEqual({ type: "replay_start" });
      expect(replayed[replayed.length - 1]).toEqual({ type: "replay_end" });
      // Inner events should include query_start, sdk_event(s), session_info, query_end
      expect(replayed.length).toBeGreaterThan(2);
    });

    it("does not replay when session has no events", () => {
      const session = createSession();
      const { ws, getMessages } = createMockWs();
      attachClient(session, ws);

      expect(getMessages()).toEqual([]);
    });
  });

  describe("cleanup timer", () => {
    it("starts cleanup timer when query ends with no clients", async () => {
      // Use a blocking query so we can detach before it finishes
      let resolveQuery: () => void;
      const queryDone = new Promise<void>((resolve) => {
        resolveQuery = resolve;
      });

      mockQuery = vi.fn().mockImplementation(() => {
        let firstYielded = false;
        let interrupted = false;
        return {
          async next() {
            if (interrupted) return { done: true as const, value: undefined };
            if (!firstYielded) {
              firstYielded = true;
              return {
                done: false as const,
                value: { type: "system", session_id: "cleanup-id" },
              };
            }
            await queryDone;
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
            resolveQuery!();
          }),
          close: vi.fn(),
        };
      });

      const session = createSession();
      const { ws } = createMockWs();
      attachClient(session, ws);

      sendMessage(session, "test");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      // Detach while query is still running
      detachClient(session, ws);
      expect(session.isRunning).toBe(true);

      // Now let the query finish
      resolveQuery!();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      // Cleanup timer should be set since no clients are attached
      expect(session.cleanupTimer).not.toBeNull();
    });

    it("cleans up session after timeout", async () => {
      let resolveQuery: () => void;
      const queryDone = new Promise<void>((resolve) => {
        resolveQuery = resolve;
      });

      mockQuery = vi.fn().mockImplementation(() => {
        let firstYielded = false;
        let interrupted = false;
        return {
          async next() {
            if (interrupted) return { done: true as const, value: undefined };
            if (!firstYielded) {
              firstYielded = true;
              return {
                done: false as const,
                value: { type: "system", session_id: "expire-id" },
              };
            }
            await queryDone;
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
            resolveQuery!();
          }),
          close: vi.fn(),
        };
      });

      const session = createSession();
      const sessionId = session.id;
      const { ws } = createMockWs();
      attachClient(session, ws);

      sendMessage(session, "test");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      // Detach while running
      detachClient(session, ws);

      // Let query finish
      resolveQuery!();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      // Advance past the cleanup timeout (30 seconds)
      await vi.advanceTimersByTimeAsync(31000);

      expect(getSession(sessionId)).toBeUndefined();
    });
  });

  describe("pending prompt queuing", () => {
    it("queues a prompt if a query is already running", async () => {
      let resolveFirst: () => void;
      const firstDone = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      let callCount = 0;
      mockQuery = vi.fn().mockImplementation(() => {
        callCount++;
        const isFirst = callCount === 1;
        let yielded = false;
        return {
          async next() {
            if (!yielded) {
              yielded = true;
              return {
                done: false as const,
                value: { type: "system", session_id: "pending-id" },
              };
            }
            if (isFirst) {
              await firstDone;
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

      const session = createSession();
      const { ws } = createMockWs();
      attachClient(session, ws);

      // Start first query
      sendMessage(session, "first");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      // Send second message while first is running -- should interrupt and queue
      sendMessage(session, "second");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      // Both queries should have been called
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery.mock.calls[1][0].prompt).toBe("second");
    });
  });

  describe("getActiveSdkSessionIds", () => {
    it("returns empty array when no sessions are active", () => {
      expect(getActiveSdkSessionIds()).toEqual([]);
    });

    it("returns SDK session IDs for running queries", async () => {
      let resolveWait: () => void;
      const waitPromise = new Promise<void>((resolve) => {
        resolveWait = resolve;
      });

      mockQuery = vi.fn().mockImplementation(() => {
        let firstYielded = false;
        let interrupted = false;
        return {
          async next() {
            if (interrupted) return { done: true as const, value: undefined };
            if (!firstYielded) {
              firstYielded = true;
              return {
                done: false as const,
                value: { type: "system", session_id: "active-sdk-id" },
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
          interrupt: vi.fn().mockImplementation(async () => {
            interrupted = true;
            resolveWait!();
          }),
          close: vi.fn(),
        };
      });

      const session = createSession();
      const { ws } = createMockWs();
      attachClient(session, ws);

      sendMessage(session, "test");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      expect(getActiveSdkSessionIds()).toEqual(["active-sdk-id"]);

      // Clean up
      const activeQuery = mockQuery.mock.results[0].value;
      activeQuery.interrupt();
      await vi.advanceTimersByTimeAsync(0);
    });

    it("does not return completed sessions", async () => {
      mockMessages = [{ type: "system", session_id: "completed-id" }];

      const session = createSession();
      const { ws } = createMockWs();
      attachClient(session, ws);

      sendMessage(session, "test");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      expect(session.isRunning).toBe(false);
      expect(getActiveSdkSessionIds()).toEqual([]);
    });
  });

  describe("interruptQuery", () => {
    it("interrupts the active query", async () => {
      let resolveWait: () => void;
      const waitPromise = new Promise<void>((resolve) => {
        resolveWait = resolve;
      });

      mockQuery = vi.fn().mockImplementation(() => {
        let firstYielded = false;
        let interrupted = false;
        return {
          async next() {
            if (interrupted) return { done: true as const, value: undefined };
            if (!firstYielded) {
              firstYielded = true;
              return {
                done: false as const,
                value: { type: "system", session_id: "int-id" },
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
          interrupt: vi.fn().mockImplementation(async () => {
            interrupted = true;
            resolveWait!();
          }),
          close: vi.fn(),
        };
      });

      const session = createSession();
      const { ws } = createMockWs();
      attachClient(session, ws);

      sendMessage(session, "test");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      expect(session.isRunning).toBe(true);

      interruptQuery(session);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      expect(session.isRunning).toBe(false);
    });
  });

  describe("error handling", () => {
    it("sends error event when SDK query throws", async () => {
      mockQuery = vi.fn().mockImplementation(() => {
        return {
          async next() {
            throw new Error("SDK error");
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

      const session = createSession();
      const { ws, getMessages } = createMockWs();
      attachClient(session, ws);

      sendMessage(session, "fail");
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      const messages = getMessages();
      expect(messages).toContainEqual({ type: "error", message: "SDK error" });
      expect(messages[messages.length - 1]).toEqual({ type: "query_end" });
    });
  });
});
