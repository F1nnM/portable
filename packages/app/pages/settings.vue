<script setup lang="ts">
const { user } = useAuth();
</script>

<template>
  <div class="settings">
    <div class="page-header">
      <h1 class="page-title">Settings</h1>
      <p class="page-subtitle">Manage your account and credentials</p>
    </div>

    <section class="settings-section">
      <h2 class="section-title">Account</h2>
      <div class="settings-card">
        <div class="setting-row">
          <span class="setting-label">GitHub</span>
          <span class="setting-value mono">{{ user?.username }}</span>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <h2 class="section-title">Anthropic Credential</h2>
      <div class="settings-card">
        <p class="setting-description">
          Add your Anthropic API key or Claude Code OAuth token to enable Claude in your projects.
        </p>
        <div class="setting-row">
          <span class="setting-label">Status</span>
          <span class="setting-badge not-set">Not configured</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.page-title {
  font-size: 1.75rem;
  letter-spacing: -0.03em;
}

.page-subtitle {
  color: var(--text-secondary);
  font-size: 0.9375rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.settings-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--touch-min);
}

.setting-label {
  color: var(--text-secondary);
  font-size: 0.9375rem;
}

.setting-value {
  color: var(--text-primary);
  font-size: 0.9375rem;
}

.setting-value.mono {
  font-family: var(--font-mono);
}

.setting-description {
  color: var(--text-muted);
  font-size: 0.875rem;
  line-height: 1.5;
}

.setting-badge {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 999px;
}

.setting-badge.not-set {
  background: var(--bg-overlay);
  color: var(--text-muted);
}
</style>
