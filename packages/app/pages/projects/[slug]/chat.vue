<script setup lang="ts">
import type { ChatMessage, ChatSession } from "~/types/chat";

const route = useRoute();
const slug = computed(() => route.params.slug as string);

// State: session list vs active chat
const activeSessionId = ref<string | null>(null);
const sessions = ref<ChatSession[]>([]);
const activeSessions = ref<string[]>([]);
const sessionsLoading = ref(true);

// WebSocket composable
const {
  messages,
  isStreaming,
  sessionId: wsSessionId,
  connect: wsConnect,
  disconnect: wsDisconnect,
  send: wsSend,
  interrupt: wsInterrupt,
  resetMessages,
} = useWebSocket(slug.value);

// Scroll container ref
const messagesContainer = ref<HTMLElement | null>(null);

// Keyboard-aware layout: shrink chat view when virtual keyboard opens
const keyboardOffset = ref(0);

function onViewportResize() {
  if (!window.visualViewport) return;
  const keyboardHeight =
    window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop;
  // The tab bar (64px) is already behind the keyboard, so only offset by the overlap
  const TABBAR_HEIGHT = 64;
  keyboardOffset.value = Math.max(0, keyboardHeight - TABBAR_HEIGHT);
}

// Show streaming indicator when streaming but no assistant content yet
const showStreamingIndicator = computed(() => {
  if (!isStreaming.value) return false;
  const last = messages.value[messages.value.length - 1];
  if (!last || last.role !== "assistant") return true;
  return !last.content && !last.thinking?.length && !last.toolUse?.length;
});

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

// Merge consecutive assistant messages into one (matches live streaming behavior)
function mergeAssistantMessages(msgs: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  for (const msg of msgs) {
    // Filter out synthetic user messages (tool results with no text)
    if (msg.role === "user" && !msg.content) continue;

    const prev = result[result.length - 1];
    if (msg.role === "assistant" && prev?.role === "assistant") {
      // Merge into previous: accumulate tools, keep latest text, keep first thinking
      if (msg.toolUse) {
        if (!prev.toolUse) prev.toolUse = [];
        prev.toolUse.push(...msg.toolUse);
      }
      if (msg.content) {
        prev.content = msg.content;
      }
      if (msg.thinking && !prev.thinking?.length) {
        prev.thinking = msg.thinking;
      }
      if (msg.resultMeta) {
        prev.resultMeta = msg.resultMeta;
      }
    } else {
      result.push({ ...msg });
    }
  }
  return result;
}

// Load messages for a session
async function loadSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  try {
    const data = await $fetch<{ messages: ChatMessage[] }>(
      podApiUrl(`/api/sessions/${sessionId}/messages`),
    );
    return mergeAssistantMessages(data.messages || []);
  } catch {
    return [];
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

function scrollToBottom() {
  nextTick(() => {
    const container = messagesContainer.value;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  });
}

// Auto-scroll on new messages
watch(
  () => messages.value.length,
  () => scrollToBottom(),
);

// Auto-scroll during streaming as content updates
watch(
  () => messages.value[messages.value.length - 1]?.content,
  () => {
    if (isStreaming.value) scrollToBottom();
  },
);

// Auto-scroll when keyboard opens/closes
watch(keyboardOffset, () => scrollToBottom());

// Update activeSessionId when server assigns a session ID
watch(wsSessionId, (newId) => {
  if (newId && activeSessionId.value === "new") {
    activeSessionId.value = newId;
  }
});

// Select a session from the list
async function selectSession(sessionId: string) {
  activeSessionId.value = sessionId;
  const loadedMessages = await loadSessionMessages(sessionId);
  wsConnect(sessionId, loadedMessages);
  scrollToBottom();
}

// Start a new conversation
function startNewSession() {
  activeSessionId.value = "new";
  resetMessages();
  wsConnect();
}

// Send a message
function sendMessage(content: string) {
  wsSend(content);
  scrollToBottom();
}

// Go back to session list
function goBack() {
  wsDisconnect();
  resetMessages();
  activeSessionId.value = null;
  fetchSessions();
  fetchActiveSessions();
}

// Initial fetch
onMounted(() => {
  fetchSessions();
  fetchActiveSessions();
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onViewportResize);
    window.visualViewport.addEventListener("scroll", onViewportResize);
  }
});

onUnmounted(() => {
  wsDisconnect();
  if (window.visualViewport) {
    window.visualViewport.removeEventListener("resize", onViewportResize);
    window.visualViewport.removeEventListener("scroll", onViewportResize);
  }
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
      <div
        class="chat-view"
        :style="keyboardOffset > 0 ? { height: `calc(100% - ${keyboardOffset}px)` } : undefined"
      >
        <!-- Floating back button -->
        <button class="btn-back-floating" aria-label="Back to sessions" @click="goBack">
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

        <!-- Messages area -->
        <div ref="messagesContainer" class="messages-container">
          <div v-if="messages.length === 0 && !isStreaming" class="chat-empty">
            <p class="chat-empty-text">Send a message to start the conversation.</p>
          </div>

          <ChatMessage
            v-for="(msg, idx) in messages"
            :key="idx"
            :message="msg"
            :is-active="isStreaming && idx === messages.length - 1"
          />

          <!-- Streaming indicator -->
          <div v-if="showStreamingIndicator" class="streaming-indicator">
            <span class="streaming-dot" />
            <span class="streaming-dot" />
            <span class="streaming-dot" />
          </div>
        </div>

        <!-- Input area -->
        <ChatInput :is-streaming="isStreaming" @send="sendMessage" @interrupt="wsInterrupt" />
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
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.btn-back-floating {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  border: none;
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  box-shadow:
    0 2px 8px rgba(44, 40, 37, 0.08),
    0 0 0 1px rgba(44, 40, 37, 0.04);
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    transform var(--transition-fast);
}

.btn-back-floating:hover {
  color: var(--color-text);
  background: var(--color-bg-elevated);
}

.btn-back-floating:active {
  transform: scale(0.92);
}

.btn-back-floating svg {
  width: 20px;
  height: 20px;
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
