<script setup lang="ts">
import { onMounted } from "vue";

const { user, hasCredential, isSetupComplete, refreshCredentialStatus } = useAuth();

const currentStep = ref(1);
const transitionName = ref("step-forward");
const credentialInput = ref("");
const ageKeyInput = ref("");
const credentialSaving = ref(false);
const ageKeySaving = ref(false);
const credentialSaved = ref(false);
const ageKeySaved = ref(false);
const credentialError = ref("");
const ageKeyError = ref("");
const copySuccess = ref<string | null>(null);
const showDoneIcon = ref(false);

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
    transitionName.value = "step-forward";
    currentStep.value++;
    if (currentStep.value === 4) {
      setTimeout(() => {
        showDoneIcon.value = true;
      }, 300);
    }
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    transitionName.value = "step-backward";
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
    <!-- Stepped progress indicator -->
    <div class="progress-steps">
      <template v-for="step in 4" :key="step">
        <div
          class="progress-step"
          :class="{
            active: currentStep === step,
            completed: currentStep > step,
          }"
        >
          <div class="step-circle">
            <svg v-if="currentStep > step" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6L5 8.5L9.5 3.5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span v-else class="step-number">{{ step }}</span>
          </div>
        </div>
        <div v-if="step < 4" class="progress-line" :class="{ filled: currentStep > step }" />
      </template>
    </div>

    <!-- Step content with transitions -->
    <Transition :name="transitionName" mode="out-in">
      <!-- Step 1: Welcome -->
      <div v-if="currentStep === 1" key="step1" class="step">
        <div class="step-content welcome-step">
          <div class="welcome-decoration" aria-hidden="true">&gt;_</div>
          <h1 class="step-title stagger-1">
            Welcome{{ user?.displayName ? `, ${user.displayName}` : "" }}
          </h1>
          <p class="step-description stagger-2">
            Portable gives you a remote Claude Code environment accessible from anywhere. Let's get
            your credentials configured so you can start building.
          </p>
        </div>
        <div class="step-actions">
          <button class="btn btn-primary btn-full" @click="nextStep">Let's get you set up</button>
        </div>
      </div>

      <!-- Step 2: Anthropic API Key -->
      <div v-else-if="currentStep === 2" key="step2" class="step">
        <div class="step-content">
          <h1 class="step-title">Anthropic Credential</h1>
          <p class="step-description">
            Claude Code needs an Anthropic credential to function. You can use either an API key or
            an OAuth token.
          </p>

          <div class="option-group">
            <div class="option-card">
              <div class="option-label">A</div>
              <h3 class="option-title">OAuth Token</h3>
              <p class="option-description">
                Run this command in your terminal, then paste the result:
              </p>
              <div class="code-block terminal">
                <div class="terminal-header">
                  <span class="terminal-dot dot-red" />
                  <span class="terminal-dot dot-yellow" />
                  <span class="terminal-dot dot-green" />
                </div>
                <div class="terminal-body">
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
            </div>

            <div class="option-card">
              <div class="option-label">B</div>
              <h3 class="option-title">API Key</h3>
              <p class="option-description">
                Create an API key at
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener"
                >
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
      <div v-else-if="currentStep === 3" key="step3" class="step">
        <div class="step-content">
          <h1 class="step-title">AGE Key</h1>
          <p class="step-description">
            An AGE key is used for SOPS decryption of encrypted secrets in your projects. Generate
            one and paste the private key below.
          </p>

          <div class="option-card">
            <h3 class="option-title">Generate a key pair</h3>
            <p class="option-description">Run these commands in your terminal:</p>

            <div class="code-block terminal">
              <div class="terminal-header">
                <span class="terminal-dot dot-red" />
                <span class="terminal-dot dot-yellow" />
                <span class="terminal-dot dot-green" />
              </div>
              <div class="terminal-body">
                <code>age-keygen -o key.txt</code>
                <button
                  class="copy-btn"
                  :class="{ copied: copySuccess === 'keygen' }"
                  @click="copyToClipboard('age-keygen -o key.txt', 'keygen')"
                >
                  {{ copySuccess === "keygen" ? "Copied" : "Copy" }}
                </button>
              </div>
            </div>

            <div class="code-block terminal">
              <div class="terminal-header">
                <span class="terminal-dot dot-red" />
                <span class="terminal-dot dot-yellow" />
                <span class="terminal-dot dot-green" />
              </div>
              <div class="terminal-body">
                <code>cat key.txt</code>
                <button
                  class="copy-btn"
                  :class="{ copied: copySuccess === 'cat' }"
                  @click="copyToClipboard('cat key.txt', 'cat')"
                >
                  {{ copySuccess === "cat" ? "Copied" : "Copy" }}
                </button>
              </div>
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
          <button class="btn btn-primary" :disabled="!ageKeySaved" @click="nextStep">
            Continue
          </button>
        </div>
      </div>

      <!-- Step 4: Done -->
      <div v-else-if="currentStep === 4" key="step4" class="step">
        <div class="step-content step-done">
          <div class="done-celebration">
            <span class="confetti-dot" style="--i: 0" />
            <span class="confetti-dot" style="--i: 1" />
            <span class="confetti-dot" style="--i: 2" />
            <span class="confetti-dot" style="--i: 3" />
            <span class="confetti-dot" style="--i: 4" />
            <span class="confetti-dot" style="--i: 5" />
            <div class="done-icon" :class="{ visible: showDoneIcon }">
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
    </Transition>
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

/* Stepped progress indicator */
.progress-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: var(--space-2) 0;
}

.progress-step {
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-sans);
  border: 2px solid var(--color-border);
  color: var(--color-text-muted);
  background: var(--color-bg-surface);
  transition: all var(--transition-base);
}

.progress-step.active .step-circle {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-text);
}

.progress-step.completed .step-circle {
  border-color: var(--color-accent);
  background: var(--color-accent-tint);
  color: var(--color-accent);
}

.step-number {
  line-height: 1;
}

.progress-line {
  width: 32px;
  height: 2px;
  background: var(--color-border);
  margin: 0 var(--space-1);
  transition: background var(--transition-base);
}

.progress-line.filled {
  background: var(--color-accent);
}

/* Step transitions */
.step-forward-enter-active,
.step-forward-leave-active,
.step-backward-enter-active,
.step-backward-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}

.step-forward-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.step-forward-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

.step-backward-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}

.step-backward-leave-to {
  opacity: 0;
  transform: translateX(24px);
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
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.step-description {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}

/* Welcome step decoration */
.welcome-step {
  position: relative;
  overflow: hidden;
}

.welcome-decoration {
  position: absolute;
  top: -16px;
  right: -8px;
  font-family: var(--font-mono);
  font-size: 96px;
  font-weight: var(--font-weight-bold);
  line-height: 1;
  color: var(--color-accent);
  opacity: 0.08;
  pointer-events: none;
  user-select: none;
}

.welcome-step .step-title,
.welcome-step .step-description {
  position: relative;
  z-index: 1;
}

@keyframes stagger-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.stagger-1 {
  animation: stagger-in 400ms ease both;
  animation-delay: 100ms;
}

.stagger-2 {
  animation: stagger-in 400ms ease both;
  animation-delay: 250ms;
}

/* Done step */
.step-done {
  align-items: center;
  text-align: center;
  padding: var(--space-6) 0;
}

.done-celebration {
  position: relative;
  margin-bottom: var(--space-3);
}

.done-icon {
  transform: scale(0);
  transition: transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.done-icon.visible {
  transform: scale(1);
}

.done-icon svg {
  width: 56px;
  height: 56px;
}

/* Confetti dots */
.confetti-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent);
  opacity: 0;
  animation: confetti-burst 800ms ease-out forwards;
  animation-delay: calc(var(--i) * 80ms + 400ms);
}

@keyframes confetti-burst {
  0% {
    opacity: 0.8;
    transform: translate(0, 0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(var(--tx), var(--ty)) scale(0);
  }
}

.confetti-dot:nth-child(1) {
  --tx: -30px;
  --ty: -25px;
  top: 50%;
  left: 50%;
}
.confetti-dot:nth-child(2) {
  --tx: 28px;
  --ty: -20px;
  top: 50%;
  left: 50%;
  background: var(--color-success);
}
.confetti-dot:nth-child(3) {
  --tx: -20px;
  --ty: 28px;
  top: 50%;
  left: 50%;
}
.confetti-dot:nth-child(4) {
  --tx: 25px;
  --ty: 22px;
  top: 50%;
  left: 50%;
  background: var(--color-warning);
}
.confetti-dot:nth-child(5) {
  --tx: -35px;
  --ty: 5px;
  top: 50%;
  left: 50%;
  background: var(--color-success);
}
.confetti-dot:nth-child(6) {
  --tx: 32px;
  --ty: -5px;
  top: 50%;
  left: 50%;
}

/* Step actions */
.step-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

/* Option groups */
.option-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.option-card {
  position: relative;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-accent);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  padding-top: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  box-shadow: var(--shadow-card);
}

.option-label {
  position: absolute;
  top: var(--space-2);
  right: var(--space-3);
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  font-family: var(--font-mono);
  color: var(--color-accent);
  background: var(--color-accent-tint);
  border-radius: var(--radius-full);
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

/* Terminal-style code blocks */
.code-block.terminal {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: var(--radius-sm);
  padding: 0;
  overflow: hidden;
}

.terminal-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #2a2a2a;
  border-bottom: 1px solid #333;
}

.terminal-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-red {
  background: #ff5f57;
}
.dot-yellow {
  background: #febc2e;
}
.dot-green {
  background: #28c840;
}

.terminal-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: #b5e8b0;
}

.terminal-body .copy-btn {
  flex-shrink: 0;
  padding: var(--space-1) var(--space-3);
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: #999;
  background: #333;
  border: 1px solid #444;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.terminal-body .copy-btn:hover {
  background: #444;
  color: #ddd;
}

.terminal-body .copy-btn.copied {
  color: #28c840;
  border-color: #28c840;
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
