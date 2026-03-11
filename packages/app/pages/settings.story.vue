<script setup lang="ts">
// Story for the settings page
</script>

<template>
  <Story title="Pages / Settings" group="pages">
    <Variant title="All Configured">
      <div style="max-width: 560px; padding: 16px">
        <div class="settings">
          <div class="page-header">
            <h1 class="page-title"><span class="title-prefix">//</span> Settings</h1>
          </div>

          <section class="settings-section">
            <h2 class="section-title">
              Account
              <span class="section-rule" />
            </h2>
            <div class="settings-card">
              <div class="setting-row">
                <span class="setting-label">GitHub</span>
                <span class="setting-value mono">finnscode</span>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h2 class="section-title">
              Theme
              <span class="section-rule" />
            </h2>
            <div class="settings-card">
              <div class="theme-toggle">
                <button class="theme-option">
                  <svg
                    class="theme-icon"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  System
                </button>
                <button class="theme-option">
                  <svg
                    class="theme-icon"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                  Light
                </button>
                <button class="theme-option active">
                  <svg
                    class="theme-icon"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  Dark
                </button>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h2 class="section-title">
              Anthropic Credential
              <span class="section-rule" />
            </h2>
            <div class="settings-card">
              <p class="setting-description">Your Anthropic API key or Claude Code OAuth token.</p>
              <div class="setting-row">
                <span class="setting-label">Status</span>
                <span class="setting-status">
                  <span class="status-dot dot-success" />
                  Configured
                </span>
              </div>
              <form class="credential-form" @submit.prevent>
                <input
                  type="password"
                  class="form-input"
                  placeholder="Enter new credential to replace"
                />
                <div class="form-actions">
                  <button type="button" class="btn btn-primary" disabled>Save</button>
                  <button type="button" class="btn btn-danger">Remove</button>
                </div>
              </form>
            </div>
          </section>

          <section class="settings-section">
            <h2 class="section-title">
              AGE Key
              <span class="section-rule" />
            </h2>
            <div class="settings-card">
              <p class="setting-description">Your AGE private key for SOPS decryption.</p>
              <div class="setting-row">
                <span class="setting-label">Status</span>
                <span class="setting-status">
                  <span class="status-dot dot-success" />
                  Configured
                </span>
              </div>
              <form class="credential-form" @submit.prevent>
                <input type="password" class="form-input" placeholder="Enter new key to replace" />
                <div class="form-actions">
                  <button type="button" class="btn btn-primary" disabled>Save</button>
                  <button type="button" class="btn btn-danger">Remove</button>
                </div>
              </form>
            </div>
          </section>

          <section class="settings-section">
            <button class="btn-logout">
              <svg
                class="logout-icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </section>
        </div>
      </div>
    </Variant>

    <Variant title="Not Configured">
      <div style="max-width: 560px; padding: 16px">
        <div class="settings">
          <div class="page-header">
            <h1 class="page-title"><span class="title-prefix">//</span> Settings</h1>
          </div>

          <section class="settings-section">
            <h2 class="section-title">
              Account
              <span class="section-rule" />
            </h2>
            <div class="settings-card">
              <div class="setting-row">
                <span class="setting-label">GitHub</span>
                <span class="setting-value mono">newuser</span>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h2 class="section-title">
              Theme
              <span class="section-rule" />
            </h2>
            <div class="settings-card">
              <div class="theme-toggle">
                <button class="theme-option active">
                  <svg
                    class="theme-icon"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  System
                </button>
                <button class="theme-option">
                  <svg
                    class="theme-icon"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                  Light
                </button>
                <button class="theme-option">
                  <svg
                    class="theme-icon"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  Dark
                </button>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h2 class="section-title">
              Anthropic Credential
              <span class="section-rule" />
            </h2>
            <div class="settings-card">
              <p class="setting-description">Your Anthropic API key or Claude Code OAuth token.</p>
              <div class="setting-row">
                <span class="setting-label">Status</span>
                <span class="setting-status">
                  <span class="status-dot dot-unconfigured" />
                  Not configured
                </span>
              </div>
              <div class="feedback-message success">Credential saved</div>
              <form class="credential-form" @submit.prevent>
                <input type="password" class="form-input" placeholder="sk-ant-... or OAuth token" />
                <div class="form-actions">
                  <button type="button" class="btn btn-primary" disabled>Save</button>
                </div>
              </form>
            </div>
          </section>

          <section class="settings-section">
            <button class="btn-logout">
              <svg
                class="logout-icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </section>
        </div>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.page-title {
  font-family: var(--font-mono);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  letter-spacing: 0.02em;
}

.title-prefix {
  color: var(--color-text-muted);
  margin-right: 0.25em;
  font-weight: var(--font-weight-normal);
}

.settings-section {
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

.settings-card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-top: 2px solid var(--color-accent);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  box-shadow: var(--shadow-card);
}

.theme-toggle {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.theme-option {
  flex: 1;
  min-height: var(--touch-min);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.theme-icon {
  flex-shrink: 0;
}

.theme-option + .theme-option {
  border-left: 1px solid var(--color-border);
}
.theme-option:hover {
  background: var(--color-bg-elevated);
}
.theme-option.active {
  background: var(--color-accent);
  color: var(--color-accent-text);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--touch-min);
}

.setting-label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
}
.setting-value {
  color: var(--color-text);
  font-size: var(--font-size-base);
}
.setting-value.mono {
  font-family: var(--font-mono);
}

.setting-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.status-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-success {
  background: var(--color-success);
  animation: status-pulse 2s ease-in-out infinite;
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

.dot-unconfigured {
  background: transparent;
  border: 2px solid var(--color-text-muted);
}

.setting-description {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
}

.feedback-message {
  font-size: var(--font-size-sm);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
}

.feedback-message.success {
  background: var(--color-success-tint);
  color: var(--color-success);
}

.credential-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-input {
  width: 100%;
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.form-input::placeholder {
  color: var(--color-text-muted);
  font-family: var(--font-sans);
}
.form-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-tint);
}

.form-actions {
  display: flex;
  gap: var(--space-2);
}

.btn {
  min-height: var(--touch-min);
  padding: 0 var(--space-5);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    opacity var(--transition-fast);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary {
  background: var(--color-accent);
  color: var(--color-accent-text);
}
.btn-primary:not(:disabled):hover {
  background: var(--color-accent-hover);
}
.btn-danger {
  background: transparent;
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
}
.btn-danger:not(:disabled):hover {
  background: var(--color-danger-tint);
}

.btn-logout {
  width: 100%;
  min-height: var(--touch-min);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: transparent;
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-danger);
  color: var(--color-danger);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.logout-icon {
  flex-shrink: 0;
}

.btn-logout:hover {
  background: var(--color-danger-tint);
  border-color: var(--color-danger);
}
</style>
