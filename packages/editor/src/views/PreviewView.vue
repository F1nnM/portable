<script setup lang="ts">
import { computed, ref } from "vue";

const hostname = window.location.hostname;
const protocol = window.location.protocol;
const port = window.location.port;

const previewHost = computed(() => {
  const base = `preview.${hostname}`;
  return port ? `${base}:${port}` : base;
});

const previewUrl = computed(() => {
  return `${protocol}//preview.${hostname}${port ? `:${port}` : ""}`;
});

const iframeKey = ref(0);

function refresh() {
  iframeKey.value += 1;
}

const loading = ref(true);

function onIframeLoad() {
  loading.value = false;
}
</script>

<template>
  <div class="view preview-view" data-testid="preview-view">
    <div class="preview-header" data-testid="preview-header">
      <span class="preview-label">Preview</span>
      <span class="preview-url" data-testid="preview-url">{{ previewHost }}</span>
      <button
        class="preview-refresh"
        data-testid="preview-refresh"
        title="Refresh preview"
        @click="refresh"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="refresh-icon">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h5M20 20v-5h-5"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M20.49 9A9 9 0 0 0 5.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 0 1 3.51 15"
          />
        </svg>
      </button>
    </div>
    <div class="preview-content">
      <div v-if="loading" class="preview-loading">
        <span class="loading-text">Loading preview...</span>
      </div>
      <iframe
        :key="iframeKey"
        :src="previewUrl"
        class="preview-iframe"
        data-testid="preview-iframe"
        @load="onIframeLoad"
      />
    </div>
  </div>
</template>

<style scoped>
.view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-header {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 12px;
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  gap: 8px;
}

.preview-label {
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text);
  flex-shrink: 0;
}

.preview-url {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.preview-refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.preview-refresh:hover {
  color: var(--color-text);
  background: var(--color-bg-elevated);
}

.preview-refresh:active {
  color: var(--color-accent);
}

.refresh-icon {
  width: 16px;
  height: 16px;
}

.preview-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.preview-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  z-index: 1;
}

.loading-text {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
</style>
