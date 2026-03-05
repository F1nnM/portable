<script setup lang="ts">
import type { Project } from "~/types/project";

const { user } = useAuth();

const loading = ref(true);
const error = ref("");
const projects = ref<Project[]>([]);

async function fetchProjects() {
  loading.value = true;
  error.value = "";
  try {
    const data = await $fetch<{ projects: Project[] }>("/api/projects");
    projects.value = data.projects;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load projects";
    error.value = msg;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchProjects();
});

function handleProjectUpdated() {
  fetchProjects();
}

function handleProjectDeleted() {
  fetchProjects();
}
</script>

<template>
  <div class="dashboard">
    <div class="page-header">
      <div class="header-top">
        <div class="header-text">
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">
            Welcome back,
            <span class="username">{{ user?.displayName || user?.username }}</span>
          </p>
        </div>
        <NuxtLink to="/new" class="btn-new">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            width="18"
            height="18"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Project
        </NuxtLink>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner" />
      <span class="loading-text">Loading projects...</span>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error-state">
      <p class="error-text">
        {{ error }}
      </p>
      <button class="btn-retry" @click="fetchProjects">Try again</button>
    </div>

    <!-- Empty state -->
    <div v-else-if="projects.length === 0" class="empty-state">
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

    <!-- Project list -->
    <div v-else class="project-list">
      <ProjectCard
        v-for="project in projects"
        :key="project.id"
        :project="project"
        @updated="handleProjectUpdated"
        @deleted="handleProjectDeleted"
      />
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

.header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
}

.header-text {
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

.btn-new {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  min-height: var(--touch-min);
  padding: var(--space-sm) var(--space-md);
  background: var(--accent);
  color: var(--accent-text);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.875rem;
  border-radius: var(--radius-md);
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
  transition:
    background var(--transition-fast),
    transform var(--transition-fast);
}

.btn-new:hover {
  background: var(--accent-dim);
  color: var(--accent-text);
  transform: translateY(-1px);
}

.btn-new svg {
  width: 18px;
  height: 18px;
}

/* Loading state */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-3xl) var(--space-md);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 0.875rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

/* Error state */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-3xl) var(--space-md);
  border: 1px dashed var(--danger);
  border-radius: var(--radius-lg);
  text-align: center;
}

.error-text {
  color: var(--danger);
  font-size: 0.9375rem;
}

.btn-retry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-min);
  padding: var(--space-sm) var(--space-lg);
  background: var(--bg-overlay);
  color: var(--text-secondary);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.875rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.btn-retry:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

/* Empty state */
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

/* Project list */
.project-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
</style>
