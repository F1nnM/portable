<script setup lang="ts">
// Story for the login page
</script>

<template>
  <Story title="Pages / Login" group="pages">
    <Variant title="Default">
      <div
        style="
          height: 600px;
          width: 420px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="login-page">
          <div class="login-bg">
            <div class="ambient-glow" />
          </div>
          <div class="login-content">
            <div class="login-card">
              <div class="brand">
                <h1 class="brand-name">portable</h1>
                <p class="brand-tagline">Your remote Claude Code environment</p>
              </div>
              <button class="btn-github">
                <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                Sign in with GitHub
              </button>
            </div>
          </div>
        </div>
      </div>
    </Variant>

    <Variant title="With Error">
      <div
        style="
          height: 600px;
          width: 420px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        "
      >
        <div class="login-page">
          <div class="login-bg">
            <div class="ambient-glow" />
          </div>
          <div class="login-content">
            <div class="login-card">
              <div class="brand">
                <h1 class="brand-name">portable</h1>
                <p class="brand-tagline">Your remote Claude Code environment</p>
              </div>
              <div class="error-message">
                Your GitHub account is not authorized to access this instance.
              </div>
              <button class="btn-github">
                <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                Sign in with GitHub
              </button>
            </div>
          </div>
        </div>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  position: relative;
  overflow: hidden;
}

.login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ambient-glow {
  position: absolute;
  top: 35%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, var(--color-accent) 0%, transparent 70%);
  opacity: 0.08;
  border-radius: 50%;
  filter: blur(80px);
}

.login-content {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: var(--space-4);
  max-width: 420px;
}

.login-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-7);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-7) var(--space-6);
  box-shadow: var(--shadow-elevated);
}

.brand {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.brand-name {
  font-family: var(--font-sans);
  font-size: 2rem;
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  letter-spacing: -0.03em;
  line-height: 1;
}

.brand-tagline {
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  letter-spacing: 0.01em;
}

.error-message {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--color-danger-tint);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-sm);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  text-align: center;
  line-height: var(--line-height-base);
}

.btn-github {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 52px;
  padding: var(--space-3) var(--space-5);
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-base);
  border-radius: var(--radius-md);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(217, 122, 62, 0.25);
  transition:
    background var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.btn-github:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(217, 122, 62, 0.35);
}

.btn-github:active {
  background: var(--color-accent-active);
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(217, 122, 62, 0.2);
}

.github-icon {
  width: 20px;
  height: 20px;
}
</style>
