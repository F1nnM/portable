<script setup lang="ts">
import type { ChatMessage, ToolUseEntry } from "~/types/chat";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";

const props = defineProps<{
  message: ChatMessage;
  isActive?: boolean;
}>();

const expandedThinking = ref<Set<number>>(new Set());
const toolsExpanded = ref(false);

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

const toolCount = computed(() => props.message.toolUse?.length ?? 0);
const hasContent = computed(() => !!props.message.content);
const hasThinking = computed(() => !!props.message.thinking?.length);
const hasTools = computed(() => toolCount.value > 0);
const hasResultMeta = computed(() => !!props.message.resultMeta);

// Don't render empty assistant messages that have no visible content
const shouldRender = computed(() => {
  if (props.message.role === "user") return true;
  return hasContent.value || hasThinking.value || hasTools.value || hasResultMeta.value;
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

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max)}...`;
}

function formatToolInput(tool: ToolUseEntry): string {
  try {
    const input = JSON.parse(tool.input);
    if (input.file_path) return input.file_path;
    if (input.command) return truncate(input.command, 80);
    if (input.pattern) return truncate(input.pattern, 80);
    if (input.query) return truncate(input.query, 80);
    if (input.url) return truncate(input.url, 80);
    if (input.path) return input.path;
    for (const val of Object.values(input)) {
      if (typeof val === "string" && val.length > 0) return truncate(val, 80);
    }
    return "";
  } catch {
    return truncate(tool.input, 80);
  }
}
</script>

<template>
  <div
    v-if="shouldRender"
    class="chat-message"
    :class="{
      'message-user': message.role === 'user',
      'message-assistant': message.role === 'assistant',
      'message-error': message.resultMeta?.isError,
    }"
  >
    <!-- User message -->
    <div v-if="message.role === 'user'" class="message-bubble user-bubble">
      <span>{{ message.content }}</span>
    </div>

    <!-- Assistant message -->
    <template v-else>
      <!-- Thinking blocks -->
      <div v-if="hasThinking" class="thinking-blocks">
        <div v-for="(block, idx) in message.thinking" :key="idx" class="thinking-block">
          <button class="collapse-toggle" @click="toggleThinking(idx)">
            <svg
              class="collapse-chevron"
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
            <span class="collapse-label">
              Thought for {{ formatThinkingDuration(block.durationMs) }}
            </span>
          </button>
          <div v-if="expandedThinking.has(idx)" class="thinking-content">
            {{ block.content }}
          </div>
        </div>
      </div>

      <!-- Tool use summary (collapsible) -->
      <div v-if="hasTools || isActive" class="tool-summary">
        <button class="collapse-toggle" @click="toolsExpanded = !toolsExpanded">
          <svg
            class="collapse-chevron"
            :class="{ expanded: toolsExpanded }"
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
          <span v-if="toolCount > 0" class="collapse-label">
            {{ toolCount }} tool{{ toolCount !== 1 ? "s" : "" }} used
          </span>
          <span v-else class="collapse-label">Working</span>
          <span v-if="isActive" class="tool-active-spinner" />
        </button>
        <div v-if="toolsExpanded && toolCount > 0" class="tool-list">
          <div v-for="(tool, idx) in message.toolUse" :key="idx" class="tool-item">
            <span class="tool-item-name">{{ tool.name }}</span>
            <span v-if="formatToolInput(tool)" class="tool-item-detail">{{
              formatToolInput(tool)
            }}</span>
          </div>
        </div>
      </div>

      <!-- Main text content (only if non-empty) -->
      <div v-if="hasContent" class="message-bubble assistant-bubble" v-html="renderedContent" />

      <!-- Result metadata footer -->
      <div
        v-if="hasResultMeta"
        class="result-meta"
        :class="{ 'result-meta-error': message.resultMeta!.isError }"
      >
        <span>{{ message.resultMeta!.numTurns }} turns</span>
        <span class="meta-sep">&middot;</span>
        <span>{{ formatDuration(message.resultMeta!.durationMs) }}</span>
        <span class="meta-sep">&middot;</span>
        <span>{{ formatCost(message.resultMeta!.costUsd) }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.chat-message {
  padding: var(--space-2) var(--space-4);
  max-width: 100%;
  word-break: break-word;
}

.chat-message + .chat-message {
  margin-top: var(--space-1);
}

/* User messages */
.message-user {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.user-bubble {
  background: var(--color-accent);
  color: var(--color-accent-text);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg);
  max-width: 85%;
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  box-shadow: 0 1px 3px rgba(217, 122, 62, 0.2);
}

/* Assistant messages */
.message-assistant {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

.assistant-bubble {
  width: 100%;
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text);
  padding: var(--space-3) var(--space-4);
  border-left: 3px solid var(--color-accent);
  background: var(--color-bg-surface);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}

/* Markdown rendering styles */
.assistant-bubble :deep(h1),
.assistant-bubble :deep(h2),
.assistant-bubble :deep(h3),
.assistant-bubble :deep(h4) {
  margin-top: var(--space-4);
  margin-bottom: var(--space-2);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-tight);
}

.assistant-bubble :deep(:first-child) {
  margin-top: 0;
}

.assistant-bubble :deep(h1) {
  font-size: var(--font-size-xl);
}

.assistant-bubble :deep(h2) {
  font-size: var(--font-size-lg);
}

.assistant-bubble :deep(p) {
  margin-bottom: var(--space-3);
}

.assistant-bubble :deep(p:last-child) {
  margin-bottom: 0;
}

.assistant-bubble :deep(ul),
.assistant-bubble :deep(ol) {
  padding-left: var(--space-5);
  margin-bottom: var(--space-3);
}

.assistant-bubble :deep(li) {
  margin-bottom: var(--space-1);
}

.assistant-bubble :deep(blockquote) {
  border-left: 3px solid var(--color-border-strong);
  padding-left: var(--space-4);
  margin: var(--space-3) 0;
  color: var(--color-text-secondary);
}

.assistant-bubble :deep(code) {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  background: var(--color-bg-inset);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
}

.assistant-bubble :deep(pre) {
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  overflow-x: auto;
  margin: var(--space-3) 0;
  -webkit-overflow-scrolling: touch;
}

.assistant-bubble :deep(pre code) {
  background: none;
  padding: 0;
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.assistant-bubble :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: var(--space-3) 0;
  overflow-x: auto;
  display: block;
}

.assistant-bubble :deep(th),
.assistant-bubble :deep(td) {
  border: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-3);
  text-align: left;
  font-size: var(--font-size-sm);
}

.assistant-bubble :deep(th) {
  background: var(--color-bg-inset);
  font-weight: var(--font-weight-medium);
}

.assistant-bubble :deep(a) {
  color: var(--color-accent);
  text-decoration: underline;
}

.assistant-bubble :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: var(--space-4) 0;
}

/* Shared collapse toggle (thinking + tools) */
.collapse-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
  background: var(--color-bg-inset);
  min-height: 28px;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.collapse-toggle:hover {
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
}

.collapse-chevron {
  width: 12px;
  height: 12px;
  transition: transform var(--transition-base);
  flex-shrink: 0;
}

.collapse-chevron.expanded {
  transform: rotate(90deg);
}

.collapse-label {
  font-style: italic;
  font-size: var(--font-size-xs);
}

/* Thinking blocks */
.thinking-blocks {
  width: 100%;
}

.thinking-block {
  margin-bottom: var(--space-1);
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

/* Tool summary */
.tool-summary {
  width: 100%;
}

.tool-active-spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.tool-list {
  margin-top: var(--space-1);
  padding-left: var(--space-3);
  display: flex;
  flex-direction: column;
}

.tool-item {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: 3px 0;
  font-size: var(--font-size-xs);
  line-height: var(--line-height-tight);
  min-height: 0;
}

.tool-item-name {
  font-family: var(--font-mono);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.tool-item-detail {
  font-family: var(--font-mono);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Result metadata */
.result-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  color: var(--color-text-muted);
  background: var(--color-bg-inset);
  border-radius: var(--radius-full);
}

.result-meta-error {
  color: var(--color-danger);
  background: var(--color-danger-tint);
}

.message-error .assistant-bubble {
  border-left-color: var(--color-danger);
}

.meta-sep {
  opacity: 0.3;
}
</style>
