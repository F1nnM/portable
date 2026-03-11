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
      <h1 class="page-title"><span class="title-prefix">//</span> Projects</h1>
    </div>

    <!-- Loading state with skeleton cards -->
    <div v-if="loading" class="project-grid">
      <div v-for="n in 3" :key="n" class="skeleton-card">
        <div class="skeleton-line skeleton-name" />
        <div class="skeleton-line skeleton-status" />
      </div>
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
      <div class="empty-state-bg" />
      <div class="empty-icon">
        <span class="empty-prompt">&gt;_</span>
      </div>
      <p class="empty-title">No projects yet</p>
      <p class="empty-description">
        Start building with Claude Code. Create a project from a scaffold or import a repo.
      </p>
      <NuxtLink to="/projects/new" class="btn-primary">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          width="18"
          height="18"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Create your first project
      </NuxtLink>
    </div>

    <!-- Project list -->
    <div v-else class="project-grid">
      <ProjectCard
        v-for="(project, index) in projects"
        :key="project.id"
        :project="project"
        class="card-enter"
        :style="{ '--card-index': index }"
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
  align-items: center;
  justify-content: space-between;
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

/* Project grid */
.project-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
}

@media (min-width: 720px) {
  .project-grid {
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  }
}

/* Card entrance animation */
.card-enter {
  animation: card-fade-in 0.4s ease both;
  animation-delay: calc(var(--card-index, 0) * 60ms);
}

@keyframes card-fade-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Skeleton loading cards */
.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.skeleton-line {
  position: relative;
  border-radius: var(--radius-full);
  background: var(--color-bg-inset);
  overflow: hidden;
}

.skeleton-line::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-bg-elevated) 40%,
    var(--color-bg-elevated) 60%,
    transparent 100%
  );
  animation: skeleton-shimmer 1.8s ease-in-out infinite;
}

.skeleton-name {
  height: 20px;
  width: 55%;
}

.skeleton-status {
  height: 12px;
  width: 25%;
}

@keyframes skeleton-shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* Error state */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-8) var(--space-4);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  background: var(--color-danger-tint);
  text-align: center;
}

.error-text {
  color: var(--color-danger);
  font-size: var(--font-size-base);
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
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
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
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-8) var(--space-4);
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.empty-state-bg {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, var(--color-border) 1px, transparent 1px);
  background-size: 20px 20px;
  opacity: 0.5;
  pointer-events: none;
}

.empty-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: var(--radius-lg);
  background: var(--color-accent-tint);
  border: 1px solid var(--color-border);
  animation: empty-float 3s ease-in-out infinite;
}

.empty-prompt {
  font-family: var(--font-mono);
  font-size: 2rem;
  font-weight: var(--font-weight-bold);
  color: var(--color-accent);
  line-height: 1;
}

@keyframes empty-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

.empty-title {
  position: relative;
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.02em;
}

.empty-description {
  position: relative;
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  max-width: 340px;
  line-height: var(--line-height-base);
}

.btn-primary {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--touch-min);
  padding: var(--space-3) var(--space-6);
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-base);
  border-radius: var(--radius-sm);
  text-decoration: none;
  box-shadow: 0 2px 8px rgba(217, 122, 62, 0.2);
  transition:
    background var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.btn-primary:hover {
  background: var(--color-accent-hover);
  color: var(--color-accent-text);
  box-shadow: 0 4px 16px rgba(217, 122, 62, 0.3);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: scale(0.98);
  box-shadow: 0 1px 4px rgba(217, 122, 62, 0.15);
}
</style>
