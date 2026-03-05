<script setup lang="ts">
import type { Project } from "~/types/project";

interface Scaffold {
  id: string;
  name: string;
  description: string;
}

const selectedScaffold = ref<string>("");
const projectName = ref("");
const creating = ref(false);
const errorMsg = ref("");

const scaffolds = ref<Scaffold[]>([]);
const scaffoldsLoading = ref(true);
const scaffoldsError = ref("");

function generateSlugPreview(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

const slugPreview = computed(() => generateSlugPreview(projectName.value));

const canCreate = computed(
  () =>
    projectName.value.trim().length > 0 &&
    projectName.value.trim().length <= 100 &&
    selectedScaffold.value !== "" &&
    !creating.value,
);

async function fetchScaffolds() {
  scaffoldsLoading.value = true;
  scaffoldsError.value = "";
  try {
    const data = await $fetch<{ scaffolds: Scaffold[] }>("/api/scaffolds");
    scaffolds.value = data.scaffolds;
    if (data.scaffolds.length === 1) {
      selectedScaffold.value = data.scaffolds[0].id;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load scaffolds";
    scaffoldsError.value = msg;
  } finally {
    scaffoldsLoading.value = false;
  }
}

async function createProject() {
  if (!canCreate.value) return;

  creating.value = true;
  errorMsg.value = "";

  try {
    await $fetch<{ project: Project }>("/api/projects", {
      method: "POST",
      body: {
        name: projectName.value.trim(),
        scaffoldId: selectedScaffold.value,
      },
    });
    await navigateTo("/");
  } catch (err: unknown) {
    if (err && typeof err === "object" && "statusMessage" in err) {
      errorMsg.value = (err as { statusMessage: string }).statusMessage;
    } else if (err instanceof Error) {
      errorMsg.value = err.message;
    } else {
      errorMsg.value = "Failed to create project";
    }
  } finally {
    creating.value = false;
  }
}

onMounted(() => {
  fetchScaffolds();
});
</script>

<template>
  <div class="new-project">
    <div class="page-header">
      <h1 class="page-title">New Project</h1>
      <p class="page-subtitle">Create an isolated dev environment with Claude Code</p>
    </div>

    <!-- Scaffold picker -->
    <div class="form-section">
      <label class="form-label">Template</label>

      <div v-if="scaffoldsLoading" class="scaffolds-loading">
        <div class="loading-spinner" />
        <span class="loading-text">Loading templates...</span>
      </div>

      <div v-else-if="scaffoldsError" class="scaffolds-error">
        <p class="error-text">
          {{ scaffoldsError }}
        </p>
        <button class="btn-retry" @click="fetchScaffolds">Try again</button>
      </div>

      <div v-else class="scaffold-grid">
        <button
          v-for="scaffold in scaffolds"
          :key="scaffold.id"
          class="scaffold-card"
          :class="{ selected: selectedScaffold === scaffold.id }"
          @click="selectedScaffold = scaffold.id"
        >
          <span class="scaffold-name">{{ scaffold.name }}</span>
          <span class="scaffold-description">{{ scaffold.description }}</span>
        </button>
      </div>
    </div>

    <!-- Project name input -->
    <div class="form-section">
      <label class="form-label" for="project-name">Project name</label>
      <input
        id="project-name"
        v-model="projectName"
        type="text"
        class="form-input"
        placeholder="My Awesome App"
        maxlength="100"
        autocomplete="off"
        @keydown.enter="createProject"
      />
      <div v-if="projectName.trim().length > 0" class="slug-preview">
        <span class="slug-label">Slug:</span>
        <span class="slug-value">{{ slugPreview }}</span>
      </div>
    </div>

    <!-- Error message -->
    <div v-if="errorMsg" class="error-banner">
      <p class="error-text">
        {{ errorMsg }}
      </p>
    </div>

    <!-- Create button -->
    <button class="btn-create" :disabled="!canCreate" @click="createProject">
      <div v-if="creating" class="btn-spinner" />
      <span>{{ creating ? "Creating..." : "Create Project" }}</span>
    </button>
  </div>
</template>

<style scoped>
.new-project {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.page-header {
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

/* Form sections */
.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.form-label {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--text-primary);
}

/* Scaffold loading */
.scaffolds-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl) var(--space-md);
}

.loading-spinner {
  width: 24px;
  height: 24px;
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
  font-size: 0.8125rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

/* Scaffold error */
.scaffolds-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl) var(--space-md);
  border: 1px dashed var(--danger);
  border-radius: var(--radius-lg);
  text-align: center;
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

/* Scaffold grid */
.scaffold-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-sm);
}

@media (min-width: 480px) {
  .scaffold-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.scaffold-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  text-align: left;
  min-height: var(--touch-min);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.scaffold-card:hover {
  border-color: var(--text-muted);
}

.scaffold-card.selected {
  border-color: var(--accent);
  background: var(--accent-glow);
  box-shadow: 0 0 0 1px var(--accent);
}

.scaffold-name {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--text-primary);
}

.scaffold-description {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* Form input */
.form-input {
  width: 100%;
  min-height: var(--touch-min);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 1rem;
  outline: none;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.form-input::placeholder {
  color: var(--text-muted);
}

.form-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-glow);
}

/* Slug preview */
.slug-preview {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.8125rem;
}

.slug-label {
  color: var(--text-muted);
}

.slug-value {
  font-family: var(--font-mono);
  color: var(--text-muted);
}

/* Error banner */
.error-banner {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--danger);
  border-radius: var(--radius-md);
  background: rgba(255, 77, 106, 0.08);
}

.error-text {
  color: var(--danger);
  font-size: 0.875rem;
}

/* Create button */
.btn-create {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  min-height: var(--touch-min);
  padding: var(--space-sm) var(--space-lg);
  background: var(--accent);
  color: var(--accent-text);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.9375rem;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    transform var(--transition-fast),
    opacity var(--transition-fast);
}

.btn-create:hover:not(:disabled) {
  background: var(--accent-dim);
  transform: translateY(-1px);
}

.btn-create:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--accent-text);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
</style>
