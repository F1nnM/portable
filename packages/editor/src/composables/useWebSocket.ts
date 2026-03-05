import { ref } from "vue";

export interface ToolUseEntry {
  name: string;
  input: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolUse?: ToolUseEntry[];
}

interface SdkTextBlock {
  type: "text";
  text: string;
}

interface SdkToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

type SdkContentBlock = SdkTextBlock | SdkToolUseBlock;

interface SdkAssistantEvent {
  type: "assistant" | "result";
  message: {
    content: SdkContentBlock[];
  };
}

interface InboundMessage {
  type: "query_start" | "query_end" | "error" | "sdk_event";
  event?: SdkAssistantEvent;
  message?: string;
}

const RECONNECT_DELAY_MS = 2000;

export function useWebSocket() {
  const messages = ref<ChatMessage[]>([]);
  const isConnected = ref(false);
  const isStreaming = ref(false);

  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  // Accumulation state for the current assistant response
  let pendingText = "";
  let pendingToolUse: ToolUseEntry[] = [];

  function buildWsUrl(): string {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${location.host}/ws`;
  }

  function processContentBlocks(blocks: SdkContentBlock[]) {
    for (const block of blocks) {
      if (block.type === "text") {
        pendingText += block.text;
      } else if (block.type === "tool_use") {
        pendingToolUse.push({
          name: block.name,
          input: JSON.stringify(block.input, null, 2),
        });
      }
    }
  }

  function finalizeAssistantMessage() {
    if (pendingText || pendingToolUse.length > 0) {
      const msg: ChatMessage = {
        role: "assistant",
        content: pendingText,
      };
      if (pendingToolUse.length > 0) {
        msg.toolUse = [...pendingToolUse];
      }
      messages.value.push(msg);
    }
    pendingText = "";
    pendingToolUse = [];
  }

  function handleMessage(data: string) {
    let parsed: InboundMessage;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    switch (parsed.type) {
      case "query_start":
        isStreaming.value = true;
        pendingText = "";
        pendingToolUse = [];
        break;

      case "sdk_event":
        if (parsed.event?.message?.content) {
          processContentBlocks(parsed.event.message.content);
        }
        break;

      case "query_end":
        finalizeAssistantMessage();
        isStreaming.value = false;
        break;

      case "error":
        // Surface error as an assistant message
        if (parsed.message) {
          messages.value.push({
            role: "assistant",
            content: `Error: ${parsed.message}`,
          });
        }
        break;
    }
  }

  function connect() {
    if (closed) return;

    socket = new WebSocket(buildWsUrl());

    socket.onopen = () => {
      isConnected.value = true;
    };

    socket.onmessage = (evt: MessageEvent) => {
      handleMessage(typeof evt.data === "string" ? evt.data : String(evt.data));
    };

    socket.onclose = () => {
      isConnected.value = false;
      isStreaming.value = false;
      scheduleReconnect();
    };

    socket.onerror = () => {
      // onclose will fire after onerror
    };
  }

  function scheduleReconnect() {
    if (closed) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      connect();
    }, RECONNECT_DELAY_MS);
  }

  function send(content: string) {
    messages.value.push({ role: "user", content });
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "user_message", content }));
    }
  }

  function interrupt() {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "interrupt" }));
    }
  }

  function close() {
    closed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      socket.close();
      socket = null;
    }
    isConnected.value = false;
    isStreaming.value = false;
  }

  // Connect immediately
  connect();

  return {
    messages,
    isConnected,
    isStreaming,
    send,
    interrupt,
    close,
  };
}
