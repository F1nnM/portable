<script setup lang="ts">
import type { GitStatus } from "~/types/git";

const route = useRoute();
const slug = computed(() => route.params.slug as string);

// State: status overview vs diff viewer
const selectedDiffFile = ref<string | null>(null);
const diffContent = ref("");
const diffLoading = ref(false);

const gitData = ref<GitStatus | null>(null);
const loading = ref(true);
const error = ref("");

// Build the proxy base URL for pod API calls
function podApiUrl(path: string): string {
  return `/api/projects/${slug.value}/pod${path}`;
}

// Fetch git status
async function fetchGitStatus() {
  loading.value = true;
  error.value = "";
  try {
    const data = await $fetch<GitStatus>(podApiUrl("/api/git"));
    gitData.value = data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load git status";
    error.value = msg;
  } finally {
    loading.value = false;
  }
}

// Fetch diff for a specific file
async function fetchDiff(path: string) {
  selectedDiffFile.value = path;
  diffContent.value = "";
  diffLoading.value = true;
  try {
    const data = await $fetch<{ diff: string }>(
      podApiUrl(`/api/git/diff/${encodeURIComponent(path)}`),
    );
    diffContent.value = data.diff || "";
  } catch {
    diffContent.value = "Failed to load diff";
  } finally {
    diffLoading.value = false;
  }
}

function goBackToStatus() {
  selectedDiffFile.value = null;
  diffContent.value = "";
}

function navigateToFile(_path: string) {
  navigateTo(`/projects/${slug.value}/files`);
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - date.getTime()) / 1000));

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "added":
    case "untracked":
      return "badge-added";
    case "modified":
      return "badge-modified";
    case "deleted":
      return "badge-deleted";
    case "renamed":
    case "copied":
      return "badge-renamed";
    default:
      return "badge-default";
  }
}

onMounted(fetchGitStatus);
</script>

<template>
  <div class="git-page">
    <!-- Diff viewer mode -->
    <template v-if="selectedDiffFile">
      <div v-if="diffLoading" class="loading-container">
        <div class="loading-spinner" />
      </div>
      <GitDiffViewer
        v-else
        :filename="selectedDiffFile"
        :diff="diffContent"
        @back="goBackToStatus"
        @view-file="navigateToFile"
      />
    </template>

    <!-- Status overview mode -->
    <template v-else>
      <div v-if="loading" class="loading-container">
        <div class="loading-spinner" />
      </div>

      <div v-else-if="error" class="error-container">
        <p class="error-text">{{ error }}</p>
        <button class="btn-retry" @click="fetchGitStatus">Retry</button>
      </div>

      <div v-else-if="gitData" class="git-status">
        <!-- Branch -->
        <div class="branch-section">
          <svg
            class="branch-icon"
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
          <span class="branch-name">{{ gitData.branch }}</span>
        </div>

        <!-- Staged changes -->
        <div v-if="gitData.staged.length > 0" class="changes-section">
          <h3 class="section-title">Staged Changes</h3>
          <div
            v-for="file in gitData.staged"
            :key="`staged-${file.path}`"
            class="change-item"
            @click="fetchDiff(file.path)"
          >
            <span class="change-status" :class="statusBadgeClass(file.status)">
              {{ file.status }}
            </span>
            <span class="change-path">{{ file.path }}</span>
          </div>
        </div>

        <!-- Unstaged changes -->
        <div v-if="gitData.unstaged.length > 0" class="changes-section">
          <h3 class="section-title">Unstaged Changes</h3>
          <div
            v-for="file in gitData.unstaged"
            :key="`unstaged-${file.path}`"
            class="change-item"
            @click="fetchDiff(file.path)"
          >
            <span class="change-status" :class="statusBadgeClass(file.status)">
              {{ file.status }}
            </span>
            <span class="change-path">{{ file.path }}</span>
          </div>
        </div>

        <!-- Clean state -->
        <div
          v-if="gitData.staged.length === 0 && gitData.unstaged.length === 0"
          class="clean-state"
        >
          <svg
            class="clean-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p>Clean working tree</p>
        </div>

        <!-- Commit history -->
        <div v-if="gitData.commits.length > 0" class="commits-section">
          <h3 class="section-title">Recent Commits</h3>
          <div v-for="commit in gitData.commits" :key="commit.hash" class="commit-item">
            <div class="commit-header">
              <code class="commit-hash">{{ commit.shortHash }}</code>
              <span class="commit-time">{{ formatRelativeTime(commit.date) }}</span>
            </div>
            <p class="commit-message">{{ commit.message }}</p>
            <span class="commit-author">{{ commit.author }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.git-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
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

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: var(--space-4);
  padding: var(--space-7);
}

.error-text {
  color: var(--color-danger);
  text-align: center;
}

.btn-retry {
  padding: var(--space-2) var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  min-height: var(--touch-min);
}

/* Git status */
.git-status {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: var(--space-7);
}

/* Branch */
.branch-section {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.branch-icon {
  width: 20px;
  height: 20px;
  color: var(--color-accent);
}

.branch-name {
  font-family: var(--font-mono);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

/* Sections */
.changes-section,
.commits-section {
  padding-top: var(--space-4);
}

.section-title {
  padding: 0 var(--space-4) var(--space-2);
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Change items */
.change-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  min-height: var(--touch-min);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.change-item:hover {
  background: var(--color-bg-inset);
}

.change-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: var(--radius-xl);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  flex-shrink: 0;
}

.badge-added {
  background: var(--color-success-tint);
  color: var(--color-success);
}

.badge-modified {
  background: var(--color-warning-tint);
  color: var(--color-warning);
}

.badge-deleted {
  background: var(--color-danger-tint);
  color: var(--color-danger);
}

.badge-renamed {
  background: var(--color-accent-tint);
  color: var(--color-accent);
}

.badge-default {
  background: var(--color-bg-inset);
  color: var(--color-text-muted);
}

.change-path {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Clean state */
.clean-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-7);
  color: var(--color-text-muted);
}

.clean-icon {
  width: 32px;
  height: 32px;
  color: var(--color-success);
}

/* Commits */
.commit-item {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.commit-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: 2px;
}

.commit-hash {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-accent);
  background: var(--color-accent-tint);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
}

.commit-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.commit-message {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: var(--line-height-base);
  margin-bottom: 2px;
}

.commit-author {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
</style>
