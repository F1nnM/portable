<script setup lang="ts">
import type { Project } from "~/types/project";
import ProjectCard from "~/components/ProjectCard.vue";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "1",
    name: "My Project",
    slug: "my-project",
    scaffoldId: "nuxt-postgres",
    status: "stopped",
    repoUrl: "https://github.com/user/my-project",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const sampleProjects: Project[] = [
  makeProject({ id: "1", name: "portable", slug: "portable", status: "running" }),
  makeProject({ id: "2", name: "Blog Redesign", slug: "blog-redesign", status: "stopped" }),
  makeProject({ id: "3", name: "API Gateway", slug: "api-gateway", status: "starting" }),
  makeProject({ id: "4", name: "Mobile App", slug: "mobile-app", status: "error" }),
];
</script>

<template>
  <Story title="Pages / Dashboard" group="pages">
    <Variant title="With Projects">
      <div style="max-width: 720px; padding: 16px">
        <div class="dashboard">
          <div class="page-header">
            <h1 class="page-title">Projects</h1>
          </div>
          <div class="project-grid">
            <ProjectCard v-for="project in sampleProjects" :key="project.id" :project="project" />
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Loading (Skeleton)">
      <div style="max-width: 720px; padding: 16px">
        <div class="dashboard">
          <div class="page-header">
            <h1 class="page-title">Projects</h1>
          </div>
          <div class="project-grid">
            <div v-for="n in 3" :key="n" class="skeleton-card">
              <div class="skeleton-line skeleton-name" />
              <div class="skeleton-line skeleton-status" />
            </div>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Empty State">
      <div style="max-width: 720px; padding: 16px">
        <div class="dashboard">
          <div class="page-header">
            <h1 class="page-title">Projects</h1>
          </div>
          <div class="empty-state">
            <div class="empty-icon">
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="6" y="6" width="36" height="36" rx="6" />
                <line x1="24" y1="16" x2="24" y2="32" />
                <line x1="16" y1="24" x2="32" y2="24" />
              </svg>
            </div>
            <p class="empty-title">No projects yet</p>
            <p class="empty-description">
              Create your first project to get started with Claude Code.
            </p>
            <button class="btn-primary">Create your first project</button>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Error State">
      <div style="max-width: 720px; padding: 16px">
        <div class="dashboard">
          <div class="page-header">
            <h1 class="page-title">Projects</h1>
          </div>
          <div class="error-state">
            <p class="error-text">Failed to load projects</p>
            <button class="btn-retry">Try again</button>
          </div>
        </div>
      </div>
    </Variant>
  </Story>
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
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.project-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
}

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
}

.skeleton-line {
  border-radius: var(--radius-full);
  background: var(--color-bg-inset);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-name {
  height: 20px;
  width: 55%;
}
.skeleton-status {
  height: 12px;
  width: 25%;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

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
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.btn-retry:hover {
  background: var(--color-bg-surface);
  color: var(--color-text);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  color: var(--color-accent);
  opacity: 0.4;
}

.empty-icon svg {
  width: 100%;
  height: 100%;
}

.empty-title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
}

.empty-description {
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  max-width: 320px;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-min);
  padding: var(--space-3) var(--space-5);
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-base);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    transform var(--transition-fast);
}

.btn-primary:hover {
  background: var(--color-accent-hover);
}
</style>
