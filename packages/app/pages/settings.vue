<script setup lang="ts">
const { user } = useAuth();

const credentialInput = ref("");
const isLoading = ref(false);
const statusMessage = ref<{ type: "success" | "error"; text: string } | null>(null);

const { data: credentialStatus, refresh: refreshCredentialStatus } = useFetch<{
  hasCredential: boolean;
}>("/api/settings/credential");

const hasCredential = computed(() => credentialStatus.value?.hasCredential ?? false);

async function saveCredential() {
  if (!credentialInput.value.trim()) return;

  isLoading.value = true;
  statusMessage.value = null;

  try {
    await $fetch("/api/settings/credential", {
      method: "PUT",
      body: { credential: credentialInput.value.trim() },
    });
    credentialInput.value = "";
    statusMessage.value = { type: "success", text: "Credential saved" };
    await refreshCredentialStatus();
  } catch {
    statusMessage.value = { type: "error", text: "Failed to save credential" };
  } finally {
    isLoading.value = false;
  }
}

async function removeCredential() {
  isLoading.value = true;
  statusMessage.value = null;

  try {
    await $fetch("/api/settings/credential", {
      method: "PUT",
      body: { credential: "" },
    });
    statusMessage.value = { type: "success", text: "Credential removed" };
    await refreshCredentialStatus();
  } catch {
    statusMessage.value = { type: "error", text: "Failed to remove credential" };
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="settings">
    <div class="page-header">
      <h1 class="page-title">Settings</h1>
      <p class="page-subtitle">Manage your account and credentials</p>
    </div>

    <section class="settings-section">
      <h2 class="section-title">Account</h2>
      <div class="settings-card">
        <div class="setting-row">
          <span class="setting-label">GitHub</span>
          <span class="setting-value mono">{{ user?.username }}</span>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <h2 class="section-title">Anthropic Credential</h2>
      <div class="settings-card">
        <p class="setting-description">
          Add your Anthropic API key or Claude Code OAuth token to enable Claude in your projects.
        </p>

        <div class="setting-row">
          <span class="setting-label">Status</span>
          <span v-if="hasCredential" class="setting-badge configured">Configured</span>
          <span v-else class="setting-badge not-set">Not configured</span>
        </div>

        <div v-if="statusMessage" class="status-message" :class="statusMessage.type">
          {{ statusMessage.text }}
        </div>

        <form class="credential-form" @submit.prevent="saveCredential">
          <input
            v-model="credentialInput"
            type="password"
            class="credential-input"
            :placeholder="
              hasCredential ? 'Enter new credential to replace' : 'sk-ant-... or OAuth token'
            "
            autocomplete="off"
          />
          <div class="credential-actions">
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isLoading || !credentialInput.trim()"
            >
              {{ isLoading ? "Saving..." : "Save" }}
            </button>
            <button
              v-if="hasCredential"
              type="button"
              class="btn btn-danger"
              :disabled="isLoading"
              @click="removeCredential"
            >
              Remove
            </button>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings {
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

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.settings-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--touch-min);
}

.setting-label {
  color: var(--text-secondary);
  font-size: 0.9375rem;
}

.setting-value {
  color: var(--text-primary);
  font-size: 0.9375rem;
}

.setting-value.mono {
  font-family: var(--font-mono);
}

.setting-description {
  color: var(--text-muted);
  font-size: 0.875rem;
  line-height: 1.5;
}

.setting-badge {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 999px;
}

.setting-badge.not-set {
  background: var(--bg-overlay);
  color: var(--text-muted);
}

.setting-badge.configured {
  background: var(--accent-glow);
  color: var(--accent);
}

.status-message {
  font-size: 0.8125rem;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
}

.status-message.success {
  background: var(--accent-glow);
  color: var(--accent);
}

.status-message.error {
  background: rgba(255, 77, 106, 0.15);
  color: var(--danger);
}

.credential-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.credential-input {
  width: 100%;
  min-height: var(--touch-min);
  padding: 0 var(--space-md);
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.875rem;
  transition: border-color var(--transition-fast);
}

.credential-input::placeholder {
  color: var(--text-muted);
  font-family: var(--font-body);
}

.credential-input:focus {
  outline: none;
  border-color: var(--accent);
}

.credential-actions {
  display: flex;
  gap: var(--space-sm);
}

.btn {
  min-height: var(--touch-min);
  padding: 0 var(--space-lg);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-weight: 500;
  transition:
    background var(--transition-fast),
    opacity var(--transition-fast);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  color: var(--accent-text);
}

.btn-primary:not(:disabled):hover {
  background: var(--accent-dim);
}

.btn-danger {
  background: transparent;
  border: 1px solid var(--danger-dim);
  color: var(--danger);
}

.btn-danger:not(:disabled):hover {
  background: rgba(255, 77, 106, 0.1);
}
</style>
