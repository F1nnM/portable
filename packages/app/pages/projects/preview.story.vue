<script setup lang="ts">
// Story for the preview page
</script>

<template>
  <Story title="Pages / Project Preview" group="pages">
    <Variant title="Loading">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="preview-page">
          <div class="preview-header">
            <span class="preview-label">Preview</span>
            <span class="preview-url">my-project--preview--portable.127.0.0.1.nip.io</span>
            <div class="preview-actions">
              <button class="btn-icon" aria-label="Refresh preview">
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
              <button class="btn-icon" aria-label="Open in new tab">
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
          <div class="iframe-container">
            <div class="loading-overlay">
              <div class="loading-spinner" />
              <span class="loading-text">Loading preview...</span>
            </div>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Loaded">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="preview-page">
          <div class="preview-header">
            <span class="preview-label">Preview</span>
            <span class="preview-url">my-project--preview--portable.127.0.0.1.nip.io</span>
            <div class="preview-actions">
              <button class="btn-icon" aria-label="Refresh preview">
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
              <button class="btn-icon" aria-label="Open in new tab">
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
          <div class="iframe-container">
            <div class="preview-placeholder">
              <div class="placeholder-nav" />
              <div class="placeholder-content">
                <div class="placeholder-hero" />
                <div class="placeholder-grid">
                  <div class="placeholder-card" />
                  <div class="placeholder-card" />
                  <div class="placeholder-card" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
.preview-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
}

.preview-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
  min-height: var(--touch-min);
  z-index: 1;
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

.btn-icon {
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

.btn-icon:hover {
  color: var(--color-text);
  background: var(--color-bg-inset);
}
.btn-icon svg {
  width: 18px;
  height: 18px;
}

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

/* Placeholder content to simulate a loaded page */
.preview-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f8f8f8;
}

.placeholder-nav {
  height: 48px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.placeholder-content {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.placeholder-hero {
  height: 120px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
}

.placeholder-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.placeholder-card {
  height: 80px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
}
</style>
