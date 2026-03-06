<script setup lang="ts">
import type { Project } from "~/types/project";

const props = defineProps<{
  project: Project;
}>();

const emit = defineEmits<{
  updated: [];
  deleted: [];
}>();

const isActioning = ref(false);
const showRenameSheet = ref(false);
const showDeleteSheet = ref(false);
const showMenu = ref(false);
const renameInput = ref(props.project.name);
const deleteGithubRepo = ref(false);
const actionError = ref("");

const phaseLabels: Record<string, string> = {
  // Creation phases
  creating_database: "Creating database...",
  creating_repository: "Creating repository...",
  pushing_scaffold: "Pushing code...",
  // Startup phases
  preparing: "Preparing...",
  initializing: "Initializing...",
  cloning: "Cloning repository...",
  installing: "Installing dependencies...",
  starting_server: "Starting server...",
  ready: "Almost ready...",
};

const phaseText = ref("");
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function pollStatus() {
  try {
    const data = await $fetch<{ status: string; phase?: string }>(
      `/api/projects/${props.project.slug}/status`,
    );
    if (data.phase && phaseLabels[data.phase]) {
      phaseText.value = phaseLabels[data.phase];
    } else {
      phaseText.value = "";
    }
  } catch {
    phaseText.value = "";
  }
}

function startPolling() {
  if (pollTimer) return;
  pollStatus();
  pollTimer = setInterval(pollStatus, 2000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  phaseText.value = "";
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
      return { label: "Creating", class: "status-creating" };
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

const projectUrl = computed(() => {
  if (typeof window === "undefined") return null;
  return `//${props.project.slug}.${window.location.host}`;
});

function toggleMenu() {
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
  closeMenu();
}

async function handleStart() {
  if (isActioning.value) return;
  isActioning.value = true;
  actionError.value = "";
  try {
    await $fetch(`/api/projects/${props.project.slug}/start`, { method: "POST" });
    emit("updated");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to start project";
    actionError.value = msg;
  } finally {
    isActioning.value = false;
  }
}

async function handleStop() {
  if (isActioning.value) return;
  isActioning.value = true;
  actionError.value = "";
  try {
    await $fetch(`/api/projects/${props.project.slug}/stop`, { method: "POST" });
    emit("updated");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to stop project";
    actionError.value = msg;
  } finally {
    isActioning.value = false;
  }
}

async function handleRename() {
  const trimmed = renameInput.value.trim();
  if (!trimmed || trimmed === props.project.name) {
    showRenameSheet.value = false;
    return;
  }
  if (isActioning.value) return;
  isActioning.value = true;
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
    isActioning.value = false;
  }
}

async function handleDelete() {
  if (isActioning.value) return;
  isActioning.value = true;
  actionError.value = "";
  try {
    await $fetch(`/api/projects/${props.project.slug}`, {
      method: "DELETE",
      body: { deleteGithubRepo: deleteGithubRepo.value },
    });
    showDeleteSheet.value = false;
    emit("deleted");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete project";
    actionError.value = msg;
  } finally {
    isActioning.value = false;
  }
}

function handleRenameKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    handleRename();
  }
}
</script>

<template>
  <div class="project-card">
    <div class="card-header">
      <div class="card-info">
        <h3 class="project-name">
          {{ project.name }}
        </h3>
        <span class="project-slug">{{ project.slug }}</span>
      </div>
      <div class="card-actions-area">
        <span class="status-badge" :class="statusConfig.class">
          <span v-if="project.status === 'running'" class="status-dot status-dot-pulse" />
          <span v-else-if="isTransitioning" class="status-dot status-dot-blink" />
          {{ statusConfig.label }}
        </span>
        <div class="menu-container">
          <button class="btn-menu" aria-label="Project actions" @click="toggleMenu">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
          <Transition name="menu-fade">
            <div v-if="showMenu" class="menu-dropdown">
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
          <div v-if="showMenu" class="menu-backdrop" @click="closeMenu" />
        </div>
      </div>
    </div>

    <div class="card-footer">
      <div v-if="actionError" class="action-error">
        {{ actionError }}
      </div>
      <a
        v-if="project.status === 'running' && projectUrl"
        :href="projectUrl"
        target="_blank"
        rel="noopener"
        class="btn-action btn-open"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          width="16"
          height="16"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        Open
      </a>
      <button
        v-if="canStart"
        class="btn-action btn-start"
        :disabled="isActioning"
        @click="handleStart"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        {{ isActioning ? "Starting..." : "Start" }}
      </button>
      <button
        v-if="canStop"
        class="btn-action btn-stop"
        :disabled="isActioning"
        @click="handleStop"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
        {{ isActioning ? "Stopping..." : "Stop" }}
      </button>
      <span v-if="isTransitioning" class="transitioning-label">
        {{
          phaseText
            ? phaseText
            : project.status === "creating"
              ? "Creating..."
              : project.status === "starting"
                ? "Starting..."
                : "Stopping..."
        }}
      </span>
    </div>

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

    <!-- Delete confirmation bottom sheet -->
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
                Delete <strong>{{ project.name }}</strong
                >? This cannot be undone.
              </p>
              <label v-if="project.repoUrl" class="checkbox-label">
                <input v-model="deleteGithubRepo" type="checkbox" class="checkbox-input" />
                Also delete GitHub repository
              </label>
              <div v-if="actionError" class="sheet-error">
                {{ actionError }}
              </div>
            </div>
            <div class="sheet-actions">
              <button class="btn-sheet btn-sheet-cancel" @click="showDeleteSheet = false">
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
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  transition: border-color var(--transition-base);
}

.project-card:hover {
  border-color: var(--border-subtle);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
  flex: 1;
}

.project-name {
  font-family: var(--font-display);
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-slug {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-actions-area {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

/* Status badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  letter-spacing: 0.02em;
}

.status-stopped {
  background: var(--bg-overlay);
  color: var(--text-muted);
}

.status-running {
  background: var(--accent-glow);
  color: var(--accent);
}

.status-creating,
.status-starting,
.status-stopping {
  background: rgba(255, 200, 50, 0.12);
  color: #e6b422;
}

.status-error {
  background: rgba(255, 77, 106, 0.12);
  color: var(--danger);
}

/* Pulsing dot */
.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
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

/* Menu */
.menu-container {
  position: relative;
}

.btn-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  transition:
    color var(--transition-fast),
    background var(--transition-fast);
}

.btn-menu:hover {
  color: var(--text-secondary);
  background: var(--bg-elevated);
}

.btn-menu svg {
  width: 20px;
  height: 20px;
}

.menu-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 200;
  min-width: 160px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-xs);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 199;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  min-height: var(--touch-min);
  padding: var(--space-sm) var(--space-md);
  font-size: 0.875rem;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  transition:
    color var(--transition-fast),
    background var(--transition-fast);
}

.menu-item:hover {
  background: var(--bg-overlay);
  color: var(--text-primary);
}

.menu-item svg {
  flex-shrink: 0;
}

.menu-item-danger {
  color: var(--danger);
}

.menu-item-danger:hover {
  background: rgba(255, 77, 106, 0.1);
  color: var(--danger);
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

/* Card footer */
.card-footer {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.action-error {
  width: 100%;
  font-size: 0.75rem;
  color: var(--danger);
  padding: var(--space-xs) 0;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  min-height: var(--touch-min);
  padding: var(--space-sm) var(--space-lg);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.875rem;
  border-radius: var(--radius-md);
  transition:
    background var(--transition-fast),
    transform var(--transition-fast),
    opacity var(--transition-fast);
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-action svg {
  width: 14px;
  height: 14px;
}

.btn-open {
  background: var(--bg-overlay);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  text-decoration: none;
}

.btn-open:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.btn-start {
  background: var(--accent);
  color: var(--accent-text);
}

.btn-start:hover:not(:disabled) {
  background: var(--accent-dim);
  transform: translateY(-1px);
}

.btn-stop {
  background: var(--bg-overlay);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.btn-stop:hover:not(:disabled) {
  background: var(--bg-elevated);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.transitioning-label {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: #e6b422;
  animation: blink 1s ease-in-out infinite;
}

/* Bottom sheet overlay */
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.sheet-content {
  width: 100%;
  max-width: 480px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--space-lg);
  padding-bottom: calc(var(--space-lg) + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sheet-title {
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 600;
}

.sheet-title-danger {
  color: var(--danger);
}

.btn-sheet-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  transition:
    color var(--transition-fast),
    background var(--transition-fast);
}

.btn-sheet-close:hover {
  color: var(--text-secondary);
  background: var(--bg-elevated);
}

.btn-sheet-close svg {
  width: 20px;
  height: 20px;
}

.sheet-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.input-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.input-field {
  width: 100%;
  min-height: var(--touch-min);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: 0.9375rem;
  color: var(--text-primary);
  outline: none;
  transition: border-color var(--transition-fast);
}

.input-field:focus {
  border-color: var(--accent);
}

.input-field::placeholder {
  color: var(--text-muted);
}

.sheet-error {
  font-size: 0.75rem;
  color: var(--danger);
}

.delete-warning {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.delete-warning strong {
  color: var(--text-primary);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  padding: var(--space-xs) 0;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  accent-color: var(--danger);
  cursor: pointer;
  flex-shrink: 0;
}

.sheet-actions {
  display: flex;
  gap: var(--space-sm);
  padding-top: var(--space-sm);
}

.btn-sheet {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-min);
  padding: var(--space-sm) var(--space-md);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.875rem;
  border-radius: var(--radius-md);
  transition:
    background var(--transition-fast),
    transform var(--transition-fast),
    opacity var(--transition-fast);
}

.btn-sheet:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sheet-cancel {
  background: var(--bg-overlay);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.btn-sheet-cancel:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.btn-sheet-save {
  background: var(--accent);
  color: var(--accent-text);
}

.btn-sheet-save:hover:not(:disabled) {
  background: var(--accent-dim);
  transform: translateY(-1px);
}

.btn-sheet-delete {
  background: var(--danger);
  color: #fff;
}

.btn-sheet-delete:hover:not(:disabled) {
  background: var(--danger-dim);
  transform: translateY(-1px);
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
    border-bottom: 1px solid var(--border);
    padding-bottom: var(--space-lg);
  }

  .sheet-enter-from .sheet-content,
  .sheet-leave-to .sheet-content {
    transform: translateY(20px);
  }
}
</style>
