import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock WebSocket class for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    // Auto-fire open event on next tick
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event("open"));
      }
    }, 0);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent("close"));
    }
  }

  // Test helper: simulate receiving a message
  _receive(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data: JSON.stringify(data) }));
    }
  }
}

// Install the mock globally before importing the composable
vi.stubGlobal("WebSocket", MockWebSocket);

// Mock window.location for URL building
vi.stubGlobal("window", {
  location: {
    protocol: "http:",
    host: "localhost:3000",
  },
});

// CloseEvent is not available in Node.js -- stub it
if (typeof globalThis.CloseEvent === "undefined") {
  (globalThis as Record<string, unknown>).CloseEvent = class CloseEvent extends Event {
    code: number;
    reason: string;
    wasClean: boolean;
    constructor(type: string, init?: { code?: number; reason?: string; wasClean?: boolean }) {
      super(type);
      this.code = init?.code ?? 1000;
      this.reason = init?.reason ?? "";
      this.wasClean = init?.wasClean ?? true;
    }
  };
}

// We'll import the module dynamically after the mocks are set up
// eslint-disable-next-line ts/consistent-type-imports
type UseWebSocket = Awaited<typeof import("~/composables/useWebSocket")>["useWebSocket"];
let useWebSocket: UseWebSocket;

// Helper to get the last created WebSocket instance
let lastWs: MockWebSocket;

function setLastWs(ws: MockWebSocket) {
  lastWs = ws;
}

beforeEach(async () => {
  vi.useFakeTimers();
  // Track WebSocket instances using a class that extends MockWebSocket
  class TrackedWebSocket extends MockWebSocket {
    static override CONNECTING = 0;
    static override OPEN = 1;
    static override CLOSING = 2;
    static override CLOSED = 3;

    constructor(url: string) {
      super(url);
      setLastWs(this);
    }
  }
  vi.stubGlobal("WebSocket", TrackedWebSocket);

  // Dynamically import to get fresh composable
  const mod = await import("~/composables/useWebSocket");
  useWebSocket = mod.useWebSocket;
});

describe("useWebSocket", () => {
  it("connects to WebSocket URL with project slug", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();

    await vi.advanceTimersByTimeAsync(0);

    expect(lastWs).toBeDefined();
    expect(lastWs.url).toContain("/api/projects/my-project/pod/ws");
  });

  it("includes session ID in URL when provided", async () => {
    const ws = useWebSocket("my-project");
    ws.connect("test-session-id");

    await vi.advanceTimersByTimeAsync(0);

    expect(lastWs.url).toContain("session=test-session-id");
  });

  it("sets isConnected to true on open", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();

    expect(ws.isConnected.value).toBe(false);

    await vi.advanceTimersByTimeAsync(0);

    expect(ws.isConnected.value).toBe(true);
  });

  it("sends user_message via send()", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    ws.send("Hello Claude");

    const sent = JSON.parse(lastWs.sentMessages[0]);
    expect(sent).toEqual({ type: "user_message", content: "Hello Claude" });
  });

  it("adds user message to messages array on send", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    ws.send("Hello Claude");

    expect(ws.messages.value).toHaveLength(1);
    expect(ws.messages.value[0].role).toBe("user");
    expect(ws.messages.value[0].content).toBe("Hello Claude");
  });

  it("sends interrupt message via interrupt()", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    ws.interrupt();

    const sent = JSON.parse(lastWs.sentMessages[0]);
    expect(sent).toEqual({ type: "interrupt" });
  });

  it("tracks isStreaming from query_start to query_end", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    expect(ws.isStreaming.value).toBe(false);

    lastWs._receive({ type: "query_start" });
    expect(ws.isStreaming.value).toBe(true);

    lastWs._receive({ type: "query_end" });
    expect(ws.isStreaming.value).toBe(false);
  });

  it("processes assistant message with text content blocks", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    lastWs._receive({ type: "query_start" });
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "Hello there!" }],
        },
      },
    });
    lastWs._receive({ type: "query_end" });

    const assistantMsgs = ws.messages.value.filter((m) => m.role === "assistant");
    expect(assistantMsgs).toHaveLength(1);
    expect(assistantMsgs[0].content).toBe("Hello there!");
  });

  it("processes assistant message with tool_use blocks", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    lastWs._receive({ type: "query_start" });
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "Let me read that file." },
            {
              type: "tool_use",
              id: "tool-1",
              name: "Read",
              input: { file_path: "/test.ts" },
            },
          ],
        },
      },
    });
    lastWs._receive({ type: "query_end" });

    const msg = ws.messages.value.find((m) => m.role === "assistant");
    expect(msg?.content).toBe("Let me read that file.");
    expect(msg?.toolUse).toHaveLength(1);
    expect(msg?.toolUse![0].name).toBe("Read");
    expect(msg?.toolUse![0].input).toContain("/test.ts");
  });

  it("processes assistant message with thinking blocks", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    lastWs._receive({ type: "query_start" });
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "assistant",
        message: {
          content: [
            { type: "thinking", thinking: "Let me consider..." },
            { type: "text", text: "Here is my answer." },
          ],
        },
      },
    });
    lastWs._receive({ type: "query_end" });

    const msg = ws.messages.value.find((m) => m.role === "assistant");
    expect(msg?.thinking).toHaveLength(1);
    expect(msg?.thinking![0].content).toBe("Let me consider...");
    expect(msg?.content).toBe("Here is my answer.");
  });

  it("processes result message with metadata", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    ws.send("Hello");
    lastWs._receive({ type: "query_start" });
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "Response" }],
        },
      },
    });
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "result",
        subtype: "success",
        total_cost_usd: 0.05,
        duration_ms: 2500,
        num_turns: 3,
        is_error: false,
      },
    });
    lastWs._receive({ type: "query_end" });

    const msg = ws.messages.value.find((m) => m.role === "assistant");
    expect(msg?.resultMeta).toBeDefined();
    expect(msg?.resultMeta?.costUsd).toBe(0.05);
    expect(msg?.resultMeta?.durationMs).toBe(2500);
    expect(msg?.resultMeta?.numTurns).toBe(3);
    expect(msg?.resultMeta?.isError).toBe(false);
  });

  it("processes streaming text deltas", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    lastWs._receive({ type: "query_start" });

    // content_block_start for text
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "stream_event",
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
      },
    });

    // text_delta
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hello " },
        },
      },
    });

    // Verify streaming text is visible
    const msg = ws.messages.value.find((m) => m.role === "assistant");
    expect(msg?.content).toBe("Hello ");

    // More text
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "world!" },
        },
      },
    });

    expect(msg?.content).toBe("Hello world!");
  });

  it("processes streaming thinking deltas", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    lastWs._receive({ type: "query_start" });

    // content_block_start for thinking
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "stream_event",
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "thinking", thinking: "" },
        },
      },
    });

    // thinking_delta
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "thinking_delta", thinking: "Let me think..." },
        },
      },
    });

    const msg = ws.messages.value.find((m) => m.role === "assistant");
    expect(msg?.thinking).toHaveLength(1);
    expect(msg?.thinking![0].content).toBe("Let me think...");
  });

  it("tracks tool progress from tool_progress events", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    lastWs._receive({ type: "query_start" });
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "tool_progress",
        tool_name: "Read",
        tool_use_id: "tool-1",
        elapsed_time_seconds: 2,
      },
    });

    expect(ws.activeTools.value).toHaveLength(1);
    expect(ws.activeTools.value[0].name).toBe("Read");
    expect(ws.activeTools.value[0].elapsed).toBe(2);

    // Tool progress cleared on query_end
    lastWs._receive({ type: "query_end" });
    expect(ws.activeTools.value).toHaveLength(0);
  });

  it("updates session ID from session_info message", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    expect(ws.sessionId.value).toBeNull();

    lastWs._receive({ type: "session_info", sessionId: "new-session-123" });

    expect(ws.sessionId.value).toBe("new-session-123");
  });

  it("handles replay_start and replay_end during reconnect", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    // Replay wraps normal events -- they should be processed normally
    lastWs._receive({ type: "replay_start" });
    lastWs._receive({ type: "query_start" });
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "Replayed response" }],
        },
      },
    });
    lastWs._receive({ type: "replay_end" });

    const msg = ws.messages.value.find((m) => m.role === "assistant");
    expect(msg?.content).toBe("Replayed response");
    // isStreaming should be true since query hasn't ended
    expect(ws.isStreaming.value).toBe(true);
  });

  it("adds error messages from error events", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    lastWs._receive({ type: "error", message: "Something went wrong" });

    expect(ws.error.value).toBe("Something went wrong");
  });

  it("auto-reconnects after disconnect with 2s delay", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    const firstWs = lastWs;
    expect(ws.isConnected.value).toBe(true);

    // Simulate disconnect
    firstWs.readyState = MockWebSocket.CLOSED;
    if (firstWs.onclose) {
      firstWs.onclose(new CloseEvent("close"));
    }

    expect(ws.isConnected.value).toBe(false);

    // Advance past reconnect delay
    await vi.advanceTimersByTimeAsync(2000);

    // New WebSocket should have been created
    expect(lastWs).not.toBe(firstWs);
  });

  it("uses session ID for reconnect URL", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    // Set session ID
    lastWs._receive({ type: "session_info", sessionId: "my-session-456" });

    const firstWs = lastWs;

    // Simulate disconnect
    firstWs.readyState = MockWebSocket.CLOSED;
    if (firstWs.onclose) {
      firstWs.onclose(new CloseEvent("close"));
    }

    // Advance past reconnect delay
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(0);

    // New WS should use the session ID
    expect(lastWs.url).toContain("session=my-session-456");
  });

  it("does not reconnect after manual disconnect()", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    const firstWs = lastWs;
    ws.disconnect();

    // Advance well past reconnect delay
    await vi.advanceTimersByTimeAsync(5000);

    // Should not have created a new connection
    expect(lastWs).toBe(firstWs);
  });

  it("clears messages on resetMessages()", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    ws.send("test message");

    expect(ws.messages.value).toHaveLength(1);

    ws.resetMessages();
    expect(ws.messages.value).toHaveLength(0);
  });

  it("loads initial messages", async () => {
    const ws = useWebSocket("my-project");

    const initialMessages = [
      { role: "user" as const, content: "Hello" },
      { role: "assistant" as const, content: "Hi there!" },
    ];

    ws.connect("session-1", initialMessages);
    await vi.advanceTimersByTimeAsync(0);

    expect(ws.messages.value).toHaveLength(2);
    expect(ws.messages.value[0].content).toBe("Hello");
    expect(ws.messages.value[1].content).toBe("Hi there!");
  });

  it("handles multiple assistant messages in a conversation", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    // First query
    ws.send("First question");
    lastWs._receive({ type: "query_start" });
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "First answer" }],
        },
      },
    });
    lastWs._receive({ type: "query_end" });

    // Second query
    ws.send("Second question");
    lastWs._receive({ type: "query_start" });
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "Second answer" }],
        },
      },
    });
    lastWs._receive({ type: "query_end" });

    expect(ws.messages.value).toHaveLength(4);
    expect(ws.messages.value[0].content).toBe("First question");
    expect(ws.messages.value[1].content).toBe("First answer");
    expect(ws.messages.value[2].content).toBe("Second question");
    expect(ws.messages.value[3].content).toBe("Second answer");
  });

  it("processes streaming input_json_delta for tool use", async () => {
    const ws = useWebSocket("my-project");
    ws.connect();
    await vi.advanceTimersByTimeAsync(0);

    lastWs._receive({ type: "query_start" });

    // Start tool_use block
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "stream_event",
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "tool_use", id: "tool-1", name: "Write", input: {} },
        },
      },
    });

    // Accumulate JSON chunks
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "input_json_delta", partial_json: '{"file' },
        },
      },
    });

    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "input_json_delta", partial_json: '":"test.ts"}' },
        },
      },
    });

    // End block
    lastWs._receive({
      type: "sdk_event",
      event: {
        type: "stream_event",
        event: { type: "content_block_stop", index: 0 },
      },
    });

    const msg = ws.messages.value.find((m) => m.role === "assistant");
    expect(msg?.toolUse).toHaveLength(1);
    expect(msg?.toolUse![0].name).toBe("Write");
    expect(msg?.toolUse![0].input).toContain("test.ts");
  });
});
