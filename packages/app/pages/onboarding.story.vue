<script setup lang="ts">
const currentStep = ref(1);

function setStep(step: number) {
  currentStep.value = step;
}
</script>

<template>
  <Story title="Pages / Onboarding" group="pages">
    <Variant title="Step 1 - Welcome">
      <div style="max-width: 560px; padding: 16px">
        <div class="onboarding">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 25%" />
          </div>
          <div class="step">
            <div class="step-content">
              <h1 class="step-title">Welcome, Finn</h1>
              <p class="step-description">
                Portable gives you a remote Claude Code environment accessible from anywhere. Let's
                get your credentials configured so you can start building.
              </p>
            </div>
            <div class="step-actions">
              <button class="btn btn-primary btn-full">Let's get you set up</button>
            </div>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Step 2 - API Key">
      <div style="max-width: 560px; padding: 16px">
        <div class="onboarding">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 50%" />
          </div>
          <div class="step">
            <div class="step-content">
              <h1 class="step-title">Anthropic Credential</h1>
              <p class="step-description">
                Claude Code needs an Anthropic credential to function. You can use either an API key
                or an OAuth token.
              </p>
              <div class="option-group">
                <div class="option-card">
                  <h3 class="option-title">Option A: OAuth Token</h3>
                  <p class="option-description">
                    Run this command in your terminal, then paste the result:
                  </p>
                  <div class="code-block">
                    <code>claude setup-token</code>
                    <button class="copy-btn">Copy</button>
                  </div>
                </div>
                <div class="option-card">
                  <h3 class="option-title">Option B: API Key</h3>
                  <p class="option-description">
                    Create an API key at console.anthropic.com and paste it below.
                  </p>
                </div>
              </div>
              <form class="credential-form" @submit.prevent>
                <input type="password" class="form-input" placeholder="sk-ant-... or OAuth token" />
                <button type="button" class="btn btn-primary btn-full">Save Credential</button>
              </form>
            </div>
            <div class="step-actions">
              <button class="btn btn-secondary">Back</button>
              <button class="btn btn-primary" disabled>Continue</button>
            </div>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Step 2 - Credential Saved">
      <div style="max-width: 560px; padding: 16px">
        <div class="onboarding">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 50%" />
          </div>
          <div class="step">
            <div class="step-content">
              <h1 class="step-title">Anthropic Credential</h1>
              <p class="step-description">Claude Code needs an Anthropic credential to function.</p>
              <div class="feedback-message success">Credential saved successfully.</div>
            </div>
            <div class="step-actions">
              <button class="btn btn-secondary">Back</button>
              <button class="btn btn-primary">Continue</button>
            </div>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Step 3 - AGE Key">
      <div style="max-width: 560px; padding: 16px">
        <div class="onboarding">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 75%" />
          </div>
          <div class="step">
            <div class="step-content">
              <h1 class="step-title">AGE Key</h1>
              <p class="step-description">
                An AGE key is used for SOPS decryption of encrypted secrets in your projects.
              </p>
              <div class="option-card">
                <h3 class="option-title">Generate a key pair</h3>
                <p class="option-description">Run these commands in your terminal:</p>
                <div class="code-block">
                  <code>age-keygen -o key.txt</code>
                  <button class="copy-btn">Copy</button>
                </div>
                <div class="code-block">
                  <code>cat key.txt</code>
                  <button class="copy-btn">Copy</button>
                </div>
                <p class="option-hint">
                  Store <code class="inline-code">key.txt</code> somewhere safe. Paste the private
                  key line (starting with <code class="inline-code">AGE-SECRET-KEY-</code>) below.
                </p>
              </div>
              <form class="credential-form" @submit.prevent>
                <input type="password" class="form-input" placeholder="AGE-SECRET-KEY-1..." />
                <button type="button" class="btn btn-primary btn-full">Save AGE Key</button>
              </form>
            </div>
            <div class="step-actions">
              <button class="btn btn-secondary">Back</button>
              <button class="btn btn-primary" disabled>Continue</button>
            </div>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="Step 4 - Complete">
      <div style="max-width: 560px; padding: 16px">
        <div class="onboarding">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 100%" />
          </div>
          <div class="step">
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
                Your credentials are configured. You can now create projects and start using Claude
                Code remotely.
              </p>
            </div>
            <div class="step-actions">
              <button class="btn btn-primary btn-full">Go to Dashboard</button>
            </div>
          </div>
        </div>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
.onboarding {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.progress-bar {
  width: 100%;
  height: 6px;
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

.step-done {
  align-items: center;
  text-align: center;
  padding: var(--space-6) 0;
}

.done-icon {
  margin-bottom: var(--space-3);
}
.done-icon svg {
  width: 56px;
  height: 56px;
}

.step-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

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

.option-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-base);
}

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

.inline-code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--color-bg-inset);
  padding: 1px 6px;
  border-radius: 4px;
}

.feedback-message {
  font-size: var(--font-size-sm);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm);
}

.feedback-message.success {
  background: var(--color-success-tint);
  color: var(--color-success);
}

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

.btn {
  min-height: var(--touch-min);
  padding: 0 var(--space-5);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    opacity var(--transition-fast);
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
