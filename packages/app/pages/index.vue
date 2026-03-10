<script setup lang="ts">
import type { Project } from "~/types/project";

const loading = ref(true);
const error = ref("");
const projects = ref<Project[]>([]);
let pollInterval: ReturnType<typeof setInterval> | null = null;

async function fetchProjects(opts?: { showLoading?: boolean }) {
  if (opts?.showLoading) {
    loading.value = true;
  }
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

const isAnyTransitioning = computed(() =>
  projects.value.some(
    (p) => p.status === "creating" || p.status === "starting" || p.status === "stopping",
  ),
);

watch(isAnyTransitioning, (transitioning) => {
  if (transitioning && !pollInterval) {
    pollInterval = setInterval(fetchProjects, 3000);
  } else if (!transitioning && pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
});

onMounted(() => {
  fetchProjects({ showLoading: true });
});

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
});

function handleProjectStarting(projectId: string) {
  const idx = projects.value.findIndex((p) => p.id === projectId);
  if (idx !== -1) {
    projects.value[idx] = { ...projects.value[idx], status: "starting" };
  }
  // isAnyTransitioning watcher will start polling automatically
}

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
        <h1 class="page-title">Projects</h1>
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
      <button class="btn-retry" @click="fetchProjects({ showLoading: true })">Try again</button>
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
    <div v-else class="project-grid">
      <ProjectCard
        v-for="project in projects"
        :key="project.id"
        :project="project"
        @starting="handleProjectStarting(project.id)"
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
  gap: var(--space-6);
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.page-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.btn-new {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  min-height: var(--touch-min);
  padding: var(--space-2) var(--space-4);
  background: var(--color-accent);
  color: #ffffff;
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 0.875rem;
  border-radius: var(--radius-sm);
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
  transition:
    background var(--transition-fast),
    transform var(--transition-fast);
}

.btn-new:hover {
  background: var(--color-accent-hover);
  color: #ffffff;
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
  gap: var(--space-4);
  padding: var(--space-8) var(--space-4);
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
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

/* Error state */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-8) var(--space-4);
  border: 1px dashed var(--color-danger);
  border-radius: var(--radius-md);
  text-align: center;
}

.error-text {
  color: var(--color-danger);
  font-size: 0.9375rem;
}

.btn-retry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-min);
  padding: var(--space-2) var(--space-5);
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.btn-retry:hover {
  background: var(--color-bg-surface);
  color: var(--color-text);
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-8) var(--space-4);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  text-align: center;
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--color-text-muted);
}

.empty-icon svg {
  width: 100%;
  height: 100%;
}

.empty-text {
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-min);
  padding: var(--space-2) var(--space-5);
  background: var(--color-accent);
  color: #ffffff;
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 0.9375rem;
  border-radius: var(--radius-sm);
  text-decoration: none;
  transition:
    background var(--transition-fast),
    transform var(--transition-fast);
}

.btn-primary:hover {
  background: var(--color-accent-hover);
  color: #ffffff;
}

/* Project grid */
.project-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}

@media (min-width: 720px) {
  .project-grid {
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  }
}
</style>
