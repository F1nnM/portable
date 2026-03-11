<script setup lang="ts">
import type { Project } from "~/types/project";

const route = useRoute();
const slug = computed(() => route.params.slug as string);

const projectName = ref("");
const projectStatus = ref<Project["status"]>("stopped");

async function fetchProject() {
  try {
    const data = await $fetch<{ projects: Project[] }>("/api/projects");
    const project = data.projects.find((p) => p.slug === slug.value);
    if (project) {
      projectName.value = project.name;
      projectStatus.value = project.status;
    }
  } catch {
    // Silently fail -- the parent page handles error states
  }
}

onMounted(fetchProject);

watch(slug, fetchProject);

const statusConfig = computed(() => {
  switch (projectStatus.value) {
    case "running":
      return { label: "Running", class: "pill-running" };
    case "creating":
      return { label: "Creating", class: "pill-creating" };
    case "starting":
      return { label: "Starting", class: "pill-starting" };
    case "stopping":
      return { label: "Stopping", class: "pill-stopping" };
    case "error":
      return { label: "Error", class: "pill-error" };
    case "stopped":
    default:
      return { label: "Stopped", class: "pill-stopped" };
  }
});

const tabs = computed(() => [
  { path: `/projects/${slug.value}/chat`, label: "Chat", icon: "chat" },
  { path: `/projects/${slug.value}/files`, label: "Files", icon: "files" },
  { path: `/projects/${slug.value}/git`, label: "Git", icon: "git" },
  { path: `/projects/${slug.value}/preview`, label: "Preview", icon: "preview" },
]);

function isTabActive(tabPath: string): boolean {
  return route.path === tabPath || route.path.startsWith(`${tabPath}/`);
}
</script>

<template>
  <div class="project-layout">
    <!-- Top bar -->
    <header class="project-topbar">
      <NuxtLink to="/" class="topbar-back" aria-label="Back to dashboard">
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
      </NuxtLink>

      <div class="topbar-center">
        <span class="topbar-project-name">{{ projectName || slug }}</span>
        <span class="topbar-status-pill" :class="statusConfig.class">
          {{ statusConfig.label }}
        </span>
      </div>

      <!-- Spacer to balance the back button for centering -->
      <div class="topbar-spacer" />
    </header>

    <!-- Main content area -->
    <main class="project-content">
      <slot />
    </main>

    <!-- Bottom tab bar -->
    <nav class="project-tabbar">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="tab-item"
        :class="{ active: isTabActive(tab.path) }"
      >
        <!-- Chat icon: speech bubble -->
        <svg
          v-if="tab.icon === 'chat'"
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

        <!-- Files icon: document -->
        <svg
          v-else-if="tab.icon === 'files'"
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

        <!-- Git icon: branch/fork -->
        <svg
          v-else-if="tab.icon === 'git'"
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

        <!-- Preview icon: eye -->
        <svg
          v-else-if="tab.icon === 'preview'"
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

        <span class="tab-label">{{ tab.label }}</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
.project-layout {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
}

/* Top bar */
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
  z-index: 100;
}

.topbar-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
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

/* Main content */
.project-content {
  flex: 1;
  overflow: hidden;
}

/* Bottom tab bar */
.project-tabbar {
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  height: 56px;
  background: var(--color-bg-surface);
  border-top: 1px solid var(--color-border);
  box-shadow: 0 -2px 8px rgba(44, 40, 37, 0.04);
  flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
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
  text-decoration: none;
  border-top: 2px solid transparent;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
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
