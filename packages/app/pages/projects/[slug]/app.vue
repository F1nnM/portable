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

const shortHash = computed(() => status.value?.lastBuiltCommit?.slice(0, 7) ?? null);

const hasUnbuiltCommits = computed(() => {
  if (!status.value) return false;
  return (
    !status.value.isBuilding &&
    !status.value.lastBuildError &&
    status.value.unbuiltCommitCount !== null &&
    status.value.unbuiltCommitCount > 0
  );
});

const cardBorderColor = computed(() => {
  if (!status.value && !statusError.value) return "var(--color-border)";
  if (statusError.value) return "var(--color-border)";
  if (status.value?.isBuilding) return "var(--color-accent)";
  if (status.value?.lastBuildError) return "var(--color-danger)";
  if (hasUnbuiltCommits.value) return "var(--color-warning)";
  return "var(--color-accent)";
});

function openInNewTab() {
  window.open(appUrl.value, "_blank");
}

async function fetchStatus() {
  try {
    const data = await $fetch<RebuildStatus>(`/api/projects/${slug.value}/pod/api/rebuild/status`);
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
    <!-- URL bar -->
    <a :href="appUrl" target="_blank" rel="noopener noreferrer" class="url-bar">
      <span class="url-text">{{ appUrl }}</span>
      <svg
        class="url-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>

    <!-- Open App button -->
    <button class="btn-open" @click="openInNewTab">Open App</button>

    <!-- Build section -->
    <section class="build-section">
      <h2 class="section-title">
        Build
        <span class="section-rule" />
      </h2>

      <div class="build-card" :style="{ borderTopColor: cardBorderColor }">
        <!-- Loading skeleton -->
        <template v-if="!status && !statusError">
          <div class="skeleton-row">
            <div class="skeleton-bar" />
          </div>
        </template>

        <!-- Fetch error -->
        <template v-else-if="statusError">
          <div class="fetch-error-body">
            <span class="fetch-error-text">Couldn't load build status</span>
          </div>
          <div class="card-footer">
            <button class="btn-rebuild" @click="fetchStatus">Retry</button>
          </div>
        </template>

        <!-- Status loaded -->
        <template v-else>
          <div class="card-body">
            <!-- Status row -->
            <div class="status-row">
              <div class="status-left">
                <!-- Building: spinner -->
                <div v-if="status!.isBuilding" class="status-spinner" />
                <!-- Error: red dot -->
                <span v-else-if="status!.lastBuildError" class="status-dot dot-danger" />
                <!-- Unbuilt commits: warning dot -->
                <span v-else-if="hasUnbuiltCommits" class="status-dot dot-warning" />
                <!-- Up to date: success dot -->
                <span v-else class="status-dot dot-success" />

                <span class="status-label">
                  <template v-if="status!.isBuilding">Building...</template>
                  <template v-else-if="status!.lastBuildError">Build failed</template>
                  <template v-else-if="hasUnbuiltCommits">
                    {{ status!.unbuiltCommitCount }}
                    commit{{ status!.unbuiltCommitCount === 1 ? "" : "s" }} behind
                  </template>
                  <template v-else>Up to date</template>
                </span>
              </div>

              <span v-if="shortHash && !status!.isBuilding" class="commit-hash">
                {{ shortHash }}
              </span>
            </div>

            <!-- Warning: uncommitted changes -->
            <div v-if="status && !status.isBuilding && status.isDirty" class="warning-row">
              <svg
                class="warning-icon"
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
              <span>Uncommitted changes</span>
            </div>

            <!-- Error detail -->
            <div v-if="status!.lastBuildError" class="error-detail">
              {{ status!.lastBuildError }}
            </div>
          </div>

          <!-- Card footer with rebuild button -->
          <div v-if="!status!.isBuilding" class="card-footer">
            <button
              class="btn-rebuild"
              :class="{
                'btn-rebuild-danger': !!status!.lastBuildError,
                'btn-rebuild-accent': hasUnbuiltCommits && !status!.lastBuildError,
              }"
              :disabled="isRebuilding"
              @click="triggerRebuild"
            >
              Rebuild
            </button>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.app-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-5);
  background: var(--color-bg);
  overflow-y: auto;
  height: 100%;
}

/* URL bar */
.url-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  box-shadow: var(--shadow-card);
  text-decoration: none;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.url-bar:hover {
  border-color: var(--color-border-strong);
  background: var(--color-bg-elevated);
}

.url-text {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.url-icon {
  width: 16px;
  height: 16px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

/* Open App button */
.btn-open {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: var(--touch-min);
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-accent) 25%, transparent);
  transition:
    background var(--transition-fast),
    transform var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.btn-open:hover {
  background: var(--color-accent-hover);
}

.btn-open:active {
  transform: scale(0.98);
}

/* Build section */
.build-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.section-rule {
  display: inline-block;
  width: 48px;
  height: 2px;
  background: var(--color-accent);
  border-radius: var(--radius-full);
  opacity: 0.5;
}

/* Build card */
.build-card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-top: 2px solid var(--color-accent);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Status row */
.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.status-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-success {
  background: var(--color-success);
  animation: status-pulse 2s ease-in-out infinite;
}

.dot-danger {
  background: var(--color-danger);
}

.dot-warning {
  background: var(--color-warning);
}

@keyframes status-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
  50% {
    box-shadow: 0 0 0 4px var(--color-success-tint);
  }
}

.status-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status-label {
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.commit-hash {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Warning row */
.warning-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-warning);
}

.warning-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* Error detail */
.error-detail {
  background: var(--color-danger-tint);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-danger);
  word-break: break-word;
}

/* Card footer */
.card-footer {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-3);
  margin-top: 0;
  text-align: center;
}

/* Fetch error */
.fetch-error-body {
  text-align: center;
  padding: var(--space-2) 0;
}

.fetch-error-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* Rebuild button */
.btn-rebuild {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-5);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  min-height: 36px;
  transition: all var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.btn-rebuild:hover {
  color: var(--color-text);
  background: var(--color-bg-surface);
  border-color: var(--color-border-strong);
}

.btn-rebuild:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-rebuild-danger {
  color: var(--color-danger);
  border-color: var(--color-danger);
  background: transparent;
}

.btn-rebuild-danger:hover {
  color: var(--color-accent-text);
  background: var(--color-danger);
}

.btn-rebuild-accent {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: transparent;
}

.btn-rebuild-accent:hover {
  color: var(--color-accent-text);
  background: var(--color-accent);
}

/* Loading skeleton */
.skeleton-row {
  padding: var(--space-2) 0;
}

.skeleton-bar {
  height: 20px;
  width: 60%;
  background: linear-gradient(
    90deg,
    var(--color-bg-inset) 25%,
    var(--color-bg-elevated) 50%,
    var(--color-bg-inset) 75%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-sm);
  animation: shimmer 1.8s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
