<script setup lang="ts">
defineProps<{
  isStreaming: boolean;
}>();

const emit = defineEmits<{
  send: [content: string];
  interrupt: [];
}>();

const inputText = ref("");
const textareaRef = ref<HTMLTextAreaElement | null>(null);

function adjustHeight() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
}

function handleSend() {
  const content = inputText.value.trim();
  if (!content) return;
  emit("send", content);
  inputText.value = "";
  nextTick(adjustHeight);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

function handleInterrupt() {
  emit("interrupt");
}

watch(inputText, () => {
  nextTick(adjustHeight);
});

const isEmpty = computed(() => inputText.value.trim().length === 0);
</script>

<template>
  <div class="chat-input-container">
    <div class="input-row">
      <textarea
        ref="textareaRef"
        v-model="inputText"
        class="chat-textarea"
        placeholder="Message Claude..."
        rows="1"
        @keydown="handleKeydown"
      />

      <button
        v-if="!isStreaming"
        class="btn-send"
        :disabled="isEmpty"
        aria-label="Send message"
        @click="handleSend"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>

      <button v-else class="btn-interrupt" aria-label="Interrupt query" @click="handleInterrupt">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-input-container {
  padding: var(--space-4);
  padding-bottom: max(var(--space-4), env(safe-area-inset-bottom, 0px));
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-2) var(--space-3);
  box-shadow:
    0 4px 16px rgba(44, 40, 37, 0.08),
    0 1px 4px rgba(44, 40, 37, 0.04);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.input-row:focus-within {
  border-color: var(--color-accent);
  box-shadow:
    0 4px 16px rgba(44, 40, 37, 0.08),
    0 1px 4px rgba(44, 40, 37, 0.04),
    0 0 0 3px var(--color-accent-tint);
}

.chat-textarea {
  flex: 1;
  min-height: 24px;
  max-height: 200px;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  padding: 7px var(--space-2);
}

.chat-textarea::placeholder {
  color: var(--color-text-muted);
}

.btn-send,
.btn-interrupt {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-full);
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background var(--transition-fast),
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.btn-send:active:not(:disabled),
.btn-interrupt:active {
  transform: scale(0.92);
}

.btn-send {
  background: var(--color-accent);
  color: var(--color-accent-text);
}

.btn-send:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.btn-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-send svg {
  width: 18px;
  height: 18px;
  transform: translate(-1px, 1px);
}

.btn-interrupt {
  background: var(--color-danger);
  color: white;
}

.btn-interrupt:hover {
  background: var(--color-danger);
  opacity: 0.9;
}

.btn-interrupt svg {
  width: 18px;
  height: 18px;
}
</style>
