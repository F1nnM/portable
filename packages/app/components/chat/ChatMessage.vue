<script setup lang="ts">
import type { ChatMessage } from "~/types/chat";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";

const props = defineProps<{
  message: ChatMessage;
}>();

const expandedThinking = ref<Set<number>>(new Set());

function toggleThinking(index: number) {
  const next = new Set(expandedThinking.value);
  if (next.has(index)) {
    next.delete(index);
  } else {
    next.add(index);
  }
  expandedThinking.value = next;
}

const marked = new Marked(
  markedHighlight({
    emptyLangClass: "hljs",
    langPrefix: "hljs language-",
    highlight(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),
);

marked.setOptions({
  breaks: true,
  gfm: true,
});

const renderedContent = computed(() => {
  if (props.message.role === "user") {
    return props.message.content;
  }
  const raw = marked.parse(props.message.content);
  if (typeof raw === "string") {
    return DOMPurify.sanitize(raw);
  }
  return "";
});

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatThinkingDuration(ms?: number): string {
  if (!ms) return "a moment";
  const seconds = Math.round(ms / 1000);
  return `${seconds}s`;
}
</script>

<template>
  <div
    class="chat-message"
    :class="{
      'message-user': message.role === 'user',
      'message-assistant': message.role === 'assistant',
    }"
  >
    <!-- Thinking blocks (before main content) -->
    <div v-if="message.thinking?.length" class="thinking-blocks">
      <div v-for="(block, idx) in message.thinking" :key="idx" class="thinking-block">
        <button class="thinking-toggle" @click="toggleThinking(idx)">
          <svg
            class="thinking-chevron"
            :class="{ expanded: expandedThinking.has(idx) }"
            viewBox="0 0 20 20"
            fill="currentColor"
            width="14"
            height="14"
          >
            <path
              fill-rule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clip-rule="evenodd"
            />
          </svg>
          <span class="thinking-label"
            >Thought for {{ formatThinkingDuration(block.durationMs) }}</span
          >
        </button>
        <div v-if="expandedThinking.has(idx)" class="thinking-content">
          {{ block.content }}
        </div>
      </div>
    </div>

    <!-- Main message content -->
    <div class="message-content">
      <div v-if="message.role === 'assistant'" v-html="renderedContent" />
      <span v-else>{{ message.content }}</span>
    </div>

    <!-- Tool use entries -->
    <div v-if="message.toolUse?.length" class="tool-use-list">
      <div v-for="(tool, idx) in message.toolUse" :key="idx" class="tool-use-entry">
        <span class="tool-name">{{ tool.name }}</span>
        <code class="tool-input">{{ tool.input }}</code>
      </div>
    </div>

    <!-- Result metadata footer -->
    <div
      v-if="message.resultMeta"
      class="result-meta"
      :class="{ 'result-meta-error': message.resultMeta.isError }"
    >
      <span>{{ message.resultMeta.numTurns }} turns</span>
      <span class="meta-separator">-</span>
      <span>{{ formatDuration(message.resultMeta.durationMs) }}</span>
      <span class="meta-separator">-</span>
      <span>{{ formatCost(message.resultMeta.costUsd) }}</span>
    </div>
  </div>
</template>

<style scoped>
.chat-message {
  padding: var(--space-3) var(--space-4);
  max-width: 100%;
  word-break: break-word;
}

.message-user {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-user .message-content {
  background: var(--color-accent-tint);
  color: var(--color-text);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md) var(--radius-md) var(--radius-sm) var(--radius-md);
  max-width: 85%;
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
}

.message-assistant {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.message-assistant .message-content {
  width: 100%;
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text);
}

/* Markdown rendering styles (assistant) */
.message-assistant .message-content :deep(h1),
.message-assistant .message-content :deep(h2),
.message-assistant .message-content :deep(h3),
.message-assistant .message-content :deep(h4) {
  margin-top: var(--space-4);
  margin-bottom: var(--space-2);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-tight);
}

.message-assistant .message-content :deep(h1) {
  font-size: var(--font-size-xl);
}

.message-assistant .message-content :deep(h2) {
  font-size: var(--font-size-lg);
}

.message-assistant .message-content :deep(p) {
  margin-bottom: var(--space-3);
}

.message-assistant .message-content :deep(p:last-child) {
  margin-bottom: 0;
}

.message-assistant .message-content :deep(ul),
.message-assistant .message-content :deep(ol) {
  padding-left: var(--space-5);
  margin-bottom: var(--space-3);
}

.message-assistant .message-content :deep(li) {
  margin-bottom: var(--space-1);
}

.message-assistant .message-content :deep(blockquote) {
  border-left: 3px solid var(--color-border-strong);
  padding-left: var(--space-4);
  margin: var(--space-3) 0;
  color: var(--color-text-secondary);
}

.message-assistant .message-content :deep(code) {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  background: var(--color-bg-inset);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
}

.message-assistant .message-content :deep(pre) {
  background: var(--color-bg-inset);
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-4);
  overflow-x: auto;
  margin: var(--space-3) 0;
  -webkit-overflow-scrolling: touch;
}

.message-assistant .message-content :deep(pre code) {
  background: none;
  padding: 0;
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.message-assistant .message-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: var(--space-3) 0;
  overflow-x: auto;
  display: block;
}

.message-assistant .message-content :deep(th),
.message-assistant .message-content :deep(td) {
  border: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-3);
  text-align: left;
  font-size: var(--font-size-sm);
}

.message-assistant .message-content :deep(th) {
  background: var(--color-bg-inset);
  font-weight: var(--font-weight-medium);
}

.message-assistant .message-content :deep(a) {
  color: var(--color-accent);
  text-decoration: underline;
}

.message-assistant .message-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: var(--space-4) 0;
}

/* Thinking blocks */
.thinking-blocks {
  width: 100%;
  margin-bottom: var(--space-2);
}

.thinking-block {
  margin-bottom: var(--space-1);
}

.thinking-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.thinking-toggle:hover {
  background: var(--color-bg-inset);
}

.thinking-chevron {
  width: 14px;
  height: 14px;
  transition: transform var(--transition-base);
  flex-shrink: 0;
}

.thinking-chevron.expanded {
  transform: rotate(90deg);
}

.thinking-label {
  font-style: italic;
}

.thinking-content {
  padding: var(--space-2) var(--space-4);
  margin-top: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-base);
  border-left: 2px solid var(--color-border);
  white-space: pre-wrap;
}

/* Tool use entries */
.tool-use-list {
  width: 100%;
  margin-top: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.tool-use-entry {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-inset);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}

.tool-name {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.tool-input {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* Result metadata */
.result-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-1) 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.result-meta-error {
  color: var(--color-danger);
}

.meta-separator {
  opacity: 0.5;
}
</style>
