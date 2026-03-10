<script setup lang="ts">
import type { Project } from "~/types/project";

interface Scaffold {
  id: string;
  name: string;
  description: string;
}

interface GitHubRepo {
  name: string;
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  language: string | null;
  defaultBranch: string;
  url: string;
}

const activeTab = ref<"scaffold" | "import">("scaffold");

// Shared state
const projectName = ref("");
const creating = ref(false);
const errorMsg = ref("");

// Scaffold state
const selectedScaffold = ref<string>("");
const scaffolds = ref<Scaffold[]>([]);
const scaffoldsLoading = ref(true);
const scaffoldsError = ref("");

// Import state
const selectedRepo = ref<GitHubRepo | null>(null);
const repos = ref<GitHubRepo[]>([]);
const reposLoading = ref(false);
const reposError = ref("");
const searchQuery = ref("");

function generateSlugPreview(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
}

const slugPreview = computed(() => generateSlugPreview(projectName.value));

const filteredRepos = computed(() => {
  if (!searchQuery.value) return repos.value;
  const q = searchQuery.value.toLowerCase();
  return repos.value.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.fullName.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q)),
  );
});

const canCreate = computed(() => {
  if (creating.value) return false;
  if (projectName.value.trim().length === 0 || projectName.value.trim().length > 100) return false;

  if (activeTab.value === "scaffold") {
    return selectedScaffold.value !== "";
  } else {
    return selectedRepo.value !== null;
  }
});

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

async function fetchRepos() {
  reposLoading.value = true;
  reposError.value = "";
  try {
    const data = await $fetch<{ repos: GitHubRepo[] }>("/api/github/repos");
    repos.value = data.repos;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load repositories";
    reposError.value = msg;
  } finally {
    reposLoading.value = false;
  }
}

function selectRepo(repo: GitHubRepo) {
  selectedRepo.value = repo;
  if (!projectName.value) {
    projectName.value = repo.name;
  }
}

async function createProject() {
  if (!canCreate.value) return;

  creating.value = true;
  errorMsg.value = "";

  try {
    const body: Record<string, string> = {
      name: projectName.value.trim(),
    };

    if (activeTab.value === "scaffold") {
      body.scaffoldId = selectedScaffold.value;
    } else {
      body.repoUrl = selectedRepo.value!.url;
    }

    await $fetch<{ project: Project }>("/api/projects", {
      method: "POST",
      body,
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

function switchTab(tab: "scaffold" | "import") {
  activeTab.value = tab;
  errorMsg.value = "";
  if (tab === "import" && repos.value.length === 0 && !reposLoading.value) {
    fetchRepos();
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
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button
        class="tab"
        :class="{ active: activeTab === 'scaffold' }"
        @click="switchTab('scaffold')"
      >
        From Scaffold
      </button>
      <button class="tab" :class="{ active: activeTab === 'import' }" @click="switchTab('import')">
        Import Repo
      </button>
    </div>

    <!-- Scaffold tab -->
    <template v-if="activeTab === 'scaffold'">
      <div class="form-section">
        <label class="form-label">Template</label>

        <div v-if="scaffoldsLoading" class="scaffolds-loading">
          <div class="loading-spinner" />
          <span class="loading-text">Loading templates...</span>
        </div>

        <div v-else-if="scaffoldsError" class="scaffolds-error">
          <p class="error-text">{{ scaffoldsError }}</p>
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
    </template>

    <!-- Import tab -->
    <template v-if="activeTab === 'import'">
      <div class="form-section">
        <label class="form-label">Repository</label>

        <div v-if="reposLoading" class="scaffolds-loading">
          <div class="loading-spinner" />
          <span class="loading-text">Loading repositories...</span>
        </div>

        <div v-else-if="reposError" class="scaffolds-error">
          <p class="error-text">{{ reposError }}</p>
          <button class="btn-retry" @click="fetchRepos">Try again</button>
        </div>

        <template v-else>
          <input
            v-model="searchQuery"
            type="text"
            class="form-input"
            placeholder="Search repositories..."
            autocomplete="off"
          />

          <div class="repo-list">
            <button
              v-for="repo in filteredRepos"
              :key="repo.fullName"
              class="repo-card"
              :class="{ selected: selectedRepo?.fullName === repo.fullName }"
              @click="selectRepo(repo)"
            >
              <div class="repo-header">
                <span class="repo-name">{{ repo.name }}</span>
                <span v-if="repo.isPrivate" class="repo-badge">Private</span>
              </div>
              <span v-if="repo.description" class="repo-description">{{ repo.description }}</span>
              <span v-if="repo.language" class="repo-language">{{ repo.language }}</span>
            </button>

            <div v-if="filteredRepos.length === 0" class="repo-empty">
              <span class="loading-text">{{
                searchQuery ? "No matching repositories" : "No repositories found"
              }}</span>
            </div>
          </div>
        </template>
      </div>
    </template>

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
      <p class="error-text">{{ errorMsg }}</p>
    </div>

    <!-- Create button -->
    <button class="btn-create" :disabled="!canCreate" @click="createProject">
      <div v-if="creating" class="btn-spinner" />
      <span>{{
        creating
          ? activeTab === "scaffold"
            ? "Creating..."
            : "Importing..."
          : activeTab === "scaffold"
            ? "Create Project"
            : "Import Project"
      }}</span>
    </button>
  </div>
</template>

<style scoped>
.new-project {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.page-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

/* Form sections */
.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--color-text);
}

/* Scaffold loading */
.scaffolds-loading {
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
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

/* Scaffold error */
.scaffolds-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6) var(--space-4);
  border: 1px dashed var(--color-danger);
  border-radius: var(--radius-md);
  text-align: center;
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

/* Scaffold grid */
.scaffold-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2);
}

@media (min-width: 480px) {
  .scaffold-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.scaffold-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  text-align: left;
  min-height: var(--touch-min);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.scaffold-card:hover {
  border-color: var(--color-text-muted);
}

.scaffold-card.selected {
  border-color: var(--color-accent);
  background: var(--color-accent-tint);
}

.scaffold-name {
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--color-text);
}

.scaffold-description {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

/* Form input */
.form-input {
  width: 100%;
  min-height: var(--touch-min);
  padding: var(--space-2) var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: 1rem;
  outline: none;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.form-input::placeholder {
  color: var(--color-text-muted);
}

.form-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-tint);
}

/* Slug preview */
.slug-preview {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.8125rem;
}

.slug-label {
  color: var(--color-text-muted);
}

.slug-value {
  font-family: var(--font-mono);
  color: var(--color-text-muted);
}

/* Error banner */
.error-banner {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-sm);
  background: rgba(239, 68, 68, 0.08);
}

.error-text {
  color: var(--color-danger);
  font-size: 0.875rem;
}

/* Create button */
.btn-create {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--touch-min);
  padding: var(--space-3) var(--space-5);
  background: var(--color-accent);
  color: #ffffff;
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 0.9375rem;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    opacity var(--transition-fast);
}

.btn-create:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.btn-create:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Tabs */
.tabs {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-border);
}

.tab {
  padding: var(--space-2) var(--space-4);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-secondary);
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
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

/* Repo list */
.repo-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 400px;
  overflow-y: auto;
}

.repo-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.repo-card:hover {
  border-color: var(--color-text-muted);
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
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--color-text);
}

.repo-badge {
  font-size: 0.6875rem;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.repo-description {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.repo-language {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.repo-empty {
  display: flex;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
}
</style>
