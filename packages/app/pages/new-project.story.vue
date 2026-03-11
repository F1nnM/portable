<script setup lang="ts">
// Story for the new project page
const selectedScaffold = ref("nuxt-postgres");
const selectedRepo = ref<string | null>(null);
</script>

<template>
  <Story title="Pages / New Project" group="pages">
    <Variant title="Scaffold Tab">
      <div style="max-width: 640px; padding: 16px">
        <div class="new-project">
          <div class="page-header">
            <button class="back-link" aria-label="Back">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                width="20"
                height="20"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <h1 class="page-title">New Project</h1>
          </div>

          <div class="tabs">
            <button class="tab active">From Scaffold</button>
            <button class="tab">Import Repo</button>
          </div>

          <div class="form-section">
            <label class="form-label">Template</label>
            <div class="scaffold-grid">
              <button
                class="scaffold-card"
                :class="{ selected: selectedScaffold === 'nuxt-postgres' }"
                @click="selectedScaffold = 'nuxt-postgres'"
              >
                <span class="scaffold-name">Nuxt + Postgres</span>
                <span class="scaffold-description"
                  >Full-stack Nuxt 3 with Drizzle ORM and Postgres</span
                >
              </button>
              <button
                class="scaffold-card"
                :class="{ selected: selectedScaffold === 'blank' }"
                @click="selectedScaffold = 'blank'"
              >
                <span class="scaffold-name">Blank</span>
                <span class="scaffold-description">Empty workspace to start from scratch</span>
              </button>
            </div>
          </div>

          <div class="form-section">
            <label class="form-label" for="project-name">Project name</label>
            <input id="project-name" type="text" class="form-input" value="My Awesome App" />
            <div class="slug-preview">
              <span class="slug-label">Slug:</span>
              <span class="slug-value">my-awesome-app</span>
            </div>
          </div>

          <button class="btn-create">Create Project</button>
        </div>
      </div>
    </Variant>

    <Variant title="Import Tab">
      <div style="max-width: 640px; padding: 16px">
        <div class="new-project">
          <div class="page-header">
            <button class="back-link" aria-label="Back">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                width="20"
                height="20"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <h1 class="page-title">New Project</h1>
          </div>

          <div class="tabs">
            <button class="tab">From Scaffold</button>
            <button class="tab active">Import Repo</button>
          </div>

          <div class="form-section">
            <label class="form-label">Repository</label>
            <input type="text" class="form-input" placeholder="Search repositories..." />
            <div class="repo-list">
              <button
                v-for="repo in [
                  {
                    name: 'portable',
                    fullName: 'finnscode/portable',
                    description: 'Remote Claude Code environment',
                    language: 'TypeScript',
                    isPrivate: false,
                  },
                  {
                    name: 'blog',
                    fullName: 'finnscode/blog',
                    description: 'Personal blog with Nuxt',
                    language: 'Vue',
                    isPrivate: false,
                  },
                  {
                    name: 'secrets-mgr',
                    fullName: 'finnscode/secrets-mgr',
                    description: null,
                    language: 'Go',
                    isPrivate: true,
                  },
                ]"
                :key="repo.fullName"
                class="repo-card"
                :class="{ selected: selectedRepo === repo.fullName }"
                @click="selectedRepo = repo.fullName"
              >
                <div class="repo-header">
                  <span class="repo-name">{{ repo.name }}</span>
                  <span v-if="repo.isPrivate" class="repo-badge">Private</span>
                </div>
                <span v-if="repo.description" class="repo-description">{{ repo.description }}</span>
                <span v-if="repo.language" class="repo-language">{{ repo.language }}</span>
              </button>
            </div>
          </div>

          <div class="form-section">
            <label class="form-label" for="import-name">Project name</label>
            <input id="import-name" type="text" class="form-input" placeholder="My Awesome App" />
          </div>

          <button class="btn-create" disabled>Import Project</button>
        </div>
      </div>
    </Variant>

    <Variant title="Loading Scaffolds">
      <div style="max-width: 640px; padding: 16px">
        <div class="new-project">
          <div class="page-header">
            <button class="back-link" aria-label="Back">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                width="20"
                height="20"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <h1 class="page-title">New Project</h1>
          </div>

          <div class="tabs">
            <button class="tab active">From Scaffold</button>
            <button class="tab">Import Repo</button>
          </div>

          <div class="form-section">
            <label class="form-label">Template</label>
            <div class="list-loading">
              <div class="loading-spinner" />
              <span class="loading-text">Loading templates...</span>
            </div>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Error State">
      <div style="max-width: 640px; padding: 16px">
        <div class="new-project">
          <div class="page-header">
            <button class="back-link" aria-label="Back">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                width="20"
                height="20"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <h1 class="page-title">New Project</h1>
          </div>

          <div class="error-banner">
            <p class="error-text">A project with this name already exists</p>
          </div>

          <button class="btn-create" disabled>Create Project</button>
        </div>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
.new-project {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.page-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.back-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast);
}

.back-link:hover {
  color: var(--color-text);
  background: var(--color-bg-inset);
}

.page-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.tabs {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-border);
}

.tab {
  padding: var(--space-3) var(--space-4);
  border-bottom: 2px solid transparent;
  color: var(--color-text-secondary);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-base);
  cursor: pointer;
  min-height: var(--touch-min);
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast);
}

.tab:hover {
  color: var(--color-text);
}
.tab.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.form-label {
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-base);
  color: var(--color-text);
}

.scaffold-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
}

.scaffold-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  text-align: left;
  min-height: var(--touch-min);
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.scaffold-card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-elevated);
}
.scaffold-card.selected {
  border-color: var(--color-accent);
  background: var(--color-accent-tint);
  box-shadow: 0 0 0 1px var(--color-accent);
}

.scaffold-name {
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-base);
  color: var(--color-text);
}

.scaffold-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}

.form-input {
  width: 100%;
  min-height: var(--touch-min);
  padding: var(--space-2) var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.form-input::placeholder {
  color: var(--color-text-muted);
}
.form-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-tint);
}

.slug-preview {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
}
.slug-label {
  color: var(--color-text-muted);
}
.slug-value {
  font-family: var(--font-mono);
  color: var(--color-text-muted);
}

.repo-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 300px;
  overflow-y: auto;
  padding: var(--space-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
}

.repo-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.repo-card:hover {
  border-color: var(--color-border-strong);
  background: var(--color-bg-elevated);
}
.repo-card.selected {
  border-color: var(--color-accent);
  background: var(--color-accent-tint);
}

.repo-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.repo-name {
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-base);
  color: var(--color-text);
}
.repo-badge {
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border-radius: var(--radius-xl);
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.repo-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}
.repo-language {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.list-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6) var(--space-4);
}

.loading-spinner {
  width: 24px;
  height: 24px;
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

.error-banner {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-sm);
  background: var(--color-danger-tint);
}

.error-text {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.btn-create {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 52px;
  padding: var(--space-3) var(--space-5);
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
    opacity var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.btn-create:hover:not(:disabled) {
  background: var(--color-accent-hover);
  box-shadow: 0 4px 16px rgba(217, 122, 62, 0.3);
  transform: translateY(-1px);
}
.btn-create:active:not(:disabled) {
  transform: scale(0.98);
  box-shadow: 0 1px 4px rgba(217, 122, 62, 0.15);
}
.btn-create:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}
</style>
