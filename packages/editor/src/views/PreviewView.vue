<template>
  <div class="view preview-view" data-testid="preview-view">
    <div class="view-placeholder">
      <span class="view-label">Preview</span>
    </div>
  </div>
</template>

<style scoped>
.view {
  flex: 1;
  overflow-y: auto;
}

.view-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.view-label {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
</style>
