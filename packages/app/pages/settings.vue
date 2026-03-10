<script setup lang="ts">
import { onMounted } from "vue";

const { user } = useAuth();

// Theme toggle
const theme = ref<"system" | "light" | "dark">("system");

onMounted(() => {
  const stored = localStorage.getItem("portable-theme");
  if (stored === "light" || stored === "dark") {
    theme.value = stored;
  }
});

function setTheme(value: "system" | "light" | "dark") {
  theme.value = value;
  localStorage.setItem("portable-theme", value);
  if (value === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = value;
  }
}

// Credential management
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

// AGE key management
const ageKeyInput = ref("");
const isAgeKeyLoading = ref(false);
const ageKeyStatusMessage = ref<{ type: "success" | "error"; text: string } | null>(null);

const { data: ageKeyStatus, refresh: refreshAgeKeyStatus } = useFetch<{
  hasAgeKey: boolean;
}>("/api/settings/age-key");

const hasAgeKey = computed(() => ageKeyStatus.value?.hasAgeKey ?? false);

async function saveAgeKey() {
  if (!ageKeyInput.value.trim()) return;

  isAgeKeyLoading.value = true;
  ageKeyStatusMessage.value = null;

  try {
    await $fetch("/api/settings/age-key", {
      method: "PUT",
      body: { key: ageKeyInput.value.trim() },
    });
    ageKeyInput.value = "";
    ageKeyStatusMessage.value = { type: "success", text: "AGE key saved" };
    await refreshAgeKeyStatus();
  } catch {
    ageKeyStatusMessage.value = { type: "error", text: "Failed to save AGE key" };
  } finally {
    isAgeKeyLoading.value = false;
  }
}

async function removeAgeKey() {
  isAgeKeyLoading.value = true;
  ageKeyStatusMessage.value = null;

  try {
    await $fetch("/api/settings/age-key", {
      method: "PUT",
      body: { key: "" },
    });
    ageKeyStatusMessage.value = { type: "success", text: "AGE key removed" };
    await refreshAgeKeyStatus();
  } catch {
    ageKeyStatusMessage.value = { type: "error", text: "Failed to remove AGE key" };
  } finally {
    isAgeKeyLoading.value = false;
  }
}
</script>

<template>
  <div class="settings">
    <div class="page-header">
      <h1 class="page-title">Settings</h1>
    </div>

    <section class="settings-section">
      <h2 class="section-title">Theme</h2>
      <div class="settings-card">
        <div class="theme-toggle">
          <button
            class="theme-option"
            :class="{ active: theme === 'system' }"
            @click="setTheme('system')"
          >
            System
          </button>
          <button
            class="theme-option"
            :class="{ active: theme === 'light' }"
            @click="setTheme('light')"
          >
            Light
          </button>
          <button
            class="theme-option"
            :class="{ active: theme === 'dark' }"
            @click="setTheme('dark')"
          >
            Dark
          </button>
        </div>
      </div>
    </section>

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
          <span class="setting-status">
            <span v-if="hasCredential" class="status-dot status-dot-success" />
            <span v-else class="status-dot status-dot-muted" />
            {{ hasCredential ? "Configured" : "Not configured" }}
          </span>
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

    <section class="settings-section">
      <h2 class="section-title">AGE Key</h2>
      <div class="settings-card">
        <p class="setting-description">
          Add your AGE private key to enable SOPS decryption of encrypted secrets in your projects.
        </p>

        <div class="setting-row">
          <span class="setting-label">Status</span>
          <span class="setting-status">
            <span v-if="hasAgeKey" class="status-dot status-dot-success" />
            <span v-else class="status-dot status-dot-muted" />
            {{ hasAgeKey ? "Configured" : "Not configured" }}
          </span>
        </div>

        <div v-if="ageKeyStatusMessage" class="status-message" :class="ageKeyStatusMessage.type">
          {{ ageKeyStatusMessage.text }}
        </div>

        <form class="credential-form" @submit.prevent="saveAgeKey">
          <input
            v-model="ageKeyInput"
            type="password"
            class="credential-input"
            :placeholder="hasAgeKey ? 'Enter new key to replace' : 'AGE-SECRET-KEY-1...'"
            autocomplete="off"
          />
          <div class="credential-actions">
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isAgeKeyLoading || !ageKeyInput.trim()"
            >
              {{ isAgeKeyLoading ? "Saving..." : "Save" }}
            </button>
            <button
              v-if="hasAgeKey"
              type="button"
              class="btn btn-danger"
              :disabled="isAgeKeyLoading"
              @click="removeAgeKey"
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

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.settings-card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  box-shadow: var(--shadow-card);
}

/* Theme toggle */
.theme-toggle {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.theme-option {
  flex: 1;
  min-height: var(--touch-min);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.theme-option + .theme-option {
  border-left: 1px solid var(--color-border);
}

.theme-option:hover {
  background: var(--color-bg-elevated);
}

.theme-option.active {
  background: var(--color-accent);
  color: #ffffff;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--touch-min);
}

.setting-label {
  color: var(--color-text-secondary);
  font-size: 0.9375rem;
}

.setting-value {
  color: var(--color-text);
  font-size: 0.9375rem;
}

.setting-value.mono {
  font-family: var(--font-mono);
}

.setting-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.status-dot-success {
  background: var(--color-success);
}

.status-dot-muted {
  background: var(--color-text-muted);
}

.setting-description {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  line-height: 1.5;
}

.status-message {
  font-size: 0.8125rem;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
}

.status-message.success {
  background: rgba(34, 197, 94, 0.08);
  color: var(--color-success);
}

.status-message.error {
  background: rgba(239, 68, 68, 0.08);
  color: var(--color-danger);
}

.credential-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.credential-input {
  width: 100%;
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.875rem;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.credential-input::placeholder {
  color: var(--color-text-muted);
  font-family: var(--font-sans);
}

.credential-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-tint);
}

.credential-actions {
  display: flex;
  gap: var(--space-2);
}

.btn {
  min-height: var(--touch-min);
  padding: 0 var(--space-5);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 600;
  transition:
    background var(--transition-fast),
    opacity var(--transition-fast);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-accent);
  color: #ffffff;
}

.btn-primary:not(:disabled):hover {
  background: var(--color-accent-hover);
}

.btn-danger {
  background: transparent;
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
}

.btn-danger:not(:disabled):hover {
  background: rgba(239, 68, 68, 0.08);
}
</style>
