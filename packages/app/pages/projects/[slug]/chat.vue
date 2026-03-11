<script setup lang="ts">
import type { ChatMessage, ChatSession } from "~/types/chat";

const route = useRoute();
const slug = computed(() => route.params.slug as string);

// State: session list vs active chat
const activeSessionId = ref<string | null>(null);
const messages = ref<ChatMessage[]>([]);
const isStreaming = ref(false);
const sessions = ref<ChatSession[]>([]);
const activeSessions = ref<string[]>([]);
const sessionsLoading = ref(true);

// WebSocket connection state
const ws = ref<WebSocket | null>(null);
const wsConnected = ref(false);

// Scroll container ref
const messagesContainer = ref<HTMLElement | null>(null);

// Build the proxy base URL for pod API calls
function podApiUrl(path: string): string {
  return `/api/projects/${slug.value}/pod${path}`;
}

// Fetch sessions from the pod server
async function fetchSessions() {
  sessionsLoading.value = true;
  try {
    const data = await $fetch<{ sessions: ChatSession[] }>(podApiUrl("/api/sessions"));
    sessions.value = data.sessions || [];
  } catch {
    sessions.value = [];
  } finally {
    sessionsLoading.value = false;
  }
}

// Fetch active sessions
async function fetchActiveSessions() {
  try {
    const data = await $fetch<{ activeSessionIds: string[] }>(podApiUrl("/api/sessions/active"));
    activeSessions.value = data.activeSessionIds || [];
  } catch {
    activeSessions.value = [];
  }
}

// Load messages for a session
async function loadSessionMessages(sessionId: string) {
  try {
    const data = await $fetch<{ messages: ChatMessage[] }>(
      podApiUrl(`/api/sessions/${sessionId}/messages`),
    );
    messages.value = data.messages || [];
  } catch {
    messages.value = [];
  }
}

// Delete a session
async function deleteSession(sessionId: string) {
  try {
    await $fetch(podApiUrl(`/api/sessions/${sessionId}`), { method: "DELETE" });
    sessions.value = sessions.value.filter((s) => s.sessionId !== sessionId);
  } catch {
    // Silently fail
  }
}

// Connect WebSocket
function connectWs(sessionId?: string) {
  disconnectWs();

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const baseUrl = `${protocol}//${window.location.host}`;
  const wsPath = sessionId
    ? `${podApiUrl("/ws")}?session=${encodeURIComponent(sessionId)}`
    : podApiUrl("/ws");

  const socket = new WebSocket(`${baseUrl}${wsPath}`);

  socket.onopen = () => {
    wsConnected.value = true;
  };

  socket.onclose = () => {
    wsConnected.value = false;
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWsMessage(data);
    } catch {
      // Invalid JSON
    }
  };

  ws.value = socket;
}

function disconnectWs() {
  if (ws.value) {
    ws.value.close();
    ws.value = null;
    wsConnected.value = false;
  }
}

interface WsMessage {
  type: string;
  event?: {
    type: string;
    delta?: { text?: string };
    content?: Array<{ type: string; text?: string; name?: string; input?: unknown }>;
  };
  sessionId?: string;
  message?: string;
}

// Handle incoming WebSocket messages
function handleWsMessage(data: WsMessage) {
  switch (data.type) {
    case "query_start":
      isStreaming.value = true;
      // Add empty assistant message placeholder
      messages.value.push({ role: "assistant", content: "" });
      break;

    case "sdk_event":
      handleSdkEvent(data.event);
      break;

    case "query_end":
      isStreaming.value = false;
      break;

    case "session_info":
      if (data.sessionId) {
        activeSessionId.value = data.sessionId;
      }
      break;

    case "error":
      isStreaming.value = false;
      break;
  }
}

function handleSdkEvent(event: WsMessage["event"]) {
  if (!event) return;

  const lastMsg = messages.value[messages.value.length - 1];
  if (!lastMsg || lastMsg.role !== "assistant") return;

  // Handle text delta events
  if (event.type === "assistant" && event.delta?.text) {
    lastMsg.content += event.delta.text;
    scrollToBottom();
  }

  // Handle content block with tool use
  if (event.type === "assistant" && event.content) {
    for (const block of event.content) {
      if (block.type === "tool_use" && block.name) {
        if (!lastMsg.toolUse) lastMsg.toolUse = [];
        lastMsg.toolUse.push({
          name: block.name,
          input: typeof block.input === "string" ? block.input : JSON.stringify(block.input),
        });
      }
    }
  }
}

function scrollToBottom() {
  nextTick(() => {
    const container = messagesContainer.value;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  });
}

// Send a message
function sendMessage(content: string) {
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) return;

  messages.value.push({ role: "user", content });
  scrollToBottom();

  ws.value.send(JSON.stringify({ type: "user_message", content }));
}

// Interrupt current query
function interruptQuery() {
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) return;
  ws.value.send(JSON.stringify({ type: "interrupt" }));
}

// Select a session from the list
async function selectSession(sessionId: string) {
  activeSessionId.value = sessionId;
  await loadSessionMessages(sessionId);
  connectWs(sessionId);
  scrollToBottom();
}

// Start a new conversation
function startNewSession() {
  activeSessionId.value = "new";
  messages.value = [];
  connectWs();
}

// Go back to session list
function goBack() {
  disconnectWs();
  activeSessionId.value = null;
  messages.value = [];
  isStreaming.value = false;
  fetchSessions();
  fetchActiveSessions();
}

// Initial fetch
onMounted(() => {
  fetchSessions();
  fetchActiveSessions();
});

onUnmounted(() => {
  disconnectWs();
});
</script>

<template>
  <div class="chat-page">
    <!-- Session list view -->
    <template v-if="!activeSessionId">
      <div v-if="sessionsLoading" class="loading-container">
        <div class="loading-spinner" />
      </div>
      <ChatSessionList
        v-else
        :sessions="sessions"
        :active-sessions="activeSessions"
        @select="selectSession"
        @new-session="startNewSession"
        @delete="deleteSession"
      />
    </template>

    <!-- Active chat view -->
    <template v-else>
      <div class="chat-view">
        <!-- Chat header with back button -->
        <div class="chat-header">
          <button class="btn-back" aria-label="Back to sessions" @click="goBack">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="12 4 6 10 12 16" />
            </svg>
          </button>
          <span class="chat-title">{{
            activeSessionId === "new" ? "New Conversation" : "Conversation"
          }}</span>
        </div>

        <!-- Messages area -->
        <div ref="messagesContainer" class="messages-container">
          <div v-if="messages.length === 0 && !isStreaming" class="chat-empty">
            <p class="chat-empty-text">Send a message to start the conversation.</p>
          </div>

          <ChatMessage v-for="(msg, idx) in messages" :key="idx" :message="msg" />

          <!-- Streaming indicator -->
          <div
            v-if="isStreaming && messages[messages.length - 1]?.content === ''"
            class="streaming-indicator"
          >
            <span class="streaming-dot" />
            <span class="streaming-dot" />
            <span class="streaming-dot" />
          </div>
        </div>

        <!-- Input area -->
        <ChatInput :is-streaming="isStreaming" @send="sendMessage" @interrupt="interruptQuery" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Chat view layout */
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  flex-shrink: 0;
}

.btn-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.btn-back:hover {
  color: var(--color-text);
  background: var(--color-bg-inset);
}

.btn-back svg {
  width: 20px;
  height: 20px;
}

.chat-title {
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

/* Messages */
.messages-container {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: var(--space-3) 0;
}

.chat-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: var(--space-7);
}

.chat-empty-text {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  text-align: center;
}

/* Streaming indicator */
.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: var(--space-3) var(--space-4);
}

.streaming-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--color-text-muted);
  animation: dotPulse 1.4s ease-in-out infinite;
}

.streaming-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.streaming-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dotPulse {
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
