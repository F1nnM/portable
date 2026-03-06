<script setup lang="ts">
import type { ChatMessage as ChatMessageType } from "../composables/useWebSocket";
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import ChatInput from "../components/ChatInput.vue";
import ChatMessage from "../components/ChatMessage.vue";
import SessionList from "../components/SessionList.vue";
import { useSessions } from "../composables/useSessions";
import { useWebSocket } from "../composables/useWebSocket";

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
