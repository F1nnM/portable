<script setup lang="ts">
definePageMeta({
  layout: false,
});

const route = useRoute();
const error = computed(() => route.query.error as string | undefined);
</script>

<template>
  <div class="login-page">
    <div class="login-bg">
      <div class="grid-lines" />
      <div class="glow-orb" />
    </div>

    <div class="login-content">
      <div class="login-card">
        <div class="brand">
          <div class="brand-icon">
            <span class="prompt">&gt;_</span>
          </div>
          <h1 class="brand-title">Portable</h1>
          <p class="brand-tagline">Claude Code, anywhere.</p>
        </div>

        <div v-if="error === 'not_allowed'" class="error-message">
          Your GitHub account is not authorized to access this instance.
        </div>

        <a href="/auth/github" class="btn-github">
          <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
            />
          </svg>
          Sign in with GitHub
        </a>

        <p class="login-footer">Isolated dev environments powered by Kubernetes.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-base);
  position: relative;
  overflow: hidden;
}

/* Background effects */
.login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.grid-lines {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--border-subtle) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px);
  background-size: 48px 48px;
  opacity: 0.5;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
}

.glow-orb {
  position: absolute;
  top: 30%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
  border-radius: 50%;
  filter: blur(60px);
  animation: pulse-glow 4s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%,
  100% {
    opacity: 0.6;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.1);
  }
}

/* Content */
.login-content {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: var(--space-md);
  max-width: 400px;
}

.login-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xl);
}

/* Brand */
.brand {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.brand-icon {
  width: 72px;
  height: 72px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 0 0 1px var(--border),
    0 4px 24px rgba(0, 0, 0, 0.4);
}

.prompt {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--accent);
  animation: blink-cursor 1s step-end infinite;
}

@keyframes blink-cursor {
  50% {
    opacity: 0.4;
  }
}

.brand-title {
  font-family: var(--font-display);
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.04em;
  color: var(--text-primary);
}

.brand-tagline {
  font-family: var(--font-mono);
  font-size: 0.9375rem;
  color: var(--text-secondary);
  letter-spacing: -0.01em;
}

/* Error message */
.error-message {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: rgba(248, 81, 73, 0.1);
  border: 1px solid rgba(248, 81, 73, 0.4);
  border-radius: var(--radius-md);
  color: #f85149;
  font-size: 0.875rem;
  text-align: center;
  line-height: 1.5;
}

/* GitHub button */
.btn-github {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  width: 100%;
  min-height: var(--touch-min);
  padding: var(--space-sm) var(--space-lg);
  background: var(--text-primary);
  color: var(--bg-base);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1rem;
  border-radius: var(--radius-md);
  text-decoration: none;
  transition:
    background var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.btn-github:hover {
  background: #ffffff;
  color: var(--bg-base);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.btn-github:active {
  transform: translateY(0);
}

.github-icon {
  width: 20px;
  height: 20px;
}

/* Footer */
.login-footer {
  font-size: 0.8125rem;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.5;
}
</style>
