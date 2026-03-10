<script setup lang="ts">
import type { ChatMessage } from "../composables/useWebSocket";
import { computed, ref } from "vue";

const props = defineProps<{
  message: ChatMessage;
}>();

const toolsExpanded = ref(false);

const expandedTools = ref<Set<number>>(new Set());

const toolCount = computed(() => props.message.toolUse?.length ?? 0);

function toggleToolsDisclosure() {
  toolsExpanded.value = !toolsExpanded.value;
}

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
      <button class="tools-disclosure" @click="toggleToolsDisclosure">
        <span class="disclosure-triangle" :class="{ expanded: toolsExpanded }">&#9656;</span>
        <span class="disclosure-label">{{ toolCount }} tool{{ toolCount !== 1 ? "s" : "" }} used</span>
      </button>
      <div v-if="toolsExpanded" class="tools-detail">
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
  </div>
</template>

<style scoped>
.chat-message {
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.6;
  word-break: break-word;
}

.message-user {
  margin-left: auto;
  max-width: 80%;
  background: var(--color-accent-tint);
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-4);
  color: var(--color-text);
}

.message-assistant {
  width: 100%;
  color: var(--color-text);
}

.message-content {
  white-space: pre-wrap;
}

.tool-use-list {
  margin-top: var(--space-3);
}

.tools-disclosure {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: 13px;
  cursor: pointer;
  padding: var(--space-1) 0;
}

.disclosure-triangle {
  display: inline-block;
  font-size: 10px;
  transition: transform var(--transition-fast);
}

.disclosure-triangle.expanded {
  transform: rotate(90deg);
}

.disclosure-label {
  color: var(--color-text-muted);
}

.tools-detail {
  margin-top: var(--space-2);
  padding-left: var(--space-3);
  border-left: 2px solid var(--color-border-subtle);
}

.tool-use-block {
  margin-top: var(--space-1);
  overflow: hidden;
}

.tool-use-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-1) var(--space-2);
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.tool-use-header:hover {
  color: var(--color-text-secondary);
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
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.4;
  overflow-x: auto;
  border-radius: var(--radius-sm);
}
</style>
