<template>
  <div class="new-project">
    <div class="page-header">
      <h1 class="page-title">New Project</h1>
      <p class="page-subtitle">Create an isolated dev environment with Claude Code</p>
    </div>

    <div class="placeholder-card">
      <div class="placeholder-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 3v18M3 12h18" />
        </svg>
      </div>
      <p class="placeholder-text">Project creation will be available after scaffold setup.</p>
    </div>
  </div>
</template>

<style scoped>
.new-project {
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

.placeholder-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-3xl) var(--space-md);
  border: 1px dashed var(--border);
  border-radius: var(--radius-lg);
  text-align: center;
}

.placeholder-icon {
  width: 48px;
  height: 48px;
  color: var(--text-muted);
}

.placeholder-icon svg {
  width: 100%;
  height: 100%;
}

.placeholder-text {
  color: var(--text-muted);
  font-size: 0.9375rem;
  max-width: 300px;
}
</style>
