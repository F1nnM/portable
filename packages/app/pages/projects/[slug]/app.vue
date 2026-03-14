<script setup lang="ts">
interface RebuildStatus {
  lastBuiltCommit: string | null;
  currentHead: string;
  isDirty: boolean;
  isBuilding: boolean;
  lastBuildError: string | null;
  unbuiltCommitCount: number | null;
}

const route = useRoute();
const slug = computed(() => route.params.slug as string);

const status = ref<RebuildStatus | null>(null);
const statusError = ref(false);
const isRebuilding = ref(false);

// Construct app URL from the current hostname pattern.
// The convention is: slug--preview--appLabel.domain
const appUrl = computed(() => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  // Extract the base domain (remove any slug prefix if present)
  const parts = hostname.split("--");
  const appLabelAndDomain = parts.length > 1 ? parts.slice(1).join("--") : hostname;

  // Build preview subdomain
  const previewHost = `${slug.value}--preview--${appLabelAndDomain}`;
  const port = window.location.port ? `:${window.location.port}` : "";

  return `${protocol}//${previewHost}${port}/`;
});

function openInNewTab() {
  window.open(appUrl.value, "_blank");
}

async function fetchStatus() {
  try {
    const data = await $fetch<RebuildStatus>(
      `/api/projects/${slug.value}/pod/api/rebuild/status`,
    );
    status.value = data;
    statusError.value = false;
  } catch {
    statusError.value = true;
  }
}

async function triggerRebuild() {
  if (isRebuilding.value) return;
  isRebuilding.value = true;
  try {
    await $fetch(`/api/projects/${slug.value}/pod/api/rebuild`, { method: "POST" });
    await fetchStatus();
  } catch {
    // Status polling will pick up any errors
  } finally {
    isRebuilding.value = false;
  }
}

const isUpToDate = computed(() => {
  if (!status.value) return false;
  return (
    !status.value.isBuilding &&
    !status.value.lastBuildError &&
    status.value.lastBuiltCommit !== null &&
    (status.value.unbuiltCommitCount === null || status.value.unbuiltCommitCount === 0) &&
    !status.value.isDirty
  );
});

const hasUnbuiltCommits = computed(() => {
  if (!status.value) return false;
  return (
    !status.value.isBuilding &&
    !status.value.lastBuildError &&
    status.value.unbuiltCommitCount !== null &&
    status.value.unbuiltCommitCount > 0
  );
});

let pollInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  fetchStatus();
  pollInterval = setInterval(fetchStatus, 5000);
});

onUnmounted(() => {
  if (pollInterval !== null) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
});
</script>

<template>
  <div class="app-page">
    <div class="app-card">
      <!-- App URL -->
      <div class="app-url-section">
        <a :href="appUrl" target="_blank" rel="noopener noreferrer" class="app-url">
          {{ appUrl }}
        </a>
      </div>

      <!-- Open button -->
      <button class="btn-open" @click="openInNewTab">Open</button>

      <!-- Build status -->
      <div class="build-status">
        <!-- Building -->
        <div v-if="status?.isBuilding" class="status-row status-building">
          <div class="status-spinner" />
          <span>Building...</span>
        </div>

        <!-- Build error -->
        <div v-else-if="status?.lastBuildError" class="status-banner status-error">
          <span class="status-error-message">{{ status.lastBuildError }}</span>
          <button
            class="btn-rebuild btn-rebuild-error"
            :disabled="isRebuilding"
            @click="triggerRebuild"
          >
            Rebuild
          </button>
        </div>

        <!-- Unbuilt commits -->
        <div v-else-if="hasUnbuiltCommits" class="status-banner status-info">
          <span>{{ status!.unbuiltCommitCount }} commit{{ status!.unbuiltCommitCount === 1 ? "" : "s" }} since last build</span>
          <button
            class="btn-rebuild btn-rebuild-highlighted"
            :disabled="isRebuilding"
            @click="triggerRebuild"
          >
            Rebuild
          </button>
        </div>

        <!-- Up to date -->
        <div v-else-if="isUpToDate" class="status-row status-ok">
          <svg
            class="status-check"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Up to date</span>
        </div>

        <!-- Uncommitted changes warning -->
        <div v-if="status && !status.isBuilding && status.isDirty" class="status-warning">
          Uncommitted changes won't be reflected
        </div>

        <!-- Rebuild button (when no error or unbuilt commits) -->
        <button
          v-if="status && !status.isBuilding && !status.lastBuildError && !hasUnbuiltCommits"
          class="btn-rebuild"
          :disabled="isRebuilding"
          @click="triggerRebuild"
        >
          Rebuild
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: var(--space-4);
  background: var(--color-bg);
}

.app-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
  max-width: 400px;
  padding: var(--space-5);
  background: var(--color-bg-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

.app-url-section {
  width: 100%;
  text-align: center;
}

.app-url {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-accent);
  word-break: break-all;
  text-decoration: none;
  transition: color var(--transition-fast);
}

.app-url:hover {
  color: var(--color-accent-hover);
  text-decoration: underline;
}

.btn-open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-5);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: white;
  background: var(--color-accent);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
  min-height: var(--touch-min);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.btn-open:hover {
  background: var(--color-accent-hover);
}

.build-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
}

.status-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
}

.status-building {
  color: var(--color-text-muted);
}

.status-spinner {
  width: 16px;
  height: 16px;
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

.status-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  text-align: center;
}

.status-error {
  background: var(--color-danger-tint);
  color: var(--color-danger);
}

.status-error-message {
  word-break: break-word;
}

.status-info {
  background: var(--color-warning-tint);
  color: var(--color-warning);
}

.status-ok {
  color: var(--color-success);
}

.status-check {
  width: 18px;
  height: 18px;
}

.status-warning {
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  color: var(--color-warning);
  text-align: center;
}

.btn-rebuild {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1) var(--space-3);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  min-height: 36px;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.btn-rebuild:hover {
  color: var(--color-text);
  background: var(--color-bg-surface);
  border-color: var(--color-text-muted);
}

.btn-rebuild:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-rebuild-error {
  color: var(--color-danger);
  border-color: var(--color-danger);
  background: transparent;
}

.btn-rebuild-error:hover {
  color: white;
  background: var(--color-danger);
}

.btn-rebuild-highlighted {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: transparent;
}

.btn-rebuild-highlighted:hover {
  color: white;
  background: var(--color-accent);
}
</style>
