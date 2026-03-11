<script setup lang="ts">
definePageMeta({
  layout: "project",
});

const route = useRoute();
const slug = computed(() => route.params.slug as string);

const iframeRef = ref<HTMLIFrameElement | null>(null);
const isLoading = ref(true);

// Construct preview URL from the current hostname pattern.
// The convention is: slug--preview--appLabel.domain
// e.g., if the main app is at "portable.example.com",
//   the project editor would be "my-project--portable.example.com"
//   and the preview would be "my-project--preview--portable.example.com"
const previewUrl = computed(() => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  // Determine the app label from the base domain.
  // In dev/prod, the main domain is "portable.example.com" or "portable.127.0.0.1.nip.io".
  // We need to construct "slug--preview--appLabel.rest.of.domain".
  // The main domain might already have a slug prefix if accessed from within a project context.

  // Extract the base domain (remove any slug prefix if present)
  const parts = hostname.split("--");
  const appLabelAndDomain = parts.length > 1 ? parts.slice(1).join("--") : hostname;

  // Build preview subdomain
  const previewHost = `${slug.value}--preview--${appLabelAndDomain}`;
  const port = window.location.port ? `:${window.location.port}` : "";

  return `${protocol}//${previewHost}${port}/`;
});

function handleIframeLoad() {
  isLoading.value = false;
}

function refreshPreview() {
  isLoading.value = true;
  if (iframeRef.value) {
    iframeRef.value.src = previewUrl.value;
  }
}

function openInNewTab() {
  window.open(previewUrl.value, "_blank");
}
</script>

<template>
  <div class="preview-page">
    <!-- Preview header -->
    <div class="preview-header">
      <span class="preview-label">Preview</span>
      <span class="preview-url">{{ previewUrl }}</span>

      <div class="preview-actions">
        <button class="btn-refresh" aria-label="Refresh preview" @click="refreshPreview">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>

        <button class="btn-new-tab" aria-label="Open in new tab" @click="openInNewTab">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Iframe container -->
    <div class="iframe-container">
      <!-- Loading overlay -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner" />
        <span class="loading-text">Loading preview...</span>
      </div>

      <iframe
        ref="iframeRef"
        class="preview-iframe"
        :src="previewUrl"
        sandbox="allow-forms allow-modals allow-popups allow-scripts allow-same-origin"
        @load="handleIframeLoad"
      />
    </div>
  </div>
</template>

<style scoped>
.preview-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
}

/* Preview header */
.preview-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  min-height: var(--touch-min);
}

.preview-label {
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  flex-shrink: 0;
}

.preview-url {
  flex: 1;
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.btn-refresh,
.btn-new-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-refresh:hover,
.btn-new-tab:hover {
  color: var(--color-text);
  background: var(--color-bg-inset);
}

.btn-refresh svg,
.btn-new-tab svg {
  width: 18px;
  height: 18px;
}

/* Iframe container */
.iframe-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: white;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  background: var(--color-bg);
  z-index: 10;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
