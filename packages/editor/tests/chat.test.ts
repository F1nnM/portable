import type { ChatMessage as ChatMessageType } from "../src/composables/useWebSocket";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import App from "../src/App.vue";
import ChatInput from "../src/components/ChatInput.vue";
import ChatMessage from "../src/components/ChatMessage.vue";
import { useWebSocket } from "../src/composables/useWebSocket";
import { routes } from "../src/router";

// --- Mock WebSocket ---

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  readyState: number = 0; // CONNECTING
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  simulateMessage(data: Record<string, unknown>) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close"));
  }

  simulateError() {
    this.onerror?.(new Event("error"));
  }
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

describe("chat", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("useWebSocket composable", () => {
    it("connects to WebSocket on call", () => {
      const ws = useWebSocket();
      expect(MockWebSocket.instances).toHaveLength(1);
      expect(MockWebSocket.instances[0].url).toContain("/ws");
      ws.close();
    });

    it("sets isConnected to true when socket opens", async () => {
      const ws = useWebSocket();
      expect(ws.isConnected.value).toBe(false);

      MockWebSocket.instances[0].simulateOpen();
      expect(ws.isConnected.value).toBe(true);
      ws.close();
    });

    it("sends user message and tracks it in messages array", () => {
      const ws = useWebSocket();
      MockWebSocket.instances[0].simulateOpen();

      ws.send("Hello Claude");

      expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
        JSON.stringify({ type: "user_message", content: "Hello Claude" }),
      );
      expect(ws.messages.value).toHaveLength(1);
      expect(ws.messages.value[0].role).toBe("user");
      expect(ws.messages.value[0].content).toBe("Hello Claude");
      ws.close();
    });

    it("accumulates assistant text from sdk_event during query", async () => {
      const ws = useWebSocket();
      MockWebSocket.instances[0].simulateOpen();
      ws.send("Hello");

      const mock = MockWebSocket.instances[0];

      // query_start
      mock.simulateMessage({ type: "query_start" });
      expect(ws.isStreaming.value).toBe(true);

      // assistant event with text content
      mock.simulateMessage({
        type: "sdk_event",
        event: {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "Hello! " }],
          },
        },
      });

      // another assistant event with more text
      mock.simulateMessage({
        type: "sdk_event",
        event: {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "How can I help?" }],
          },
        },
      });

      // query_end finalizes the message
      mock.simulateMessage({ type: "query_end" });
      expect(ws.isStreaming.value).toBe(false);

      // Should have user message + assistant message
      expect(ws.messages.value).toHaveLength(2);
      expect(ws.messages.value[1].role).toBe("assistant");
      expect(ws.messages.value[1].content).toBe("Hello! How can I help?");
      ws.close();
    });

    it("tracks tool use from sdk_event", () => {
      const ws = useWebSocket();
      MockWebSocket.instances[0].simulateOpen();
      ws.send("Fix the bug");

      const mock = MockWebSocket.instances[0];
      mock.simulateMessage({ type: "query_start" });

      mock.simulateMessage({
        type: "sdk_event",
        event: {
          type: "assistant",
          message: {
            content: [
              { type: "text", text: "Let me fix that." },
              { type: "tool_use", id: "t1", name: "bash", input: { command: "ls" } },
            ],
          },
        },
      });

      mock.simulateMessage({ type: "query_end" });

      const assistantMsg = ws.messages.value[1];
      expect(assistantMsg.role).toBe("assistant");
      expect(assistantMsg.content).toBe("Let me fix that.");
      expect(assistantMsg.toolUse).toHaveLength(1);
      expect(assistantMsg.toolUse![0].name).toBe("bash");
      expect(assistantMsg.toolUse![0].input).toBe('{\n  "command": "ls"\n}');
      ws.close();
    });

    it("sends interrupt command", () => {
      const ws = useWebSocket();
      MockWebSocket.instances[0].simulateOpen();

      ws.interrupt();

      expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
        JSON.stringify({ type: "interrupt" }),
      );
      ws.close();
    });

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
  });

  describe("chatMessage component", () => {
    it("renders user message right-aligned with accent background", () => {
      const msg: ChatMessageType = { role: "user", content: "Hello" };
      const wrapper = mount(ChatMessage, { props: { message: msg } });

      expect(wrapper.find("[data-testid='chat-message']").exists()).toBe(true);
      expect(wrapper.find("[data-testid='chat-message']").classes()).toContain("message-user");
      expect(wrapper.text()).toContain("Hello");
    });

    it("renders assistant message left-aligned with surface background", () => {
      const msg: ChatMessageType = { role: "assistant", content: "Hi there" };
      const wrapper = mount(ChatMessage, { props: { message: msg } });

      expect(wrapper.find("[data-testid='chat-message']").classes()).toContain("message-assistant");
      expect(wrapper.text()).toContain("Hi there");
    });

    it("renders tool use blocks with tool name", async () => {
      const msg: ChatMessageType = {
        role: "assistant",
        content: "Running command...",
        toolUse: [{ name: "bash", input: '{ "command": "ls" }' }],
      };
      const wrapper = mount(ChatMessage, { props: { message: msg } });

      expect(wrapper.find("[data-testid='tool-use-block']").exists()).toBe(true);
      expect(wrapper.text()).toContain("bash");

      // Expand the tool use block to see the input
      await wrapper.find(".tool-use-header").trigger("click");
      expect(wrapper.text()).toContain("ls");
    });
  });

  describe("chatInput component", () => {
    it("emits send event when clicking send button with non-empty text", async () => {
      const wrapper = mount(ChatInput, { props: { isStreaming: false } });

      const textarea = wrapper.find("textarea");
      await textarea.setValue("Hello Claude");
      await wrapper.find("[data-testid='send-button']").trigger("click");

      expect(wrapper.emitted("send")).toBeTruthy();
      expect(wrapper.emitted("send")![0]).toEqual(["Hello Claude"]);
    });

    it("clears input after sending", async () => {
      const wrapper = mount(ChatInput, { props: { isStreaming: false } });

      const textarea = wrapper.find("textarea");
      await textarea.setValue("Hello Claude");
      await wrapper.find("[data-testid='send-button']").trigger("click");

      expect((textarea.element as HTMLTextAreaElement).value).toBe("");
    });

    it("disables send button when text is empty", () => {
      const wrapper = mount(ChatInput, { props: { isStreaming: false } });

      const sendBtn = wrapper.find("[data-testid='send-button']");
      expect((sendBtn.element as HTMLButtonElement).disabled).toBe(true);
    });

    it("shows interrupt button when streaming", () => {
      const wrapper = mount(ChatInput, { props: { isStreaming: true } });

      expect(wrapper.find("[data-testid='interrupt-button']").exists()).toBe(true);
    });

    it("emits interrupt event when clicking interrupt button", async () => {
      const wrapper = mount(ChatInput, { props: { isStreaming: true } });

      await wrapper.find("[data-testid='interrupt-button']").trigger("click");
      expect(wrapper.emitted("interrupt")).toBeTruthy();
    });
  });

  describe("chatView session management", () => {
    beforeEach(() => {
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

    it("loads messages and opens WebSocket when selecting existing session", async () => {
      vi.stubGlobal("WebSocket", MockWebSocket);

      const mockFetch = vi.fn();
      // First call: session list
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            sessions: [
              {
                sessionId: "sess1",
                title: "Test session",
                lastModified: Date.now(),
                firstPrompt: "Hello",
              },
            ],
          }),
      });
      // Second call: load messages for the selected session
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            messages: [
              { role: "user", content: "Hello" },
              { role: "assistant", content: "Hi there!" },
            ],
          }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const router = createTestRouter();
      router.push("/chat");
      await router.isReady();

      const wrapper = mount(App, { global: { plugins: [router] } });
      await flushPromises();

      // Click on the session card
      await wrapper.find("[data-testid='session-card']").trigger("click");
      await flushPromises();

      // Should show chat view with loaded messages
      expect(wrapper.find("textarea").exists()).toBe(true);
      const chatMessages = wrapper.findAll("[data-testid='chat-message']");
      expect(chatMessages.length).toBe(2);

      // WebSocket should connect with session param
      const wsInstance = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      expect(wsInstance.url).toContain("/ws?session=sess1");
    });

    it("closes WebSocket when going back from chat to session list", async () => {
      vi.stubGlobal("WebSocket", MockWebSocket);

      const router = createTestRouter();
      router.push("/chat");
      await router.isReady();

      const wrapper = mount(App, { global: { plugins: [router] } });
      await flushPromises();

      // Enter chat view
      await wrapper.find("[data-testid='new-session-button']").trigger("click");
      await flushPromises();

      const wsInstance = MockWebSocket.instances[MockWebSocket.instances.length - 1];

      // Click back
      await wrapper.find("[data-testid='back-button']").trigger("click");
      await flushPromises();

      expect(wsInstance.close).toHaveBeenCalled();
    });
  });

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

    it("renders user and assistant messages", async () => {
      const router = createTestRouter();
      router.push("/chat");
      await router.isReady();

      const wrapper = mount(App, { global: { plugins: [router] } });
      await flushPromises();

      // First click new session to enter chat mode
      await wrapper.find("[data-testid='new-session-button']").trigger("click");
      await flushPromises();

      const mock = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      mock.simulateOpen();
      await flushPromises();

      // Type and send a message
      const textarea = wrapper.find("textarea");
      await textarea.setValue("Hello");
      await wrapper.find("[data-testid='send-button']").trigger("click");
      await flushPromises();

      // Simulate assistant response
      mock.simulateMessage({ type: "query_start" });
      mock.simulateMessage({
        type: "sdk_event",
        event: {
          type: "assistant",
          message: { content: [{ type: "text", text: "Hi there!" }] },
        },
      });
      mock.simulateMessage({ type: "query_end" });
      await flushPromises();

      const messages = wrapper.findAll("[data-testid='chat-message']");
      expect(messages.length).toBe(2);
      expect(messages[0].classes()).toContain("message-user");
      expect(messages[1].classes()).toContain("message-assistant");
    });

    it("shows loading indicator during streaming", async () => {
      const router = createTestRouter();
      router.push("/chat");
      await router.isReady();

      const wrapper = mount(App, { global: { plugins: [router] } });
      await flushPromises();

      // First click new session to enter chat mode
      await wrapper.find("[data-testid='new-session-button']").trigger("click");
      await flushPromises();

      const mock = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      mock.simulateOpen();
      await flushPromises();

      // Send a message
      const textarea = wrapper.find("textarea");
      await textarea.setValue("Hello");
      await wrapper.find("[data-testid='send-button']").trigger("click");
      await flushPromises();

      // Start streaming
      mock.simulateMessage({ type: "query_start" });
      await flushPromises();

      expect(wrapper.find("[data-testid='streaming-indicator']").exists()).toBe(true);

      // End streaming
      mock.simulateMessage({ type: "query_end" });
      await flushPromises();

      expect(wrapper.find("[data-testid='streaming-indicator']").exists()).toBe(false);
    });
  });
});
