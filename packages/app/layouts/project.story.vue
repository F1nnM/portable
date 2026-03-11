<script setup lang="ts">
// Story for the project layout (topbar + tab bar + content)
</script>

<template>
  <Story title="Layouts / Project Layout" group="layouts">
    <Variant title="Running - Chat Active">
      <div
        style="
          height: 600px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="project-layout">
          <header class="project-topbar">
            <button class="topbar-back" aria-label="Back">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="12 4 6 10 12 16" />
              </svg>
            </button>
            <div class="topbar-center">
              <span class="topbar-project-name">My Project</span>
              <span class="topbar-status-pill pill-running">Running</span>
            </div>
            <div class="topbar-spacer" />
          </header>
          <main class="project-content">
            <div
              style="
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: var(--color-text-muted);
                font-size: var(--font-size-sm);
              "
            >
              Chat view content
            </div>
          </main>
          <nav class="project-tabbar">
            <div class="tab-item active">
              <svg
                class="tab-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span class="tab-label">Chat</span>
            </div>
            <div class="tab-item">
              <svg
                class="tab-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span class="tab-label">Files</span>
            </div>
            <div class="tab-item">
              <svg
                class="tab-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              <span class="tab-label">Git</span>
            </div>
            <div class="tab-item">
              <svg
                class="tab-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span class="tab-label">Preview</span>
            </div>
          </nav>
        </div>
      </div>
    </Variant>

    <Variant title="Status Pills">
      <div style="display: flex; flex-direction: column; gap: 12px; padding: 16px">
        <div
          v-for="pill in [
            { label: 'Running', class: 'pill-running' },
            { label: 'Starting', class: 'pill-starting' },
            { label: 'Creating', class: 'pill-creating' },
            { label: 'Stopping', class: 'pill-stopping' },
            { label: 'Error', class: 'pill-error' },
            { label: 'Stopped', class: 'pill-stopped' },
          ]"
          :key="pill.label"
          style="display: flex; align-items: center; gap: 12px"
        >
          <span class="topbar-status-pill" :class="pill.class">{{ pill.label }}</span>
          <span style="font-size: var(--font-size-sm); color: var(--color-text-muted)">{{
            pill.class
          }}</span>
        </div>
      </div>
    </Variant>

    <Variant title="Long Project Name">
      <div
        style="
          height: 120px;
          width: 375px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="project-layout">
          <header class="project-topbar">
            <button class="topbar-back" aria-label="Back">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="12 4 6 10 12 16" />
              </svg>
            </button>
            <div class="topbar-center">
              <span class="topbar-project-name">A Very Long Project Name That Truncates</span>
              <span class="topbar-status-pill pill-running">Running</span>
            </div>
            <div class="topbar-spacer" />
          </header>
        </div>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
.project-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg);
}

.project-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 var(--space-2);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.topbar-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.topbar-back:hover {
  color: var(--color-text);
  background: var(--color-bg-inset);
}

.topbar-center {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex: 1;
  justify-content: center;
}

.topbar-project-name {
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar-status-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-xl);
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1;
}

.pill-running {
  background: var(--color-success-tint);
  color: var(--color-success);
}
.pill-creating,
.pill-starting,
.pill-stopping {
  background: var(--color-warning-tint);
  color: var(--color-warning);
}
.pill-error {
  background: var(--color-danger-tint);
  color: var(--color-danger);
}
.pill-stopped {
  background: var(--color-bg-inset);
  color: var(--color-text-muted);
}

.topbar-spacer {
  width: var(--touch-min);
  flex-shrink: 0;
}

.project-content {
  flex: 1;
  overflow: hidden;
}

.project-tabbar {
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  height: 56px;
  background: var(--color-bg-surface);
  border-top: 1px solid var(--color-border);
  box-shadow: 0 -2px 8px rgba(44, 40, 37, 0.04);
  flex-shrink: 0;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  flex: 1;
  min-height: var(--touch-min);
  color: var(--color-text-muted);
  border-top: 2px solid transparent;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast);
}

.tab-item.active {
  color: var(--color-accent);
  border-top-color: var(--color-accent);
}

.tab-item.active .tab-label {
  font-weight: var(--font-weight-medium);
}

.tab-item:hover:not(.active) {
  color: var(--color-text-secondary);
}

.tab-icon {
  width: 22px;
  height: 22px;
}

.tab-label {
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
}
</style>
