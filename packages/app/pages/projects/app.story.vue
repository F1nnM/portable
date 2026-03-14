<script setup lang="ts">
// Story for the App tab page — 6 variants matching the redesigned layout
</script>

<template>
  <Story title="Pages / Project App" group="pages">
    <!-- Up to Date -->
    <Variant title="Up to Date">
      <div class="story-frame">
        <div class="app-page">
          <a href="#" class="url-bar">
            <span class="url-text">http://my-project--preview--portable.127.0.0.1.nip.io/</span>
            <svg
              class="url-icon"
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
          </a>
          <button class="btn-open">Open App</button>
          <section class="build-section">
            <h2 class="section-title">Build <span class="section-rule" /></h2>
            <div class="build-card" style="border-top-color: var(--color-accent)">
              <div class="card-body">
                <div class="status-row">
                  <div class="status-left">
                    <span class="status-dot dot-success" />
                    <span class="status-label">Up to date</span>
                  </div>
                  <span class="commit-hash">a1b2c3d</span>
                </div>
              </div>
              <div class="card-footer">
                <button class="btn-rebuild">Rebuild</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Variant>

    <!-- Building -->
    <Variant title="Building">
      <div class="story-frame">
        <div class="app-page">
          <a href="#" class="url-bar">
            <span class="url-text">http://my-project--preview--portable.127.0.0.1.nip.io/</span>
            <svg
              class="url-icon"
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
          </a>
          <button class="btn-open">Open App</button>
          <section class="build-section">
            <h2 class="section-title">Build <span class="section-rule" /></h2>
            <div class="build-card" style="border-top-color: var(--color-accent)">
              <div class="card-body">
                <div class="status-row">
                  <div class="status-left">
                    <div class="status-spinner" />
                    <span class="status-label">Building...</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Variant>

    <!-- Unbuilt Commits -->
    <Variant title="Unbuilt Commits">
      <div class="story-frame">
        <div class="app-page">
          <a href="#" class="url-bar">
            <span class="url-text">http://my-project--preview--portable.127.0.0.1.nip.io/</span>
            <svg
              class="url-icon"
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
          </a>
          <button class="btn-open">Open App</button>
          <section class="build-section">
            <h2 class="section-title">Build <span class="section-rule" /></h2>
            <div class="build-card" style="border-top-color: var(--color-warning)">
              <div class="card-body">
                <div class="status-row">
                  <div class="status-left">
                    <span class="status-dot dot-warning" />
                    <span class="status-label">3 commits ahead</span>
                  </div>
                  <span class="commit-hash">e5f6g7h</span>
                </div>
              </div>
              <div class="card-footer">
                <button class="btn-rebuild btn-rebuild-accent">Rebuild</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Variant>

    <!-- Uncommitted Changes -->
    <Variant title="Uncommitted Changes">
      <div class="story-frame">
        <div class="app-page">
          <a href="#" class="url-bar">
            <span class="url-text">http://my-project--preview--portable.127.0.0.1.nip.io/</span>
            <svg
              class="url-icon"
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
          </a>
          <button class="btn-open">Open App</button>
          <section class="build-section">
            <h2 class="section-title">Build <span class="section-rule" /></h2>
            <div class="build-card" style="border-top-color: var(--color-accent)">
              <div class="card-body">
                <div class="status-row">
                  <div class="status-left">
                    <span class="status-dot dot-success" />
                    <span class="status-label">Up to date</span>
                  </div>
                  <span class="commit-hash">a1b2c3d</span>
                </div>
                <div class="warning-row">
                  <svg
                    class="warning-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                    />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>Uncommitted changes</span>
                </div>
              </div>
              <div class="card-footer">
                <button class="btn-rebuild">Rebuild</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Variant>

    <!-- Build Error -->
    <Variant title="Build Error">
      <div class="story-frame">
        <div class="app-page">
          <a href="#" class="url-bar">
            <span class="url-text">http://my-project--preview--portable.127.0.0.1.nip.io/</span>
            <svg
              class="url-icon"
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
          </a>
          <button class="btn-open">Open App</button>
          <section class="build-section">
            <h2 class="section-title">Build <span class="section-rule" /></h2>
            <div class="build-card" style="border-top-color: var(--color-danger)">
              <div class="card-body">
                <div class="status-row">
                  <div class="status-left">
                    <span class="status-dot dot-danger" />
                    <span class="status-label">Build failed</span>
                  </div>
                  <span class="commit-hash">a1b2c3d</span>
                </div>
                <div class="error-detail">Command failed: bun run build exited with code 1</div>
              </div>
              <div class="card-footer">
                <button class="btn-rebuild btn-rebuild-danger">Rebuild</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Variant>

    <!-- Loading -->
    <Variant title="Loading">
      <div class="story-frame">
        <div class="app-page">
          <a href="#" class="url-bar">
            <span class="url-text">http://my-project--preview--portable.127.0.0.1.nip.io/</span>
            <svg
              class="url-icon"
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
          </a>
          <button class="btn-open">Open App</button>
          <section class="build-section">
            <h2 class="section-title">Build <span class="section-rule" /></h2>
            <div class="build-card" style="border-top-color: var(--color-border)">
              <div class="skeleton-row">
                <div class="skeleton-bar" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
.story-frame {
  height: 600px;
  width: 375px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.app-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-5);
  background: var(--color-bg);
  overflow-y: auto;
  height: 100%;
}

/* URL bar */
.url-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  box-shadow: var(--shadow-card);
  text-decoration: none;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.url-bar:hover {
  border-color: var(--color-border-strong);
  background: var(--color-bg-elevated);
}

.url-text {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.url-icon {
  width: 16px;
  height: 16px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

/* Open App button */
.btn-open {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: var(--touch-min);
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-accent) 25%, transparent);
}

/* Build section */
.build-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.section-rule {
  display: inline-block;
  width: 48px;
  height: 2px;
  background: var(--color-accent);
  border-radius: var(--radius-full);
  opacity: 0.5;
}

/* Build card */
.build-card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-top: 2px solid var(--color-accent);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Status row */
.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.status-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-success {
  background: var(--color-success);
  animation: status-pulse 2s ease-in-out infinite;
}

.dot-danger {
  background: var(--color-danger);
}

.dot-warning {
  background: var(--color-warning);
}

@keyframes status-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
  50% {
    box-shadow: 0 0 0 4px var(--color-success-tint);
  }
}

.status-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
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

.status-label {
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.commit-hash {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Warning row */
.warning-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-warning);
}

.warning-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* Error detail */
.error-detail {
  background: var(--color-danger-tint);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-danger);
  word-break: break-word;
}

/* Card footer */
.card-footer {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-3);
  margin-top: 0;
  text-align: center;
}

/* Rebuild button */
.btn-rebuild {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-5);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  min-height: 36px;
}

.btn-rebuild-danger {
  color: var(--color-danger);
  border-color: var(--color-danger);
  background: transparent;
}

.btn-rebuild-accent {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: transparent;
}

/* Loading skeleton */
.skeleton-row {
  padding: var(--space-2) 0;
}

.skeleton-bar {
  height: 20px;
  width: 60%;
  background: linear-gradient(
    90deg,
    var(--color-bg-inset) 25%,
    var(--color-bg-elevated) 50%,
    var(--color-bg-inset) 75%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-sm);
  animation: shimmer 1.8s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
