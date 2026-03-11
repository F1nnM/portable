<script setup lang="ts">
// Story for the settings page
</script>

<template>
  <Story title="Pages / Settings" group="pages">
    <Variant title="All Configured">
      <div style="max-width: 560px; padding: 16px">
        <div class="settings">
          <div class="page-header">
            <h1 class="page-title">Settings</h1>
          </div>

          <section class="settings-section">
            <h2 class="section-title">Account</h2>
            <div class="settings-card">
              <div class="setting-row">
                <span class="setting-label">GitHub</span>
                <span class="setting-value mono">finnscode</span>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h2 class="section-title">Theme</h2>
            <div class="settings-card">
              <div class="theme-toggle">
                <button class="theme-option">System</button>
                <button class="theme-option">Light</button>
                <button class="theme-option active">Dark</button>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h2 class="section-title">Anthropic Credential</h2>
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
            <h2 class="section-title">AGE Key</h2>
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
            <button class="btn-logout">Sign out</button>
          </section>
        </div>
      </div>
    </Variant>

    <Variant title="Not Configured">
      <div style="max-width: 560px; padding: 16px">
        <div class="settings">
          <div class="page-header">
            <h1 class="page-title">Settings</h1>
          </div>

          <section class="settings-section">
            <h2 class="section-title">Account</h2>
            <div class="settings-card">
              <div class="setting-row">
                <span class="setting-label">GitHub</span>
                <span class="setting-value mono">newuser</span>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h2 class="section-title">Theme</h2>
            <div class="settings-card">
              <div class="theme-toggle">
                <button class="theme-option active">System</button>
                <button class="theme-option">Light</button>
                <button class="theme-option">Dark</button>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h2 class="section-title">Anthropic Credential</h2>
            <div class="settings-card">
              <p class="setting-description">Your Anthropic API key or Claude Code OAuth token.</p>
              <div class="setting-row">
                <span class="setting-label">Status</span>
                <span class="setting-status">
                  <span class="status-dot dot-muted" />
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
            <button class="btn-logout">Sign out</button>
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
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.settings-card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
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
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
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
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot-success {
  background: var(--color-success);
}
.dot-muted {
  background: var(--color-text-muted);
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
  background: transparent;
  border: 1px solid var(--color-border);
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

.btn-logout:hover {
  background: var(--color-danger-tint);
  border-color: var(--color-danger);
}
</style>
