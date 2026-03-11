<script setup lang="ts">
const route = useRoute();
const slug = computed(() => route.params.slug as string);

const {
  gitData,
  loading,
  error,
  actionLoading,
  actionError,
  fetchGitStatus,
  stageFiles,
  stageAll,
  unstageFiles,
  unstageAll,
  commit,
  push,
  pull,
} = useGit(slug);

// Diff viewer state
const selectedDiffFile = ref<string | null>(null);
const diffContent = ref("");
const diffLoading = ref(false);
const diffIsStaged = ref(false);

// Commit message
const commitMessage = ref("");
const showCommitInput = ref(false);

// Toast notification
const toast = ref<{ message: string; type: "success" | "error" } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function showToast(message: string, type: "success" | "error" = "success") {
  if (toastTimer) clearTimeout(toastTimer);
  toast.value = { message, type };
  toastTimer = setTimeout(() => {
    toast.value = null;
  }, 3000);
}

// Build pod API URL
function podApiUrl(path: string): string {
  return `/api/projects/${slug.value}/pod${path}`;
}

// Fetch diff for a specific file
async function fetchDiff(path: string, staged: boolean) {
  selectedDiffFile.value = path;
  diffIsStaged.value = staged;
  diffContent.value = "";
  diffLoading.value = true;
  try {
    const query = staged ? "?staged=true" : "";
    const data = await $fetch<{ diff: string }>(
      podApiUrl(`/api/git/diff/${encodeURIComponent(path)}${query}`),
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

// Actions
async function handleStageFile(path: string) {
  await stageFiles([path]);
}

async function handleUnstageFile(path: string) {
  await unstageFiles([path]);
}

async function handleStageAll() {
  await stageAll();
}

async function handleUnstageAll() {
  await unstageAll();
}

async function handleCommit() {
  if (!commitMessage.value.trim()) return;
  const success = await commit(commitMessage.value);
  if (success) {
    commitMessage.value = "";
    showCommitInput.value = false;
    showToast("Committed successfully");
  } else {
    showToast(actionError.value || "Commit failed", "error");
  }
}

async function handlePush() {
  const success = await push();
  if (success) {
    showToast("Pushed to remote");
  } else {
    showToast(actionError.value || "Push failed", "error");
  }
}

async function handlePull() {
  const success = await pull();
  if (success) {
    showToast("Pulled from remote");
  } else {
    showToast(actionError.value || "Pull failed", "error");
  }
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

function statusLetter(status: string): string {
  switch (status) {
    case "added":
    case "untracked":
      return "A";
    case "modified":
      return "M";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "copied":
      return "C";
    default:
      return "?";
  }
}

function statusColorClass(status: string): string {
  switch (status) {
    case "added":
    case "untracked":
      return "status-added";
    case "modified":
      return "status-modified";
    case "deleted":
      return "status-deleted";
    case "renamed":
    case "copied":
      return "status-renamed";
    default:
      return "status-default";
  }
}

// Computed
const hasStaged = computed(() => (gitData.value?.staged.length ?? 0) > 0);
const hasUnstaged = computed(() => (gitData.value?.unstaged.length ?? 0) > 0);
const hasChanges = computed(() => hasStaged.value || hasUnstaged.value);
const canCommit = computed(() => hasStaged.value && commitMessage.value.trim().length > 0);

onMounted(fetchGitStatus);
</script>

<template>
  <div class="git-page">
    <!-- Toast notification -->
    <Transition name="toast">
      <div v-if="toast" class="toast" :class="`toast-${toast.type}`">
        {{ toast.message }}
      </div>
    </Transition>

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
        <!-- Branch bar -->
        <div class="branch-bar">
          <div class="branch-info">
            <svg class="branch-icon" viewBox="0 0 16 16" fill="currentColor">
              <path
                d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"
              />
            </svg>
            <span class="branch-name">{{ gitData.branch }}</span>
            <template v-if="gitData.hasRemote">
              <span v-if="gitData.ahead > 0" class="sync-badge sync-ahead">
                {{ gitData.ahead }}&#x2191;
              </span>
              <span v-if="gitData.behind > 0" class="sync-badge sync-behind">
                {{ gitData.behind }}&#x2193;
              </span>
            </template>
          </div>
          <div v-if="gitData.hasRemote" class="branch-actions">
            <button
              class="btn-branch-action"
              :disabled="actionLoading !== null"
              @click="handlePull"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M8 3v10M5 10l3 3 3-3" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>Pull</span>
            </button>
            <button
              class="btn-branch-action btn-push"
              :disabled="actionLoading !== null"
              @click="handlePush"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M8 13V3M5 6l3-3 3 3" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>Push</span>
            </button>
          </div>
        </div>

        <!-- Action loading indicator -->
        <div v-if="actionLoading" class="action-bar">
          <div class="action-bar-progress" />
          <span class="action-bar-text">
            {{
              actionLoading === "stage"
                ? "Staging..."
                : actionLoading === "unstage"
                  ? "Unstaging..."
                  : actionLoading === "commit"
                    ? "Committing..."
                    : actionLoading === "push"
                      ? "Pushing..."
                      : actionLoading === "pull"
                        ? "Pulling..."
                        : "Working..."
            }}
          </span>
        </div>

        <div class="scroll-area">
          <!-- Staged changes -->
          <div v-if="hasStaged" class="changes-section">
            <div class="section-header">
              <h3 class="section-title">
                <span class="section-dot staged-dot" />
                Staged
                <span class="section-count">{{ gitData.staged.length }}</span>
              </h3>
              <button class="btn-section-action" @click="handleUnstageAll">Unstage all</button>
            </div>
            <div class="file-list">
              <div v-for="file in gitData.staged" :key="`staged-${file.path}`" class="file-row">
                <button
                  class="btn-file-action btn-unstage"
                  title="Unstage"
                  @click.stop="handleUnstageFile(file.path)"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M4 8h8" stroke-linecap="round" />
                  </svg>
                </button>
                <span class="file-status" :class="statusColorClass(file.status)">{{
                  statusLetter(file.status)
                }}</span>
                <span class="file-path" @click="fetchDiff(file.path, true)">{{ file.path }}</span>
              </div>
            </div>

            <!-- Commit composer -->
            <div class="commit-section">
              <div v-if="!showCommitInput" class="commit-trigger" @click="showCommitInput = true">
                <svg
                  class="commit-trigger-icon"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <circle cx="8" cy="8" r="3" />
                  <path d="M8 1v4M8 11v4M1 8h4M11 8h4" stroke-linecap="round" />
                </svg>
                <span>Write a commit message...</span>
              </div>
              <div v-else class="commit-composer">
                <textarea
                  v-model="commitMessage"
                  class="commit-input"
                  placeholder="Describe your changes..."
                  rows="3"
                  @keydown.meta.enter="handleCommit"
                  @keydown.ctrl.enter="handleCommit"
                />
                <div class="commit-actions">
                  <button class="btn-cancel" @click="showCommitInput = false">Cancel</button>
                  <button
                    class="btn-commit"
                    :disabled="!canCommit || actionLoading !== null"
                    @click="handleCommit"
                  >
                    Commit
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Unstaged changes -->
          <div v-if="hasUnstaged" class="changes-section">
            <div class="section-header">
              <h3 class="section-title">
                <span class="section-dot unstaged-dot" />
                Changes
                <span class="section-count">{{ gitData.unstaged.length }}</span>
              </h3>
              <button class="btn-section-action" @click="handleStageAll">Stage all</button>
            </div>
            <div class="file-list">
              <div v-for="file in gitData.unstaged" :key="`unstaged-${file.path}`" class="file-row">
                <button
                  class="btn-file-action btn-stage"
                  title="Stage"
                  @click.stop="handleStageFile(file.path)"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M4 8h8M8 4v8" stroke-linecap="round" />
                  </svg>
                </button>
                <span class="file-status" :class="statusColorClass(file.status)">{{
                  statusLetter(file.status)
                }}</span>
                <span class="file-path" @click="fetchDiff(file.path, false)">{{ file.path }}</span>
              </div>
            </div>
          </div>

          <!-- Clean state -->
          <div v-if="!hasChanges" class="clean-state">
            <svg
              class="clean-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <p class="clean-text">Working tree clean</p>
            <p class="clean-subtext">No uncommitted changes</p>
          </div>

          <!-- Commit history -->
          <div v-if="gitData.commits.length > 0" class="commits-section">
            <h3 class="section-title">
              History
              <span class="section-count">{{ gitData.commits.length }}</span>
            </h3>
            <div class="commit-list">
              <div v-for="c in gitData.commits" :key="c.hash" class="commit-row">
                <div class="commit-graph">
                  <span class="commit-node" />
                  <span class="commit-line" />
                </div>
                <div class="commit-body">
                  <p class="commit-msg">{{ c.message }}</p>
                  <div class="commit-meta">
                    <code class="commit-sha">{{ c.shortHash }}</code>
                    <span class="commit-sep">&middot;</span>
                    <span class="commit-author">{{ c.author }}</span>
                    <span class="commit-sep">&middot;</span>
                    <span class="commit-date">{{ formatRelativeTime(c.date) }}</span>
                  </div>
                </div>
              </div>
            </div>
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
  position: relative;
}

/* Toast */
.toast {
  position: absolute;
  top: var(--space-3);
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  pointer-events: none;
  box-shadow: var(--shadow-elevated);
}

.toast-success {
  background: var(--color-success);
  color: #fff;
}

.toast-error {
  background: var(--color-danger);
  color: #fff;
}

.toast-enter-active {
  transition: all 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-leave-active {
  transition: all 200ms ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}

/* Loading / Error */
.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
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
  font-size: var(--font-size-sm);
}

.btn-retry {
  padding: var(--space-2) var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-family: var(--font-sans);
  cursor: pointer;
  min-height: var(--touch-min);
}

/* Git status layout */
.git-status {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

/* Branch bar */
.branch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  gap: var(--space-3);
}

.branch-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex: 1;
}

.branch-icon {
  width: 16px;
  height: 16px;
  color: var(--color-accent);
  flex-shrink: 0;
}

.branch-name {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sync-badge {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: var(--font-weight-bold);
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  line-height: 1.4;
}

.sync-ahead {
  background: var(--color-accent-tint);
  color: var(--color-accent);
}

.sync-behind {
  background: var(--color-warning-tint);
  color: var(--color-warning);
}

.branch-actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.btn-branch-action {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
  min-height: 32px;
}

.btn-branch-action:hover:not(:disabled) {
  background: var(--color-bg-surface);
  border-color: var(--color-border-strong);
  color: var(--color-text);
}

.btn-branch-action:active:not(:disabled) {
  transform: scale(0.97);
}

.btn-branch-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-branch-action svg {
  width: 14px;
  height: 14px;
}

.btn-push {
  background: var(--color-accent-tint);
  border-color: transparent;
  color: var(--color-accent);
}

.btn-push:hover:not(:disabled) {
  background: var(--color-accent);
  color: var(--color-accent-text);
}

/* Action loading bar */
.action-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px var(--space-4);
  background: var(--color-accent-tint);
  overflow: hidden;
  flex-shrink: 0;
}

.action-bar-progress {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, var(--color-accent) 50%, transparent 100%);
  opacity: 0.08;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.action-bar-text {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-accent);
  font-weight: var(--font-weight-medium);
  position: relative;
}

/* Scroll area */
.scroll-area {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: var(--space-7);
}

/* Changes sections */
.changes-section {
  padding-top: var(--space-3);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4) var(--space-2);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.section-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.staged-dot {
  background: var(--color-success);
}

.unstaged-dot {
  background: var(--color-warning);
}

.section-count {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  background: var(--color-bg-inset);
  color: var(--color-text-muted);
  padding: 1px 6px;
  border-radius: var(--radius-full);
  letter-spacing: 0;
  text-transform: none;
}

.btn-section-action {
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-accent);
  background: none;
  border: none;
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
  min-height: 28px;
}

.btn-section-action:hover {
  background: var(--color-accent-tint);
}

/* File list */
.file-list {
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-surface);
}

.file-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-4) 0 var(--space-2);
  min-height: var(--touch-min);
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
  transition: background var(--transition-fast);
}

.file-row:last-child {
  border-bottom: none;
}

.file-row:hover {
  background: var(--color-bg-inset);
}

/* File action buttons */
.btn-file-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--transition-fast);
  color: var(--color-text-muted);
}

.btn-file-action svg {
  width: 14px;
  height: 14px;
}

.btn-stage:hover {
  background: var(--color-success-tint);
  border-color: var(--color-success);
  color: var(--color-success);
}

.btn-unstage:hover {
  background: var(--color-danger-tint);
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.btn-file-action:active {
  transform: scale(0.9);
}

/* File status letter */
.file-status {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: var(--font-weight-bold);
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  flex-shrink: 0;
}

.status-added {
  color: var(--color-success);
  background: var(--color-success-tint);
}

.status-modified {
  color: var(--color-warning);
  background: var(--color-warning-tint);
}

.status-deleted {
  color: var(--color-danger);
  background: var(--color-danger-tint);
}

.status-renamed {
  color: var(--color-accent);
  background: var(--color-accent-tint);
}

.status-default {
  color: var(--color-text-muted);
  background: var(--color-bg-inset);
}

/* File path */
.file-path {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  cursor: pointer;
  padding: var(--space-2) 0;
}

.file-path:hover {
  color: var(--color-accent);
}

/* Commit section */
.commit-section {
  padding: var(--space-3) var(--space-4);
}

.commit-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}

.commit-trigger:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-tint);
}

.commit-trigger-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.commit-composer {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.commit-input {
  width: 100%;
  padding: var(--space-3);
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
  resize: vertical;
  min-height: 64px;
  max-height: 200px;
  outline: none;
  transition: border-color var(--transition-fast);
  box-sizing: border-box;
}

.commit-input:focus {
  border-color: var(--color-accent);
}

.commit-input::placeholder {
  color: var(--color-text-muted);
}

.commit-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.btn-cancel {
  padding: var(--space-2) var(--space-4);
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  min-height: 36px;
  transition: all var(--transition-fast);
}

.btn-cancel:hover {
  background: var(--color-bg-inset);
}

.btn-commit {
  padding: var(--space-2) var(--space-5);
  background: var(--color-accent);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-accent-text);
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  min-height: 36px;
  transition: all var(--transition-fast);
}

.btn-commit:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.btn-commit:active:not(:disabled) {
  background: var(--color-accent-active);
  transform: scale(0.98);
}

.btn-commit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Clean state */
.clean-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-7);
}

.clean-icon {
  width: 36px;
  height: 36px;
  color: var(--color-success);
  opacity: 0.7;
}

.clean-text {
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.clean-subtext {
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Commits section */
.commits-section {
  padding: var(--space-4) var(--space-4) 0;
}

.commits-section .section-title {
  margin-bottom: var(--space-3);
}

.commit-list {
  position: relative;
}

.commit-row {
  display: flex;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
}

.commit-row:last-child .commit-line {
  display: none;
}

.commit-graph {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
  flex-shrink: 0;
  padding-top: 6px;
}

.commit-node {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  flex-shrink: 0;
  box-shadow: 0 0 0 2px var(--color-bg);
}

.commit-line {
  width: 1.5px;
  flex: 1;
  background: var(--color-border);
  margin-top: 2px;
}

.commit-body {
  min-width: 0;
  flex: 1;
  padding-bottom: var(--space-1);
}

.commit-msg {
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: var(--line-height-tight);
  margin-bottom: 2px;
  word-break: break-word;
}

.commit-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.commit-sha {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-accent);
  background: var(--color-accent-tint);
  padding: 0 4px;
  border-radius: 3px;
  line-height: 1.6;
}

.commit-sep {
  color: var(--color-text-muted);
  font-size: 10px;
}

.commit-author {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.commit-date {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
</style>
