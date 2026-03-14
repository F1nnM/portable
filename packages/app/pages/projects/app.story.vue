<script setup lang="ts">
// Story for the App tab page
</script>

<template>
  <Story title="Pages / Project App" group="pages">
    <Variant title="Clean">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="app-page">
          <div class="app-card">
            <div class="app-url-section">
              <a href="#" class="app-url">
                http://my-project--preview--portable.127.0.0.1.nip.io/
              </a>
            </div>
            <button class="btn-open">Open</button>
            <div class="build-status">
              <div class="status-row status-ok">
                <svg
                  class="status-check"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Up to date</span>
              </div>
              <button class="btn-rebuild">Rebuild</button>
            </div>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Building">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="app-page">
          <div class="app-card">
            <div class="app-url-section">
              <a href="#" class="app-url">
                http://my-project--preview--portable.127.0.0.1.nip.io/
              </a>
            </div>
            <button class="btn-open">Open</button>
            <div class="build-status">
              <div class="status-row status-building">
                <div class="status-spinner" />
                <span>Building...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Unbuilt Commits">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="app-page">
          <div class="app-card">
            <div class="app-url-section">
              <a href="#" class="app-url">
                http://my-project--preview--portable.127.0.0.1.nip.io/
              </a>
            </div>
            <button class="btn-open">Open</button>
            <div class="build-status">
              <div class="status-banner status-info">
                <span>3 commits since last build</span>
                <button class="btn-rebuild btn-rebuild-highlighted">Rebuild</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Uncommitted Changes">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="app-page">
          <div class="app-card">
            <div class="app-url-section">
              <a href="#" class="app-url">
                http://my-project--preview--portable.127.0.0.1.nip.io/
              </a>
            </div>
            <button class="btn-open">Open</button>
            <div class="build-status">
              <div class="status-row status-ok">
                <svg
                  class="status-check"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Up to date</span>
              </div>
              <div class="status-warning">Uncommitted changes won't be reflected</div>
              <button class="btn-rebuild">Rebuild</button>
            </div>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Build Error">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="app-page">
          <div class="app-card">
            <div class="app-url-section">
              <a href="#" class="app-url">
                http://my-project--preview--portable.127.0.0.1.nip.io/
              </a>
            </div>
            <button class="btn-open">Open</button>
            <div class="build-status">
              <div class="status-banner status-error">
                <span class="status-error-message"
                >Command failed: bun run build exited with code 1</span
                >
                <button class="btn-rebuild btn-rebuild-error">Rebuild</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
.app-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: var(--space-4);
  background: var(--color-bg);
}

.app-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
  max-width: 400px;
  padding: var(--space-5);
  background: var(--color-bg-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

.app-url-section {
  width: 100%;
  text-align: center;
}

.app-url {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-accent);
  word-break: break-all;
  text-decoration: none;
}

.btn-open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-5);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: white;
  background: var(--color-accent);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  min-height: var(--touch-min);
}

.build-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
}

.status-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
}

.status-building {
  color: var(--color-text-muted);
}

.status-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  text-align: center;
}

.status-error {
  background: var(--color-danger-tint);
  color: var(--color-danger);
}

.status-error-message {
  word-break: break-word;
}

.status-info {
  background: var(--color-warning-tint);
  color: var(--color-warning);
}

.status-ok {
  color: var(--color-success);
}

.status-check {
  width: 18px;
  height: 18px;
}

.status-warning {
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  color: var(--color-warning);
  text-align: center;
}

.btn-rebuild {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1) var(--space-3);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  min-height: 36px;
}

.btn-rebuild-error {
  color: var(--color-danger);
  border-color: var(--color-danger);
  background: transparent;
}

.btn-rebuild-highlighted {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: transparent;
}
</style>
