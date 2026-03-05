<script setup lang="ts">
const { user } = useAuth();
</script>

<template>
  <div class="dashboard">
    <div class="page-header">
      <h1 class="page-title">Dashboard</h1>
      <p class="page-subtitle">
        Welcome back, <span class="username">{{ user?.displayName || user?.username }}</span>
      </p>
    </div>

    <div class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </div>
      <p class="empty-text">No projects yet</p>
      <NuxtLink to="/new" class="btn-primary"> Create your first project </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
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

.username {
  color: var(--accent);
  font-family: var(--font-mono);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-3xl) var(--space-md);
  border: 1px dashed var(--border);
  border-radius: var(--radius-lg);
  text-align: center;
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--text-muted);
}

.empty-icon svg {
  width: 100%;
  height: 100%;
}

.empty-text {
  color: var(--text-muted);
  font-size: 0.9375rem;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-min);
  padding: var(--space-sm) var(--space-lg);
  background: var(--accent);
  color: var(--accent-text);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.9375rem;
  border-radius: var(--radius-md);
  text-decoration: none;
  transition:
    background var(--transition-fast),
    transform var(--transition-fast);
}

.btn-primary:hover {
  background: var(--accent-dim);
  color: var(--accent-text);
  transform: translateY(-1px);
}
</style>
