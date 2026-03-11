<script setup lang="ts">
const showDoneIcon = ref(true);
</script>

<template>
  <Story title="Pages / Onboarding" group="pages">
    <Variant title="Step 1 - Welcome">
      <div style="max-width: 560px; padding: 16px">
        <div class="onboarding">
          <div class="progress-steps">
            <div class="progress-step active">
              <div class="step-circle"><span class="step-number">1</span></div>
            </div>
            <div class="progress-line" />
            <div class="progress-step">
              <div class="step-circle"><span class="step-number">2</span></div>
            </div>
            <div class="progress-line" />
            <div class="progress-step">
              <div class="step-circle"><span class="step-number">3</span></div>
            </div>
            <div class="progress-line" />
            <div class="progress-step">
              <div class="step-circle"><span class="step-number">4</span></div>
            </div>
          </div>
          <div class="step">
            <div class="step-content welcome-step">
              <div class="welcome-decoration" aria-hidden="true">&gt;_</div>
              <h1 class="step-title stagger-1">Welcome, Finn</h1>
              <p class="step-description stagger-2">
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
          <div class="progress-steps">
            <div class="progress-step completed">
              <div class="step-circle">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>
            <div class="progress-line filled" />
            <div class="progress-step active">
              <div class="step-circle"><span class="step-number">2</span></div>
            </div>
            <div class="progress-line" />
            <div class="progress-step">
              <div class="step-circle"><span class="step-number">3</span></div>
            </div>
            <div class="progress-line" />
            <div class="progress-step">
              <div class="step-circle"><span class="step-number">4</span></div>
            </div>
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
                      <button class="copy-btn">Copy</button>
                    </div>
                  </div>
                </div>
                <div class="option-card">
                  <div class="option-label">B</div>
                  <h3 class="option-title">API Key</h3>
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
          <div class="progress-steps">
            <div class="progress-step completed">
              <div class="step-circle">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>
            <div class="progress-line filled" />
            <div class="progress-step active">
              <div class="step-circle"><span class="step-number">2</span></div>
            </div>
            <div class="progress-line" />
            <div class="progress-step">
              <div class="step-circle"><span class="step-number">3</span></div>
            </div>
            <div class="progress-line" />
            <div class="progress-step">
              <div class="step-circle"><span class="step-number">4</span></div>
            </div>
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
          <div class="progress-steps">
            <div class="progress-step completed">
              <div class="step-circle">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>
            <div class="progress-line filled" />
            <div class="progress-step completed">
              <div class="step-circle">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>
            <div class="progress-line filled" />
            <div class="progress-step active">
              <div class="step-circle"><span class="step-number">3</span></div>
            </div>
            <div class="progress-line" />
            <div class="progress-step">
              <div class="step-circle"><span class="step-number">4</span></div>
            </div>
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
                <div class="code-block terminal">
                  <div class="terminal-header">
                    <span class="terminal-dot dot-red" />
                    <span class="terminal-dot dot-yellow" />
                    <span class="terminal-dot dot-green" />
                  </div>
                  <div class="terminal-body">
                    <code>age-keygen -o key.txt</code>
                    <button class="copy-btn">Copy</button>
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
                    <button class="copy-btn">Copy</button>
                  </div>
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
          <div class="progress-steps">
            <div class="progress-step completed">
              <div class="step-circle">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>
            <div class="progress-line filled" />
            <div class="progress-step completed">
              <div class="step-circle">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>
            <div class="progress-line filled" />
            <div class="progress-step completed">
              <div class="step-circle">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>
            <div class="progress-line filled" />
            <div class="progress-step active">
              <div class="step-circle"><span class="step-number">4</span></div>
            </div>
          </div>
          <div class="step">
            <div class="step-content step-done">
              <div class="done-celebration">
                <div class="done-icon visible">
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

/* Welcome step */
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
