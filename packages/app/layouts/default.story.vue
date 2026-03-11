<script setup lang="ts">
// Story for the default app layout (topbar + content area)
</script>

<template>
  <Story title="Layouts / Default Layout" group="layouts">
    <Variant title="Authenticated with Avatar">
      <div
        style="
          height: 600px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="app-shell">
          <header class="topbar">
            <span class="topbar-brand">portable</span>
            <div class="topbar-actions">
              <button class="topbar-btn" aria-label="New project">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                >
                  <line x1="10" y1="4" x2="10" y2="16" />
                  <line x1="4" y1="10" x2="16" y2="10" />
                </svg>
              </button>
              <div class="topbar-avatar">
                <span class="avatar-fallback">F</span>
              </div>
            </div>
          </header>
          <main class="main-content">
            <div style="padding: var(--space-4)">
              <p style="color: var(--color-text-muted); font-size: var(--font-size-sm)">
                Page content appears here
              </p>
            </div>
          </main>
        </div>
      </div>
    </Variant>

    <Variant title="Pre-Setup (No New Project Button)">
      <div
        style="
          height: 600px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="app-shell">
          <header class="topbar">
            <span class="topbar-brand">portable</span>
            <div class="topbar-actions">
              <div class="topbar-avatar">
                <span class="avatar-fallback">J</span>
              </div>
            </div>
          </header>
          <main class="main-content">
            <div style="padding: var(--space-4)">
              <p style="color: var(--color-text-muted); font-size: var(--font-size-sm)">
                New project button hidden before setup is complete
              </p>
            </div>
          </main>
        </div>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.topbar-brand {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  letter-spacing: -0.03em;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.topbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.topbar-btn:hover {
  background: var(--color-bg-inset);
  color: var(--color-text);
}

.topbar-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: var(--color-accent-tint);
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.topbar-avatar:hover {
  opacity: 0.8;
}

.avatar-fallback {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-accent);
}

.main-content {
  flex: 1;
  padding: var(--space-5) var(--space-4);
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
}
</style>
