<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

const props = defineProps<{
  isStreaming: boolean;
}>();

const emit = defineEmits<{
  send: [content: string];
  interrupt: [];
}>();

const text = ref("");
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const canSend = computed(() => text.value.trim().length > 0 && !props.isStreaming);

function adjustHeight() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = "auto";
  const lineHeight = 20;
  const maxHeight = lineHeight * 6;
  el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
}

watch(text, () => {
  nextTick(adjustHeight);
});

function handleSend() {
  const content = text.value.trim();
  if (!content || props.isStreaming) return;
  emit("send", content);
  text.value = "";
  nextTick(adjustHeight);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
}

function handleInterrupt() {
  emit("interrupt");
}
</script>

<template>
  <div class="chat-input">
    <div class="input-row">
      <textarea
        ref="textareaRef"
        v-model="text"
        class="input-textarea"
        placeholder="Message..."
        rows="1"
        data-testid="chat-textarea"
        @keydown="handleKeydown"
      />
      <button
        v-if="!isStreaming"
        class="send-btn"
        :disabled="!canSend"
        data-testid="send-button"
        @click="handleSend"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="btn-icon">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 12l0-7 14 7-14 7 0-7zm0 0h8"
          />
        </svg>
      </button>
      <button v-else class="interrupt-btn" data-testid="interrupt-button" @click="handleInterrupt">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="btn-icon">
          <rect x="6" y="6" width="12" height="12" rx="1" stroke-width="2" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-input {
  flex-shrink: 0;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  padding: 8px 12px;
  padding-bottom: max(8px, env(safe-area-inset-bottom));
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.input-textarea {
  flex: 1;
  resize: none;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 20px;
  padding: 8px 10px;
  outline: none;
  overflow-y: auto;
}

.input-textarea::placeholder {
  color: var(--color-text-muted);
}

.input-textarea:focus {
  border-color: var(--color-accent);
}

.send-btn,
.interrupt-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: var(--color-accent);
  color: var(--color-bg);
  transition:
    opacity 0.15s,
    background 0.15s;
}

.send-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.interrupt-btn {
  background: var(--color-accent-active);
}

.btn-icon {
  width: 18px;
  height: 18px;
}
</style>
