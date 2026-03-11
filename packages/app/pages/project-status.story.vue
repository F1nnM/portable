<script setup lang="ts">
// Story for the project status/setup screen ([slug].vue)
</script>

<template>
  <Story title="Pages / Project Status" group="pages">
    <Variant title="Loading">
      <div
        style="
          height: 500px;
          width: 400px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="status-screen">
          <div class="status-center">
            <div class="loading-spinner" />
            <span class="loading-text">Loading project...</span>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Creating (Progress Checklist)">
      <div
        style="
          height: 500px;
          width: 400px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="status-screen">
          <div class="status-center">
            <h2 class="status-title">My Project</h2>
            <p class="status-subtitle">Setting up your project...</p>
            <div class="progress-checklist">
              <div class="phase-item phase-completed">
                <div class="phase-indicator">
                  <svg
                    class="phase-check"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span class="phase-label">Setting up database...</span>
              </div>
              <div class="phase-item phase-completed">
                <div class="phase-indicator">
                  <svg
                    class="phase-check"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span class="phase-label">Creating repository...</span>
              </div>
              <div class="phase-item phase-current">
                <div class="phase-indicator">
                  <div class="phase-spinner" />
                </div>
                <span class="phase-label">Cloning repository...</span>
              </div>
              <div class="phase-item phase-pending">
                <div class="phase-indicator">
                  <div class="phase-circle" />
                </div>
                <span class="phase-label">Installing dependencies...</span>
              </div>
              <div class="phase-item phase-pending">
                <div class="phase-indicator">
                  <div class="phase-circle" />
                </div>
                <span class="phase-label">Starting server...</span>
              </div>
              <div class="phase-item phase-pending">
                <div class="phase-indicator">
                  <div class="phase-circle" />
                </div>
                <span class="phase-label">Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Stopped">
      <div
        style="
          height: 500px;
          width: 400px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="status-screen">
          <div class="status-center">
            <div class="status-icon status-icon-stopped">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </div>
            <h2 class="status-title">My Project</h2>
            <p class="status-message">This project is stopped.</p>
            <button class="btn-primary">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Start Project
            </button>
            <span class="link-back">Back to dashboard</span>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Error">
      <div
        style="
          height: 500px;
          width: 400px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="status-screen">
          <div class="status-center">
            <div class="status-icon status-icon-error">
              <svg
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
            </div>
            <h2 class="status-title">My Project</h2>
            <p class="status-message">Something went wrong with this project.</p>
            <div class="action-error">Pod failed to start: insufficient memory</div>
            <button class="btn-primary">Try starting again</button>
            <span class="link-back">Back to dashboard</span>
          </div>
        </div>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
.status-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--color-bg);
  padding: var(--space-5);
}

.status-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  max-width: 400px;
  width: 100%;
  text-align: center;
}

.loading-spinner {
  width: 32px;
  height: 32px;
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

.loading-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.status-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
}

.status-icon svg {
  width: 32px;
  height: 32px;
}
.status-icon-stopped {
  background: var(--color-bg-inset);
  color: var(--color-text-muted);
}
.status-icon-error {
  background: var(--color-danger-tint);
  color: var(--color-danger);
}

.status-title {
  font-family: var(--font-sans);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.status-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}
.status-message {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}

.action-error {
  font-size: var(--font-size-sm);
  color: var(--color-danger);
  padding: var(--space-2) var(--space-4);
  background: var(--color-danger-tint);
  border-radius: var(--radius-sm);
  width: 100%;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--touch-min);
  padding: var(--space-3) var(--space-7);
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-base);
  border-radius: var(--radius-md);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(217, 122, 62, 0.2);
  transition:
    background var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.btn-primary:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(217, 122, 62, 0.3);
}
.btn-primary svg {
  width: 16px;
  height: 16px;
}

.link-back {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast);
}

.link-back:hover {
  color: var(--color-text-secondary);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.progress-checklist {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 320px;
  margin-top: var(--space-5);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  box-shadow: var(--shadow-card);
}

.phase-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  position: relative;
}

.phase-item:not(:last-child)::after {
  content: "";
  position: absolute;
  left: 11px;
  top: calc(var(--space-3) + 22px);
  bottom: 0;
  width: 2px;
  background: var(--color-border);
}

.phase-item.phase-completed:not(:last-child)::after {
  background: var(--color-success);
}

.phase-indicator {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.phase-check {
  width: 20px;
  height: 20px;
  color: var(--color-success);
}

.phase-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.phase-circle {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-bg);
}

.phase-label {
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  text-align: left;
}

.phase-completed .phase-label {
  color: var(--color-text-muted);
}
.phase-current .phase-label {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}
.phase-pending .phase-label {
  color: var(--color-text-muted);
  opacity: 0.6;
}
</style>
