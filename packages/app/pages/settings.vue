<script setup lang="ts">
import { onMounted } from "vue";

const { user, logout, refreshCredentialStatus } = useAuth();

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
const credentialLoading = ref(false);
const credentialMessage = ref<{ type: "success" | "error"; text: string } | null>(null);

const { data: credentialStatus, refresh: refreshCredStatus } = useFetch<{
  hasCredential: boolean;
}>("/api/settings/credential");

const hasCredential = computed(() => credentialStatus.value?.hasCredential ?? false);

async function saveCredential() {
  if (!credentialInput.value.trim()) return;
  credentialLoading.value = true;
  credentialMessage.value = null;
  try {
    await $fetch("/api/settings/credential", {
      method: "PUT",
      body: { credential: credentialInput.value.trim() },
    });
    credentialInput.value = "";
    credentialMessage.value = { type: "success", text: "Credential saved" };
    await refreshCredStatus();
    await refreshCredentialStatus();
  } catch {
    credentialMessage.value = { type: "error", text: "Failed to save credential" };
  } finally {
    credentialLoading.value = false;
  }
}

async function removeCredential() {
  credentialLoading.value = true;
  credentialMessage.value = null;
  try {
    await $fetch("/api/settings/credential", {
      method: "PUT",
      body: { credential: "" },
    });
    credentialMessage.value = { type: "success", text: "Credential removed" };
    await refreshCredStatus();
    await refreshCredentialStatus();
  } catch {
    credentialMessage.value = { type: "error", text: "Failed to remove credential" };
  } finally {
    credentialLoading.value = false;
  }
}

// AGE key management
const ageKeyInput = ref("");
const ageKeyLoading = ref(false);
const ageKeyMessage = ref<{ type: "success" | "error"; text: string } | null>(null);

const { data: ageKeyStatus, refresh: refreshAgeStatus } = useFetch<{
  hasAgeKey: boolean;
}>("/api/settings/age-key");

const hasAgeKey = computed(() => ageKeyStatus.value?.hasAgeKey ?? false);

async function saveAgeKey() {
  if (!ageKeyInput.value.trim()) return;
  ageKeyLoading.value = true;
  ageKeyMessage.value = null;
  try {
    await $fetch("/api/settings/age-key", {
      method: "PUT",
      body: { key: ageKeyInput.value.trim() },
    });
    ageKeyInput.value = "";
    ageKeyMessage.value = { type: "success", text: "AGE key saved" };
    await refreshAgeStatus();
    await refreshCredentialStatus();
  } catch {
    ageKeyMessage.value = { type: "error", text: "Failed to save AGE key" };
  } finally {
    ageKeyLoading.value = false;
  }
}

async function removeAgeKey() {
  ageKeyLoading.value = true;
  ageKeyMessage.value = null;
  try {
    await $fetch("/api/settings/age-key", {
      method: "PUT",
      body: { key: "" },
    });
    ageKeyMessage.value = { type: "success", text: "AGE key removed" };
    await refreshAgeStatus();
    await refreshCredentialStatus();
  } catch {
    ageKeyMessage.value = { type: "error", text: "Failed to remove AGE key" };
  } finally {
    ageKeyLoading.value = false;
  }
}
</script>

<template>
  <div class="settings">
    <div class="page-header">
      <h1 class="page-title">Settings</h1>
    </div>

    <!-- Account -->
    <section class="settings-section">
      <h2 class="section-title">Account</h2>
      <div class="settings-card">
        <div class="setting-row">
          <span class="setting-label">GitHub</span>
          <span class="setting-value mono">{{ user?.username }}</span>
        </div>
      </div>
    </section>

    <!-- Theme -->
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

    <!-- Anthropic Credential -->
    <section class="settings-section">
      <h2 class="section-title">Anthropic Credential</h2>
      <div class="settings-card">
        <p class="setting-description">
          Your Anthropic API key or Claude Code OAuth token. Required to use Claude in your
          projects.
        </p>

        <div class="setting-row">
          <span class="setting-label">Status</span>
          <span class="setting-status">
            <span class="status-dot" :class="hasCredential ? 'dot-success' : 'dot-muted'" />
            {{ hasCredential ? "Configured" : "Not configured" }}
          </span>
        </div>

        <div v-if="credentialMessage" class="feedback-message" :class="credentialMessage.type">
          {{ credentialMessage.text }}
        </div>

        <form class="credential-form" @submit.prevent="saveCredential">
          <input
            v-model="credentialInput"
            type="password"
            class="form-input"
            :placeholder="
              hasCredential ? 'Enter new credential to replace' : 'sk-ant-... or OAuth token'
            "
            autocomplete="off"
          />
          <div class="form-actions">
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="credentialLoading || !credentialInput.trim()"
            >
              {{ credentialLoading ? "Saving..." : "Save" }}
            </button>
            <button
              v-if="hasCredential"
              type="button"
              class="btn btn-danger"
              :disabled="credentialLoading"
              @click="removeCredential"
            >
              Remove
            </button>
          </div>
        </form>
      </div>
    </section>

    <!-- AGE Key -->
    <section class="settings-section">
      <h2 class="section-title">AGE Key</h2>
      <div class="settings-card">
        <p class="setting-description">
          Your AGE private key for SOPS decryption of encrypted secrets in your projects.
        </p>

        <div class="setting-row">
          <span class="setting-label">Status</span>
          <span class="setting-status">
            <span class="status-dot" :class="hasAgeKey ? 'dot-success' : 'dot-muted'" />
            {{ hasAgeKey ? "Configured" : "Not configured" }}
          </span>
        </div>

        <div v-if="ageKeyMessage" class="feedback-message" :class="ageKeyMessage.type">
          {{ ageKeyMessage.text }}
        </div>

        <form class="credential-form" @submit.prevent="saveAgeKey">
          <input
            v-model="ageKeyInput"
            type="password"
            class="form-input"
            :placeholder="hasAgeKey ? 'Enter new key to replace' : 'AGE-SECRET-KEY-1...'"
            autocomplete="off"
          />
          <div class="form-actions">
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="ageKeyLoading || !ageKeyInput.trim()"
            >
              {{ ageKeyLoading ? "Saving..." : "Save" }}
            </button>
            <button
              v-if="hasAgeKey"
              type="button"
              class="btn btn-danger"
              :disabled="ageKeyLoading"
              @click="removeAgeKey"
            >
              Remove
            </button>
          </div>
        </form>
      </div>
    </section>

    <!-- Logout -->
    <section class="settings-section">
      <button class="btn btn-logout" @click="logout">Sign out</button>
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
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.section-title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
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
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-normal);
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
  color: var(--color-accent-text);
}

/* Setting rows */
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--touch-min);
}

.setting-label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
}

.setting-value {
  color: var(--color-text);
  font-size: var(--font-size-base);
}

.setting-value.mono {
  font-family: var(--font-mono);
}

.setting-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-normal);
  color: var(--color-text-secondary);
}

.status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.dot-success {
  background: var(--color-success);
}

.dot-muted {
  background: var(--color-text-muted);
}

.setting-description {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
}

/* Feedback messages */
.feedback-message {
  font-size: var(--font-size-sm);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
}

.feedback-message.success {
  background: var(--color-success-tint);
  color: var(--color-success);
}

.feedback-message.error {
  background: var(--color-danger-tint);
  color: var(--color-danger);
}

/* Form styles */
.credential-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-input {
  width: 100%;
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.form-input::placeholder {
  color: var(--color-text-muted);
  font-family: var(--font-sans);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-tint);
}

.form-actions {
  display: flex;
  gap: var(--space-2);
}

/* Buttons */
.btn {
  min-height: var(--touch-min);
  padding: 0 var(--space-5);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
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
  color: var(--color-accent-text);
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
  background: var(--color-danger-tint);
}

.btn-logout {
  width: 100%;
  min-height: var(--touch-min);
  background: transparent;
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.btn-logout:hover {
  background: var(--color-danger-tint);
}
</style>
