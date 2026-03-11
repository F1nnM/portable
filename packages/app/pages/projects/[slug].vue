<script setup lang="ts">
import type { Project } from "~/types/project";

definePageMeta({
  layout: false,
});

const route = useRoute();
const slug = computed(() => route.params.slug as string);

const project = ref<Project | null>(null);
const loading = ref(true);
const fetchError = ref("");
const currentPhase = ref<string | null>(null);
const startActionLoading = ref(false);
const startActionError = ref("");

// Ordered list of all possible phases for the progress checklist
const allPhases = [
  { key: "creating_database", label: "Setting up database..." },
  { key: "creating_repository", label: "Creating repository..." },
  { key: "pushing_scaffold", label: "Scaffolding application..." },
  { key: "initializing", label: "Initializing workspace..." },
  { key: "cloning", label: "Cloning repository..." },
  { key: "installing", label: "Installing dependencies..." },
  { key: "starting_server", label: "Starting server..." },
  { key: "ready", label: "Ready" },
] as const;

// Determine which phases are relevant based on the project type.
// Scaffold projects go through creating_database -> creating_repository -> pushing_scaffold -> pod phases.
// Imported repo projects go through creating_database -> pod phases (skip creating_repository and pushing_scaffold).
// When status is "starting" (not "creating"), only show pod-level phases.
const relevantPhases = computed(() => {
  if (!project.value) return [];

  const isCreating = project.value.status === "creating";
  const isScaffold = project.value.scaffoldId !== null;

  if (isCreating) {
    if (isScaffold) {
      return allPhases;
    }
    // Imported repo: skip creating_repository and pushing_scaffold
    return allPhases.filter((p) => p.key !== "creating_repository" && p.key !== "pushing_scaffold");
  }

  // Starting: only pod-level phases
  return allPhases.filter(
    (p) =>
      p.key !== "creating_database" &&
      p.key !== "creating_repository" &&
      p.key !== "pushing_scaffold",
  );
});

// Determine phase status for the checklist
function getPhaseStatus(phaseKey: string): "completed" | "current" | "pending" {
  if (!currentPhase.value) return "pending";

  const relevant = relevantPhases.value;
  const currentIdx = relevant.findIndex((p) => p.key === currentPhase.value);
  const thisIdx = relevant.findIndex((p) => p.key === phaseKey);

  if (currentIdx === -1 || thisIdx === -1) return "pending";
  if (thisIdx < currentIdx) return "completed";
  if (thisIdx === currentIdx) return "current";
  return "pending";
}

async function fetchProject() {
  fetchError.value = "";
  try {
    const data = await $fetch<{ projects: Project[] }>("/api/projects");
    const found = data.projects.find((p) => p.slug === slug.value);
    if (!found) {
      fetchError.value = "Project not found";
      return;
    }
    project.value = found;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load project";
    fetchError.value = msg;
  } finally {
    loading.value = false;
  }
}

// Poll for status updates during transitions
let statusPollInterval: ReturnType<typeof setInterval> | null = null;

async function pollStatus() {
  try {
    const data = await $fetch<{ status: string; phase: string | null }>(
      `/api/projects/${slug.value}/status`,
    );
    currentPhase.value = data.phase;

    // Update the local project status
    if (project.value && data.status !== project.value.status) {
      project.value = { ...project.value, status: data.status as Project["status"] };
    }

    // If the project is now running, navigate to chat
    if (data.status === "running") {
      stopPolling();
      await navigateTo(`/projects/${slug.value}/chat`);
    }

    // If the project errored, stop polling
    if (data.status === "error" || data.status === "stopped") {
      stopPolling();
      // Refresh the full project data to get latest status
      await fetchProject();
    }
  } catch {
    // Ignore poll errors
  }
}

function startPolling() {
  stopPolling();
  pollStatus();
  statusPollInterval = setInterval(pollStatus, 2000);
}

function stopPolling() {
  if (statusPollInterval) {
    clearInterval(statusPollInterval);
    statusPollInterval = null;
  }
}

const isTransitioning = computed(
  () =>
    project.value?.status === "creating" ||
    project.value?.status === "starting" ||
    project.value?.status === "stopping",
);

// Watch for transition states to start/stop polling
watch(
  isTransitioning,
  (transitioning) => {
    if (transitioning) {
      startPolling();
    } else {
      stopPolling();
    }
  },
  { immediate: false },
);

async function handleStart() {
  if (startActionLoading.value || !project.value) return;
  startActionLoading.value = true;
  startActionError.value = "";
  try {
    await $fetch(`/api/projects/${slug.value}/start`, { method: "POST" });
    // Optimistically set status to starting
    project.value = { ...project.value, status: "starting" };
    startPolling();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to start project";
    startActionError.value = msg;
  } finally {
    startActionLoading.value = false;
  }
}

async function handleRetry() {
  // Same as start for error state
  await handleStart();
}

onMounted(async () => {
  await fetchProject();
  // If project is already in a transitioning state, start polling
  if (isTransitioning.value) {
    startPolling();
  }
  // If the project is running, navigate to chat immediately
  if (project.value?.status === "running") {
    await navigateTo(`/projects/${slug.value}/chat`);
  }
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <!-- Running: show project layout with child routes -->
  <NuxtLayout v-if="project?.status === 'running'" name="project">
    <NuxtPage />
  </NuxtLayout>

  <!-- Non-running states: show status screen -->
  <div v-else class="status-screen">
    <!-- Loading state while fetching project -->
    <div v-if="loading" class="status-center">
      <div class="loading-spinner" />
      <span class="loading-text">Loading project...</span>
    </div>

    <!-- Fetch error -->
    <div v-else-if="fetchError" class="status-center">
      <div class="status-icon status-icon-error">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <h2 class="status-title">Something went wrong</h2>
      <p class="status-message">{{ fetchError }}</p>
      <button class="btn-primary" @click="fetchProject">Try again</button>
      <NuxtLink to="/" class="link-back">Back to dashboard</NuxtLink>
    </div>

    <!-- Creating / Starting: progress checklist -->
    <div v-else-if="isTransitioning" class="status-center">
      <h2 class="status-title">{{ project?.name }}</h2>
      <p class="status-subtitle">
        {{ project?.status === "creating" ? "Setting up your project..." : "Starting up..." }}
      </p>

      <div class="progress-checklist">
        <div
          v-for="phase in relevantPhases"
          :key="phase.key"
          class="phase-item"
          :class="`phase-${getPhaseStatus(phase.key)}`"
        >
          <div class="phase-indicator">
            <!-- Completed: checkmark -->
            <svg
              v-if="getPhaseStatus(phase.key) === 'completed'"
              class="phase-check"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>

            <!-- Current: spinner -->
            <div v-else-if="getPhaseStatus(phase.key) === 'current'" class="phase-spinner" />

            <!-- Pending: empty circle -->
            <div v-else class="phase-circle" />
          </div>
          <span class="phase-label">{{ phase.label }}</span>
        </div>
      </div>
    </div>

    <!-- Stopped -->
    <div v-else-if="project?.status === 'stopped'" class="status-center">
      <div class="status-icon status-icon-stopped">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      </div>
      <h2 class="status-title">{{ project?.name }}</h2>
      <p class="status-message">This project is stopped.</p>
      <div v-if="startActionError" class="action-error">{{ startActionError }}</div>
      <button class="btn-primary" :disabled="startActionLoading" @click="handleStart">
        <svg
          v-if="!startActionLoading"
          viewBox="0 0 24 24"
          fill="currentColor"
          width="16"
          height="16"
        >
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        {{ startActionLoading ? "Starting..." : "Start Project" }}
      </button>
      <NuxtLink to="/" class="link-back">Back to dashboard</NuxtLink>
    </div>

    <!-- Error -->
    <div v-else-if="project?.status === 'error'" class="status-center">
      <div class="status-icon status-icon-error">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <h2 class="status-title">{{ project?.name }}</h2>
      <p class="status-message">Something went wrong with this project.</p>
      <div v-if="startActionError" class="action-error">{{ startActionError }}</div>
      <button class="btn-primary" :disabled="startActionLoading" @click="handleRetry">
        {{ startActionLoading ? "Starting..." : "Try starting again" }}
      </button>
      <NuxtLink to="/" class="link-back">Back to dashboard</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.status-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  background: var(--color-bg);
  padding: var(--space-5);
}

.status-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  max-width: 400px;
  width: 100%;
  text-align: center;
}

/* Loading spinner */
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
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* Status icons */
.status-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
}

.status-icon svg {
  width: 32px;
  height: 32px;
}

.status-icon-stopped {
  background: var(--color-bg-inset);
  color: var(--color-text-muted);
}

.status-icon-error {
  background: var(--color-danger-tint);
  color: var(--color-danger);
}

/* Status text */
.status-title {
  font-family: var(--font-sans);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.status-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

.status-message {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}

.action-error {
  font-size: var(--font-size-sm);
  color: var(--color-danger);
  padding: var(--space-2) var(--space-4);
  background: var(--color-danger-tint);
  border-radius: var(--radius-sm);
  width: 100%;
}

/* Primary button */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--touch-min);
  padding: var(--space-3) var(--space-7);
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-base);
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(217, 122, 62, 0.2);
  transition:
    background var(--transition-fast),
    opacity var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(217, 122, 62, 0.3);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-primary svg {
  width: 16px;
  height: 16px;
}

/* Back link */
.link-back {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.link-back:hover {
  color: var(--color-text-secondary);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* Progress checklist */
.progress-checklist {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  max-width: 320px;
  margin-top: var(--space-5);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  box-shadow: var(--shadow-card);
}

.phase-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  position: relative;
}

/* Vertical connector line between phases */
.phase-item:not(:last-child)::after {
  content: "";
  position: absolute;
  left: 11px;
  top: calc(var(--space-3) + 22px);
  bottom: 0;
  width: 2px;
  background: var(--color-border);
}

.phase-item.phase-completed:not(:last-child)::after {
  background: var(--color-success);
}

.phase-indicator {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

/* Completed checkmark */
.phase-check {
  width: 20px;
  height: 20px;
  color: var(--color-success);
}

/* Current phase spinner */
.phase-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Pending empty circle */
.phase-circle {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-bg);
}

/* Phase labels */
.phase-label {
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  text-align: left;
}

.phase-completed .phase-label {
  color: var(--color-text-muted);
}

.phase-current .phase-label {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.phase-pending .phase-label {
  color: var(--color-text-muted);
  opacity: 0.6;
}
</style>
