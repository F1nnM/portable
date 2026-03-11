import type { ActiveTool, ChatMessage } from "~/types/chat";

interface StreamState {
  currentBlockType: string | null;
  currentBlockIndex: number;
  pendingText: string;
  pendingThinking: string;
  pendingToolName: string;
  pendingToolId: string;
  pendingToolInput: string;
  hasCreatedAssistantMessage: boolean;
}

function createStreamState(): StreamState {
  return {
    currentBlockType: null,
    currentBlockIndex: -1,
    pendingText: "",
    pendingThinking: "",
    pendingToolName: "",
    pendingToolId: "",
    pendingToolInput: "",
    hasCreatedAssistantMessage: false,
  };
}

const RECONNECT_DELAY_MS = 2000;

export function useWebSocket(slug: string) {
  const messages = ref<ChatMessage[]>([]);
  const isConnected = ref(false);
  const isStreaming = ref(false);
  const sessionId = ref<string | null>(null);
  const error = ref<string | null>(null);
  const activeTools = ref<ActiveTool[]>([]);

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let shouldReconnect = true;
  let streamState = createStreamState();

  function buildWsUrl(sid?: string | null): string {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const effectiveSessionId = sid ?? sessionId.value;
    const query = effectiveSessionId ? `?session=${effectiveSessionId}` : "";
    return `${protocol}//${host}/api/projects/${slug}/pod/ws${query}`;
  }

  function getOrCreateAssistantMessage(): ChatMessage {
    if (streamState.hasCreatedAssistantMessage) {
      // Return the last assistant message
      const last = messages.value[messages.value.length - 1];
      if (last && last.role === "assistant") {
        return last;
      }
    }
    // Create a new assistant message
    const msg: ChatMessage = {
      role: "assistant",
      content: "",
    };
    messages.value.push(msg);
    streamState.hasCreatedAssistantMessage = true;
    return msg;
  }

  function handleStreamEvent(event: Record<string, unknown>) {
    const eventType = event.type as string;

    if (eventType === "content_block_start") {
      const block = event.content_block as Record<string, unknown>;
      const blockType = block?.type as string;
      streamState.currentBlockType = blockType;
      streamState.currentBlockIndex = event.index as number;

      if (blockType === "text") {
        streamState.pendingText = "";
      } else if (blockType === "thinking") {
        streamState.pendingThinking = "";
        const msg = getOrCreateAssistantMessage();
        if (!msg.thinking) msg.thinking = [];
        msg.thinking.push({ content: "" });
      } else if (blockType === "tool_use") {
        streamState.pendingToolName = (block.name as string) || "";
        streamState.pendingToolId = (block.id as string) || "";
        streamState.pendingToolInput = "";
      }
    } else if (eventType === "content_block_delta") {
      const delta = event.delta as Record<string, unknown>;
      const deltaType = delta?.type as string;

      if (deltaType === "text_delta") {
        const text = delta.text as string;
        streamState.pendingText += text;
        const msg = getOrCreateAssistantMessage();
        msg.content = streamState.pendingText;
      } else if (deltaType === "thinking_delta") {
        const thinking = delta.thinking as string;
        streamState.pendingThinking += thinking;
        const msg = getOrCreateAssistantMessage();
        if (msg.thinking && msg.thinking.length > 0) {
          msg.thinking[msg.thinking.length - 1].content = streamState.pendingThinking;
        }
      } else if (deltaType === "input_json_delta") {
        streamState.pendingToolInput += delta.partial_json as string;
      }
    } else if (eventType === "content_block_stop") {
      if (streamState.currentBlockType === "tool_use") {
        const msg = getOrCreateAssistantMessage();
        if (!msg.toolUse) msg.toolUse = [];
        msg.toolUse.push({
          name: streamState.pendingToolName,
          input: streamState.pendingToolInput,
        });
      }
      streamState.currentBlockType = null;
    }
  }

  function processAssistantMessage(message: Record<string, unknown>) {
    const content = message.content as Array<Record<string, unknown>>;
    if (!content || !Array.isArray(content)) return;

    const msg = getOrCreateAssistantMessage();

    const textBlocks = content.filter((b) => b.type === "text");
    const thinkingBlocks = content.filter((b) => b.type === "thinking");

    // Set text from text blocks (takes latest turn's text)
    const text = textBlocks.map((b) => b.text as string).join("");
    if (text) {
      msg.content = text;
      streamState.pendingText = text;
    }

    // Set thinking only if not already set (keep first turn's thinking)
    if (thinkingBlocks.length > 0 && !msg.thinking?.length) {
      msg.thinking = thinkingBlocks.map((b) => ({
        content: (b.thinking as string) || "",
      }));
    }

    // Also extract tool_use blocks (for replay/reconnect scenarios where
    // stream events are not received).
    const toolBlocks = content.filter((b) => b.type === "tool_use");
    if (toolBlocks.length > 0) {
      if (!msg.toolUse) msg.toolUse = [];
      for (const b of toolBlocks) {
        const name = b.name as string;
        const input = typeof b.input === "string" ? b.input : JSON.stringify(b.input ?? {});
        // Avoid duplicates if stream events already added this tool
        if (!msg.toolUse.some((t) => t.name === name && t.input === input)) {
          msg.toolUse.push({ name, input });
        }
      }
    }
  }

  function processResultMessage(event: Record<string, unknown>) {
    // Attach result metadata to the last assistant message
    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg && lastMsg.role === "assistant") {
      lastMsg.resultMeta = {
        costUsd: (event.total_cost_usd as number) ?? 0,
        durationMs: (event.duration_ms as number) ?? 0,
        numTurns: (event.num_turns as number) ?? 0,
        isError: (event.is_error as boolean) ?? false,
      };
    }
  }

  function processToolProgress(event: Record<string, unknown>) {
    const toolId = event.tool_use_id as string;
    const toolName = event.tool_name as string;
    const elapsed = event.elapsed_time_seconds as number;

    const existing = activeTools.value.find((t) => t.id === toolId);
    if (existing) {
      existing.elapsed = elapsed;
    } else {
      activeTools.value.push({ id: toolId, name: toolName, elapsed });
    }
  }

  function handleMessage(data: string) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    const type = parsed.type as string;

    switch (type) {
      case "query_start":
        isStreaming.value = true;
        streamState = createStreamState();
        activeTools.value = [];
        error.value = null;
        break;

      case "query_end":
        isStreaming.value = false;
        activeTools.value = [];
        break;

      case "sdk_event": {
        const event = parsed.event as Record<string, unknown>;
        if (!event) break;

        if (event.type === "assistant" && event.message) {
          processAssistantMessage(event.message as Record<string, unknown>);
        } else if (event.type === "stream_event" && event.event) {
          handleStreamEvent(event.event as Record<string, unknown>);
        } else if (event.type === "result") {
          processResultMessage(event);
        } else if (event.type === "tool_progress") {
          processToolProgress(event);
        } else if (event.type === "user") {
          // Turn boundary: synthetic user message with tool results
          // Reset text/block state but keep the same message so tool uses accumulate
          streamState.pendingText = "";
          streamState.pendingThinking = "";
          streamState.pendingToolName = "";
          streamState.pendingToolId = "";
          streamState.pendingToolInput = "";
          streamState.currentBlockType = null;
          streamState.currentBlockIndex = -1;
          // hasCreatedAssistantMessage stays true -- same message across turns
          activeTools.value = [];
        }
        break;
      }

      case "session_info":
        sessionId.value = parsed.sessionId as string;
        break;

      case "error":
        error.value = parsed.message as string;
        break;

      case "replay_start":
      case "replay_end":
        break;
    }
  }

  function createConnection(sid?: string | null) {
    const url = buildWsUrl(sid);
    ws = new WebSocket(url);

    ws.onopen = () => {
      isConnected.value = true;
      error.value = null;
    };

    ws.onmessage = (event: MessageEvent) => {
      handleMessage(typeof event.data === "string" ? event.data : String(event.data));
    };

    ws.onclose = () => {
      isConnected.value = false;
      if (shouldReconnect) {
        reconnectTimer = setTimeout(() => {
          createConnection(sessionId.value);
        }, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  function connect(sid?: string | null, initialMessages?: ChatMessage[]) {
    shouldReconnect = true;
    streamState = createStreamState();
    sessionId.value = sid ?? null;
    if (initialMessages) {
      messages.value = [...initialMessages];
    }
    createConnection(sid);
  }

  function disconnect() {
    shouldReconnect = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.onclose = null;
      ws.close();
      ws = null;
    }
    isConnected.value = false;
    isStreaming.value = false;
  }

  function send(content: string) {
    // Add user message to the messages array
    messages.value.push({ role: "user", content });

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "user_message", content }));
    }
  }

  function interrupt() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "interrupt" }));
    }
  }

  function resetMessages() {
    messages.value = [];
  }

  return {
    messages,
    isConnected,
    isStreaming,
    sessionId,
    error,
    activeTools,
    connect,
    disconnect,
    send,
    interrupt,
    resetMessages,
  };
}
