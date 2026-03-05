<script setup lang="ts">
import type { ChatMessage } from "../composables/useWebSocket";
import { ref } from "vue";

defineProps<{
  message: ChatMessage;
}>();

const expandedTools = ref<Set<number>>(new Set());

function toggleTool(index: number) {
  if (expandedTools.value.has(index)) {
    expandedTools.value.delete(index);
  } else {
    expandedTools.value.add(index);
  }
}
</script>

<template>
  <div
    class="chat-message"
    :class="{
      'message-user': message.role === 'user',
      'message-assistant': message.role === 'assistant',
    }"
    data-testid="chat-message"
  >
    <div class="message-content">
      {{ message.content }}
    </div>
    <div v-if="message.toolUse && message.toolUse.length > 0" class="tool-use-list">
      <div
        v-for="(tool, index) in message.toolUse"
        :key="index"
        class="tool-use-block"
        data-testid="tool-use-block"
      >
        <button class="tool-use-header" @click="toggleTool(index)">
          <span class="tool-use-chevron">{{ expandedTools.has(index) ? "-" : "+" }}</span>
          <span class="tool-use-name">{{ tool.name }}</span>
        </button>
        <pre v-if="expandedTools.has(index)" class="tool-use-input">{{ tool.input }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-message {
  padding: 8px 12px;
  margin: 4px 0;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.5;
  max-width: 85%;
  word-break: break-word;
}

.message-user {
  margin-left: auto;
  background: rgba(88, 166, 255, 0.15);
  border: 1px solid rgba(88, 166, 255, 0.25);
  border-radius: 4px;
  color: var(--color-text);
}

.message-assistant {
  margin-right: auto;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
}

.message-content {
  white-space: pre-wrap;
}

.tool-use-list {
  margin-top: 8px;
}

.tool-use-block {
  border: 1px solid var(--color-border);
  border-radius: 2px;
  margin-top: 4px;
  overflow: hidden;
}

.tool-use-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 8px;
  background: var(--color-bg-elevated);
  border: none;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  cursor: pointer;
  text-align: left;
}

.tool-use-header:hover {
  color: var(--color-text);
}

.tool-use-chevron {
  width: 12px;
  text-align: center;
  flex-shrink: 0;
}

.tool-use-name {
  color: var(--color-accent);
}

.tool-use-input {
  margin: 0;
  padding: 8px;
  background: var(--color-bg);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  line-height: 1.4;
  overflow-x: auto;
  border-top: 1px solid var(--color-border);
}
</style>
