<script setup lang="ts">
import type { Project } from "~/types/project";

const props = defineProps<{
  project: Project;
}>();

const emit = defineEmits<{
  updated: [];
  deleted: [];
  starting: [];
}>();

const currentAction = ref<"starting" | "stopping" | "renaming" | "deleting" | null>(null);
const isActioning = computed(() => currentAction.value !== null);
const showRenameSheet = ref(false);
const showDeleteSheet = ref(false);
const showDeleteConfirmSheet = ref(false);
const showMenu = ref(false);
const menuButtonRef = ref<HTMLElement | null>(null);
const menuPosition = ref({ top: 0, right: 0 });
const renameInput = ref(props.project.name);
const deleteGithubRepo = ref(false);
const actionError = ref("");

const startupPhase = ref<string | null>(null);
let phaseInterval: ReturnType<typeof setInterval> | null = null;

const phaseLabels: Record<string, string> = {
  // Creation phases
  creating_database: "Setting up database...",
  creating_repository: "Creating repository...",
  pushing_scaffold: "Scaffolding application...",
  // Startup phases
  preparing: "Launching container...",
  initializing: "Initializing workspace...",
  cloning: "Cloning repository...",
  installing: "Installing dependencies...",
  building: "Building application...",
  starting_server: "Starting server...",
  ready: "Almost ready...",
};

const phaseDisplay = computed(() => {
  if (!startupPhase.value) return null;
  return phaseLabels[startupPhase.value] ?? startupPhase.value;
});

async function pollPhase() {
  try {
    const data = await $fetch<{ status: string; phase: string | null }>(
      `/api/projects/${props.project.slug}/status`,
    );
    startupPhase.value = data.phase;
  } catch {
    // Ignore errors during polling
  }
}

function startPolling() {
  stopPolling();
  pollPhase();
  phaseInterval = setInterval(pollPhase, 2000);
}

function stopPolling() {
  if (phaseInterval) {
    clearInterval(phaseInterval);
    phaseInterval = null;
  }
  startupPhase.value = null;
}

watch(
  () => props.project.status,
  (status) => {
    if (status === "starting" || status === "creating") {
      startPolling();
    } else {
      stopPolling();
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  stopPolling();
});

const statusConfig = computed(() => {
  switch (props.project.status) {
    case "running":
      return { label: "Running", class: "status-running" };
    case "creating":
      return { label: "Setting up", class: "status-creating" };
    case "starting":
      return { label: "Starting", class: "status-starting" };
    case "stopping":
      return { label: "Stopping", class: "status-stopping" };
    case "error":
      return { label: "Error", class: "status-error" };
    case "stopped":
    default:
      return { label: "Stopped", class: "status-stopped" };
  }
});

const isTransitioning = computed(
  () =>
    props.project.status === "creating" ||
    props.project.status === "starting" ||
    props.project.status === "stopping",
);

const canStart = computed(
  () => props.project.status === "stopped" || props.project.status === "error",
);
const canStop = computed(
  () => props.project.status === "running" || props.project.status === "starting",
);

function toggleMenu() {
  if (!showMenu.value && menuButtonRef.value) {
    const rect = menuButtonRef.value.getBoundingClientRect();
    menuPosition.value = {
      top: rect.bottom,
      right: window.innerWidth - rect.right,
    };
  }
  showMenu.value = !showMenu.value;
}

function closeMenu() {
  showMenu.value = false;
}

function openRename() {
  renameInput.value = props.project.name;
  actionError.value = "";
  showRenameSheet.value = true;
  closeMenu();
}

function openDelete() {
  actionError.value = "";
  deleteGithubRepo.value = false;
  showDeleteSheet.value = true;
  showDeleteConfirmSheet.value = false;
  closeMenu();
}

function proceedToDeleteConfirm() {
  showDeleteSheet.value = false;
  showDeleteConfirmSheet.value = true;
}

async function handleStart() {
  if (isActioning.value) return;
  currentAction.value = "starting";
  actionError.value = "";
  closeMenu();
  try {
    await $fetch(`/api/projects/${props.project.slug}/start`, { method: "POST" });
    emit("starting");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to start project";
    actionError.value = msg;
  } finally {
    currentAction.value = null;
  }
}

async function handleStop() {
  if (isActioning.value) return;
  currentAction.value = "stopping";
  actionError.value = "";
  closeMenu();
  try {
    await $fetch(`/api/projects/${props.project.slug}/stop`, { method: "POST" });
    emit("updated");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to stop project";
    actionError.value = msg;
  } finally {
    currentAction.value = null;
  }
}

async function handleRename() {
  const trimmed = renameInput.value.trim();
  if (!trimmed || trimmed === props.project.name) {
    showRenameSheet.value = false;
    return;
  }
  if (isActioning.value) return;
  currentAction.value = "renaming";
  actionError.value = "";
  try {
    await $fetch(`/api/projects/${props.project.slug}`, {
      method: "PATCH",
      body: { name: trimmed },
    });
    showRenameSheet.value = false;
    emit("updated");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to rename project";
    actionError.value = msg;
  } finally {
    currentAction.value = null;
  }
}

async function handleDelete() {
  if (isActioning.value) return;
  currentAction.value = "deleting";
  actionError.value = "";
  try {
    await $fetch(`/api/projects/${props.project.slug}`, {
      method: "DELETE",
      body: { deleteGithubRepo: deleteGithubRepo.value },
    });
    showDeleteConfirmSheet.value = false;
    emit("deleted");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete project";
    actionError.value = msg;
  } finally {
    currentAction.value = null;
  }
}

function handleRenameKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    handleRename();
  }
}

function openGithubRepo() {
  if (props.project.repoUrl) {
    window.open(props.project.repoUrl, "_blank", "noopener");
  }
  closeMenu();
}
</script>

<template>
  <div class="project-card">
    <NuxtLink :to="`/projects/${project.slug}`" class="card-link">
      <div class="card-info">
        <h3 class="project-name">
          {{ project.name }}
        </h3>
        <div class="card-status-line">
          <span class="status-indicator" :class="statusConfig.class">
            <span v-if="project.status === 'running'" class="status-dot status-dot-pulse" />
            <span v-else-if="isTransitioning" class="status-dot status-dot-blink" />
            <span v-else class="status-dot" />
            {{ phaseDisplay || statusConfig.label }}
          </span>
        </div>
      </div>
    </NuxtLink>

    <div class="card-actions-area">
      <div class="menu-container">
        <button
          ref="menuButtonRef"
          class="btn-menu"
          aria-label="Project actions"
          @click.prevent="toggleMenu"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="actionError" class="action-error">
      {{ actionError }}
    </div>

    <!-- Context menu -->
    <Teleport to="body">
      <div v-if="showMenu" class="menu-backdrop" @click="closeMenu" />
      <Transition name="menu-fade">
        <div
          v-if="showMenu"
          class="menu-dropdown"
          :style="{ top: `${menuPosition.top}px`, right: `${menuPosition.right}px` }"
        >
          <button v-if="canStart" class="menu-item" @click="handleStart">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Start
          </button>
          <button v-if="canStop" class="menu-item" @click="handleStop">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            Stop
          </button>
          <button class="menu-item" @click="openRename">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              width="16"
              height="16"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Rename
          </button>
          <button v-if="project.repoUrl" class="menu-item" @click="openGithubRepo">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            Open GitHub
          </button>
          <button class="menu-item menu-item-danger" @click="openDelete">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              width="16"
              height="16"
            >
              <polyline points="3 6 5 6 21 6" />
              <path
                d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
              />
            </svg>
            Delete
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- Rename bottom sheet -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="showRenameSheet" class="sheet-overlay" @click.self="showRenameSheet = false">
          <div class="sheet-content">
            <div class="sheet-header">
              <h3 class="sheet-title">Rename Project</h3>
              <button class="btn-sheet-close" @click="showRenameSheet = false">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  width="20"
                  height="20"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div class="sheet-body">
              <label class="input-label" for="rename-input">Project name</label>
              <input
                id="rename-input"
                v-model="renameInput"
                class="input-field"
                type="text"
                placeholder="Project name"
                maxlength="100"
                @keydown="handleRenameKeydown"
              />
              <div v-if="actionError" class="sheet-error">
                {{ actionError }}
              </div>
            </div>
            <div class="sheet-actions">
              <button class="btn-sheet btn-sheet-cancel" @click="showRenameSheet = false">
                Cancel
              </button>
              <button
                class="btn-sheet btn-sheet-save"
                :disabled="
                  isActioning || !renameInput.trim() || renameInput.trim() === project.name
                "
                @click="handleRename"
              >
                {{ isActioning ? "Saving..." : "Save" }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete stage 1: options -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="showDeleteSheet" class="sheet-overlay" @click.self="showDeleteSheet = false">
          <div class="sheet-content">
            <div class="sheet-header">
              <h3 class="sheet-title sheet-title-danger">Delete Project</h3>
              <button class="btn-sheet-close" @click="showDeleteSheet = false">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  width="20"
                  height="20"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div class="sheet-body">
              <p class="delete-warning">
                This will permanently delete the project
                <strong>{{ project.name }}</strong> from Portable, including all workspace data and
                configuration. This cannot be undone.
              </p>
              <label v-if="project.repoUrl" class="checkbox-label checkbox-label-danger">
                <input v-model="deleteGithubRepo" type="checkbox" class="checkbox-input" />
                Also delete the GitHub repository
              </label>
            </div>
            <div class="sheet-actions">
              <button class="btn-sheet btn-sheet-cancel" @click="showDeleteSheet = false">
                Cancel
              </button>
              <button class="btn-sheet btn-sheet-next" @click="proceedToDeleteConfirm">Next</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete stage 2: confirm -->
    <Teleport to="body">
      <Transition name="sheet">
        <div
          v-if="showDeleteConfirmSheet"
          class="sheet-overlay"
          @click.self="showDeleteConfirmSheet = false"
        >
          <div class="sheet-content">
            <div class="sheet-header">
              <h3 class="sheet-title sheet-title-danger">Confirm Deletion</h3>
              <button class="btn-sheet-close" @click="showDeleteConfirmSheet = false">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  width="20"
                  height="20"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div class="sheet-body">
              <p v-if="deleteGithubRepo" class="delete-repo-warning">
                The GitHub repository will be permanently deleted. All code, issues, and pull
                requests will be lost.
              </p>
              <p v-else-if="project.repoUrl" class="delete-repo-safe">
                The GitHub repository will not be affected and will continue to exist.
              </p>
              <div v-if="actionError" class="sheet-error">
                {{ actionError }}
              </div>
            </div>
            <div class="sheet-actions">
              <button class="btn-sheet btn-sheet-cancel" @click="showDeleteConfirmSheet = false">
                Cancel
              </button>
              <button
                class="btn-sheet btn-sheet-delete"
                :disabled="isActioning"
                @click="handleDelete"
              >
                {{ isActioning ? "Deleting..." : "Delete" }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.project-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background:
    linear-gradient(to bottom, var(--card-border-color, var(--color-border-strong)), transparent)
      left / 4px 100% no-repeat,
    var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-5);
  padding-left: calc(var(--space-5) + 4px);
  box-shadow: var(--shadow-card);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast),
    background-size var(--transition-fast);
}

.project-card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-elevated);
  transform: translateY(-1px) scale(1.01);
  background-size:
    5px 100%,
    auto;
}

.project-card:has(.status-running) {
  --card-border-color: var(--color-success);
}

.project-card:has(.status-creating),
.project-card:has(.status-starting),
.project-card:has(.status-stopping) {
  --card-border-color: var(--color-warning);
}

.project-card:has(.status-error) {
  --card-border-color: var(--color-danger);
}

/* Card link fills the card area */
.card-link {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  flex: 1;
}

.project-name {
  font-family: var(--font-sans);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  line-height: var(--line-height-tight);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
}

.card-status-line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Status indicator (dot + text) */
.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
  white-space: nowrap;
}

.status-stopped {
  color: var(--color-text-muted);
}

.status-running {
  color: var(--color-success);
}

.status-creating,
.status-starting,
.status-stopping {
  color: var(--color-warning);
}

.status-error {
  color: var(--color-danger);
}

/* Status dot */
.status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.status-dot-pulse {
  animation: pulse 2s ease-in-out infinite;
}

.status-dot-blink {
  animation: blink 1s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* Actions area */
.card-actions-area {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.btn-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  transition:
    color var(--transition-fast),
    background var(--transition-fast);
}

.btn-menu:hover {
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
}

.btn-menu svg {
  width: 20px;
  height: 20px;
}

/* Action error */
.action-error {
  width: 100%;
  font-size: var(--font-size-xs);
  color: var(--color-danger);
  padding: var(--space-1) 0;
}

/* Bottom sheet overlay */
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.sheet-content {
  width: 100%;
  max-width: 480px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-bottom: none;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--space-5);
  padding-bottom: calc(var(--space-5) + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sheet-title {
  font-family: var(--font-sans);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
}

.sheet-title-danger {
  color: var(--color-danger);
}

.btn-sheet-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition:
    color var(--transition-fast),
    background var(--transition-fast);
}

.btn-sheet-close:hover {
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
}

.btn-sheet-close svg {
  width: 20px;
  height: 20px;
}

.sheet-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.input-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-normal);
  color: var(--color-text-secondary);
}

.input-field {
  width: 100%;
  min-height: var(--touch-min);
  padding: var(--space-2) var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  color: var(--color-text);
  outline: none;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.input-field:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-tint);
}

.input-field::placeholder {
  color: var(--color-text-muted);
}

.sheet-error {
  font-size: var(--font-size-xs);
  color: var(--color-danger);
}

.delete-warning {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}

.delete-warning strong {
  color: var(--color-text);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
  padding: var(--space-1) 0;
}

.checkbox-label-danger {
  margin-top: var(--space-2);
}

.delete-repo-warning,
.delete-repo-safe {
  font-size: var(--font-size-xs);
  line-height: var(--line-height-base);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
}

.delete-repo-warning {
  color: var(--color-danger);
  background: var(--color-danger-tint);
}

.delete-repo-safe {
  color: var(--color-text-muted);
  background: var(--color-bg-elevated);
}

.checkbox-input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-danger);
  cursor: pointer;
  flex-shrink: 0;
}

.sheet-actions {
  display: flex;
  gap: var(--space-2);
  padding-top: var(--space-2);
}

.btn-sheet {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-min);
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  border-radius: var(--radius-sm);
  transition:
    background var(--transition-fast),
    opacity var(--transition-fast);
}

.btn-sheet:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sheet-cancel {
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.btn-sheet-cancel:hover {
  background: var(--color-bg-surface);
  color: var(--color-text);
}

.btn-sheet-save {
  background: var(--color-accent);
  color: var(--color-accent-text);
}

.btn-sheet-save:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.btn-sheet-next {
  background: var(--color-bg-elevated);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-sheet-next:hover {
  background: var(--color-bg-surface);
  border-color: var(--color-border-strong);
}

.btn-sheet-delete {
  background: var(--color-danger);
  color: #ffffff;
}

.btn-sheet-delete:hover:not(:disabled) {
  background: #c03030;
}

/* Sheet transition */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity var(--transition-base);
}

.sheet-enter-active .sheet-content,
.sheet-leave-active .sheet-content {
  transition: transform var(--transition-base);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet-content,
.sheet-leave-to .sheet-content {
  transform: translateY(100%);
}

/* Desktop: center bottom sheet as a modal */
@media (min-width: 768px) {
  .sheet-overlay {
    align-items: center;
  }

  .sheet-content {
    border-radius: var(--radius-lg);
    border-bottom: 1px solid var(--color-border);
    padding-bottom: var(--space-5);
  }

  .sheet-enter-from .sheet-content,
  .sheet-leave-to .sheet-content {
    transform: translateY(20px);
  }
}
</style>

<style>
/* Teleported menu dropdown — unscoped so styles apply at body level */
.menu-dropdown {
  position: fixed;
  z-index: 200;
  min-width: 180px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-1);
  box-shadow: var(--shadow-elevated);
}

.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 199;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: var(--touch-min);
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  transition:
    color var(--transition-fast),
    background var(--transition-fast);
}

.menu-item:hover {
  background: var(--color-bg-surface);
  color: var(--color-text);
}

.menu-item svg {
  flex-shrink: 0;
}

.menu-item-danger {
  color: var(--color-danger);
}

.menu-item-danger:hover {
  background: var(--color-danger-tint);
  color: var(--color-danger);
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
