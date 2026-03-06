<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useFiles } from "../composables/useFiles";
import { useGit } from "../composables/useGit";

const router = useRouter();
const { gitState, loading, error, fetchGitState } = useGit();
const { openFile } = useFiles();

onMounted(() => {
  fetchGitState();
});

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

async function handleFileClick(filePath: string) {
  await openFile(filePath);
  router.push("/files");
}
</script>

<template>
  <div class="view git-view" data-testid="git-view">
    <!-- Loading state -->
    <div v-if="loading && !gitState" class="state-message">
      <span class="state-text">Loading...</span>
    </div>

    <!-- Error state -->
    <div v-else-if="error && !gitState" class="state-message">
      <span class="state-text error-text">{{ error }}</span>
    </div>

    <!-- Git info -->
    <div v-else-if="gitState" class="git-content">
      <!-- Branch header -->
      <div class="branch-header">
        <svg class="branch-icon" viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path
            d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"
          />
        </svg>
        <span class="branch-name">{{ gitState.branch }}</span>
      </div>

      <!-- Changes section -->
      <div
        v-if="gitState.staged.length > 0 || gitState.unstaged.length > 0"
        class="changes-section"
      >
        <h3 class="section-title">Changes</h3>

        <!-- Staged files -->
        <div v-if="gitState.staged.length > 0" class="file-group">
          <div class="group-label">Staged</div>
          <div
            v-for="file in gitState.staged"
            :key="`staged-${file.path}`"
            class="file-item"
            data-testid="git-file-item"
            @click="handleFileClick(file.path)"
          >
            <span class="file-status staged">{{ file.status[0].toUpperCase() }}</span>
            <span class="file-path">{{ file.path }}</span>
          </div>
        </div>

        <!-- Unstaged files -->
        <div v-if="gitState.unstaged.length > 0" class="file-group">
          <div class="group-label">Unstaged</div>
          <div
            v-for="file in gitState.unstaged"
            :key="`unstaged-${file.path}`"
            class="file-item"
            data-testid="git-file-item"
            @click="handleFileClick(file.path)"
          >
            <span class="file-status unstaged">{{ file.status[0].toUpperCase() }}</span>
            <span class="file-path">{{ file.path }}</span>
          </div>
        </div>
      </div>

      <!-- Commits section -->
      <div v-if="gitState.commits.length > 0" class="commits-section">
        <h3 class="section-title">Commits</h3>
        <div v-for="commit in gitState.commits" :key="commit.hash" class="commit-item">
          <div class="commit-top">
            <span class="commit-message">{{ commit.message }}</span>
          </div>
          <div class="commit-meta">
            <span class="commit-hash">{{ commit.shortHash }}</span>
            <span class="commit-dot">&middot;</span>
            <span class="commit-author">{{ commit.author }}</span>
            <span class="commit-dot">&middot;</span>
            <span class="commit-time">{{ formatRelativeTime(commit.date) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.git-view {
  background: var(--color-bg);
}

.state-message {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.state-text {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.error-text {
  color: #f85149;
}

.git-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.branch-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.branch-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.branch-name {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-accent);
}

.changes-section,
.commits-section {
  border-bottom: 1px solid var(--color-border);
}

.section-title {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 16px 4px;
}

.file-group {
  padding: 4px 0;
}

.group-label {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  padding: 4px 16px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.file-item:active {
  background: var(--color-bg-surface);
}

.file-status {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.file-status.staged {
  color: #3fb950;
}

.file-status.unstaged {
  color: #d29922;
}

.file-path {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commit-item {
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
}

.commit-item:last-child {
  border-bottom: none;
}

.commit-top {
  margin-bottom: 4px;
}

.commit-message {
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.commit-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.commit-hash {
  color: var(--color-accent);
}

.commit-dot {
  opacity: 0.5;
}
</style>
