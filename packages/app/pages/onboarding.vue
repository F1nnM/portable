<script setup lang="ts">
import { onMounted } from "vue";

const { user, hasCredential, hasAgeKey, isSetupComplete, refreshCredentialStatus } = useAuth();

const currentStep = ref(1);
const credentialInput = ref("");
const ageKeyInput = ref("");
const credentialSaving = ref(false);
const ageKeySaving = ref(false);
const credentialSaved = ref(false);
const ageKeySaved = ref(false);
const credentialError = ref("");
const ageKeyError = ref("");
const copySuccess = ref<string | null>(null);

onMounted(async () => {
  // Load theme
  const theme = localStorage.getItem("portable-theme");
  if (theme && theme !== "system") {
    document.documentElement.dataset.theme = theme;
  }

  // Refresh credential status and skip ahead if keys are already set
  await refreshCredentialStatus();
  if (isSetupComplete.value) {
    navigateTo("/");
    return;
  }
  if (hasCredential.value === true) {
    credentialSaved.value = true;
    // Skip to AGE key step if credential is set
    currentStep.value = 3;
  }
});

function nextStep() {
  if (currentStep.value < 4) {
    currentStep.value++;
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

async function saveCredential() {
  if (!credentialInput.value.trim()) return;
  credentialSaving.value = true;
  credentialError.value = "";
  try {
    await $fetch("/api/settings/credential", {
      method: "PUT",
      body: { credential: credentialInput.value.trim() },
    });
    credentialInput.value = "";
    credentialSaved.value = true;
    await refreshCredentialStatus();
  } catch {
    credentialError.value = "Failed to save credential. Please try again.";
  } finally {
    credentialSaving.value = false;
  }
}

async function saveAgeKey() {
  if (!ageKeyInput.value.trim()) return;
  ageKeySaving.value = true;
  ageKeyError.value = "";
  try {
    await $fetch("/api/settings/age-key", {
      method: "PUT",
      body: { key: ageKeyInput.value.trim() },
    });
    ageKeyInput.value = "";
    ageKeySaved.value = true;
    await refreshCredentialStatus();
  } catch {
    ageKeyError.value = "Failed to save AGE key. Please try again.";
  } finally {
    ageKeySaving.value = false;
  }
}

async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    copySuccess.value = label;
    setTimeout(() => {
      copySuccess.value = null;
    }, 2000);
  } catch {
    // Clipboard API not available
  }
}

function goToDashboard() {
  navigateTo("/");
}
</script>

<template>
  <div class="onboarding">
    <!-- Progress indicator -->
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: `${(currentStep / 4) * 100}%` }" />
    </div>

    <!-- Step 1: Welcome -->
    <div v-if="currentStep === 1" class="step">
      <div class="step-content">
        <h1 class="step-title">Welcome{{ user?.displayName ? `, ${user.displayName}` : "" }}</h1>
        <p class="step-description">
          Portable gives you a remote Claude Code environment accessible from anywhere. Let's get
          your credentials configured so you can start building.
        </p>
      </div>
      <div class="step-actions">
        <button class="btn btn-primary btn-full" @click="nextStep">Let's get you set up</button>
      </div>
    </div>

    <!-- Step 2: Anthropic API Key -->
    <div v-if="currentStep === 2" class="step">
      <div class="step-content">
        <h1 class="step-title">Anthropic Credential</h1>
        <p class="step-description">
          Claude Code needs an Anthropic credential to function. You can use either an API key or an
          OAuth token.
        </p>

        <div class="option-group">
          <div class="option-card">
            <h3 class="option-title">Option A: OAuth Token</h3>
            <p class="option-description">
              Run this command in your terminal, then paste the result:
            </p>
            <div class="code-block">
              <code>claude setup-token</code>
              <button
                class="copy-btn"
                :class="{ copied: copySuccess === 'setup-token' }"
                @click="copyToClipboard('claude setup-token', 'setup-token')"
              >
                {{ copySuccess === "setup-token" ? "Copied" : "Copy" }}
              </button>
            </div>
          </div>

          <div class="option-card">
            <h3 class="option-title">Option B: API Key</h3>
            <p class="option-description">
              Create an API key at
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">
                console.anthropic.com
              </a>
              and paste it below.
            </p>
          </div>
        </div>

        <div v-if="credentialSaved" class="feedback-message success">
          Credential saved successfully.
        </div>

        <div v-if="credentialError" class="feedback-message error">
          {{ credentialError }}
        </div>

        <form v-if="!credentialSaved" class="credential-form" @submit.prevent="saveCredential">
          <input
            v-model="credentialInput"
            type="password"
            class="form-input"
            placeholder="sk-ant-... or OAuth token"
            autocomplete="off"
          />
          <button
            type="submit"
            class="btn btn-primary btn-full"
            :disabled="credentialSaving || !credentialInput.trim()"
          >
            {{ credentialSaving ? "Saving..." : "Save Credential" }}
          </button>
        </form>
      </div>
      <div class="step-actions">
        <button class="btn btn-secondary" @click="prevStep">Back</button>
        <button class="btn btn-primary" :disabled="!credentialSaved" @click="nextStep">
          Continue
        </button>
      </div>
    </div>

    <!-- Step 3: AGE Key -->
    <div v-if="currentStep === 3" class="step">
      <div class="step-content">
        <h1 class="step-title">AGE Key</h1>
        <p class="step-description">
          An AGE key is used for SOPS decryption of encrypted secrets in your projects. Generate one
          and paste the private key below.
        </p>

        <div class="option-card">
          <h3 class="option-title">Generate a key pair</h3>
          <p class="option-description">Run these commands in your terminal:</p>

          <div class="code-block">
            <code>age-keygen -o key.txt</code>
            <button
              class="copy-btn"
              :class="{ copied: copySuccess === 'keygen' }"
              @click="copyToClipboard('age-keygen -o key.txt', 'keygen')"
            >
              {{ copySuccess === "keygen" ? "Copied" : "Copy" }}
            </button>
          </div>

          <div class="code-block">
            <code>cat key.txt</code>
            <button
              class="copy-btn"
              :class="{ copied: copySuccess === 'cat' }"
              @click="copyToClipboard('cat key.txt', 'cat')"
            >
              {{ copySuccess === "cat" ? "Copied" : "Copy" }}
            </button>
          </div>

          <p class="option-hint">
            Store <code class="inline-code">key.txt</code> somewhere safe. Paste the private key
            line (starting with <code class="inline-code">AGE-SECRET-KEY-</code>) below.
          </p>
        </div>

        <div v-if="ageKeySaved" class="feedback-message success">AGE key saved successfully.</div>

        <div v-if="ageKeyError" class="feedback-message error">
          {{ ageKeyError }}
        </div>

        <form v-if="!ageKeySaved" class="credential-form" @submit.prevent="saveAgeKey">
          <input
            v-model="ageKeyInput"
            type="password"
            class="form-input"
            placeholder="AGE-SECRET-KEY-1..."
            autocomplete="off"
          />
          <button
            type="submit"
            class="btn btn-primary btn-full"
            :disabled="ageKeySaving || !ageKeyInput.trim()"
          >
            {{ ageKeySaving ? "Saving..." : "Save AGE Key" }}
          </button>
        </form>
      </div>
      <div class="step-actions">
        <button class="btn btn-secondary" @click="prevStep">Back</button>
        <button class="btn btn-primary" :disabled="!ageKeySaved" @click="nextStep">Continue</button>
      </div>
    </div>

    <!-- Step 4: Done -->
    <div v-if="currentStep === 4" class="step">
      <div class="step-content step-done">
        <div class="done-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="24" fill="var(--color-success-tint)" />
            <path
              d="M16 24L22 30L32 18"
              stroke="var(--color-success)"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <h1 class="step-title">You're all set</h1>
        <p class="step-description">
          Your credentials are configured. You can now create projects and start using Claude Code
          remotely.
        </p>
      </div>
      <div class="step-actions">
        <button class="btn btn-primary btn-full" @click="goToDashboard">Go to Dashboard</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.onboarding {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 560px;
  margin: 0 auto;
}

/* Progress bar */
.progress-bar {
  width: 100%;
  height: 4px;
  background: var(--color-bg-inset);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: var(--radius-full);
  transition: width var(--transition-base);
}

/* Steps */
.step {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.step-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.step-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
}

.step-description {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}

.step-done {
  align-items: center;
  text-align: center;
  padding: var(--space-6) 0;
}

.done-icon {
  margin-bottom: var(--space-2);
}

/* Step actions */
.step-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

/* Option groups */
.option-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.option-card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  box-shadow: var(--shadow-card);
}

.option-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.option-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}

.option-description a {
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.option-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-base);
}

/* Code blocks */
.code-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  background: var(--color-bg-inset);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  overflow-x: auto;
}

.copy-btn {
  flex-shrink: 0;
  padding: var(--space-1) var(--space-3);
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.copy-btn:hover {
  background: var(--color-bg-elevated);
  color: var(--color-text);
}

.copy-btn.copied {
  color: var(--color-success);
  border-color: var(--color-success);
}

.inline-code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--color-bg-inset);
  padding: 1px 6px;
  border-radius: 4px;
}

/* Feedback messages */
.feedback-message {
  font-size: var(--font-size-sm);
  padding: var(--space-3) var(--space-4);
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

/* Form */
.credential-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
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

/* Buttons */
.btn {
  min-height: var(--touch-min);
  padding: 0 var(--space-5);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  transition:
    background var(--transition-fast),
    opacity var(--transition-fast),
    color var(--transition-fast);
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-full {
  width: 100%;
}

.btn-primary {
  background: var(--color-accent);
  color: var(--color-accent-text);
}

.btn-primary:not(:disabled):hover {
  background: var(--color-accent-hover);
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.btn-secondary:hover {
  background: var(--color-bg-elevated);
  color: var(--color-text);
}
</style>
