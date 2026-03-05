<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import ChatInput from "../components/ChatInput.vue";
import ChatMessage from "../components/ChatMessage.vue";
import { useWebSocket } from "../composables/useWebSocket";

const ws = useWebSocket();
const messageListRef = ref<HTMLDivElement | null>(null);

function scrollToBottom() {
  nextTick(() => {
    const el = messageListRef.value;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  });
}

watch(
  () => ws.messages.value.length,
  () => {
    scrollToBottom();
  },
);

watch(
  () => ws.isStreaming.value,
  () => {
    scrollToBottom();
  },
);

function handleSend(content: string) {
  ws.send(content);
  scrollToBottom();
}

function handleInterrupt() {
  ws.interrupt();
}

onBeforeUnmount(() => {
  ws.close();
});
</script>

<template>
  <div class="view chat-view" data-testid="chat-view">
    <div ref="messageListRef" class="message-list">
      <div v-if="ws.messages.value.length === 0" class="empty-state">
        <span class="empty-label">Start a conversation</span>
      </div>
      <ChatMessage v-for="(msg, index) in ws.messages.value" :key="index" :message="msg" />
      <div
        v-if="ws.isStreaming.value"
        class="streaming-indicator"
        data-testid="streaming-indicator"
      >
        <span class="streaming-dot" />
        <span class="streaming-dot" />
        <span class="streaming-dot" />
      </div>
    </div>
    <ChatInput
      :is-streaming="ws.isStreaming.value"
      @send="handleSend"
      @interrupt="handleInterrupt"
    />
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
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
