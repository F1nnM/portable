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
  const maxHeight = 120;
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
        placeholder="Message Claude..."
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
  background: var(--color-bg-surface);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin: var(--space-3);
  margin-bottom: max(var(--space-3), env(safe-area-inset-bottom));
  box-shadow: var(--shadow-card);
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
}

.input-textarea {
  flex: 1;
  resize: none;
  background: transparent;
  border: none;
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.5;
  padding: var(--space-2);
  outline: none;
  overflow-y: auto;
  max-height: 120px;
}

.input-textarea::placeholder {
  color: var(--color-text-muted);
}

.send-btn,
.interrupt-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  background: var(--color-accent);
  color: #fff;
  transition:
    opacity var(--transition-fast),
    background var(--transition-fast);
}

.send-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.interrupt-btn {
  background: var(--color-danger);
}

.interrupt-btn:active {
  background: var(--color-danger-hover);
}

.btn-icon {
  width: 18px;
  height: 18px;
}
</style>
