<script setup lang="ts">
import { onMounted } from "vue";

definePageMeta({
  layout: false,
});

const route = useRoute();
const error = computed(() => route.query.error as string | undefined);

onMounted(() => {
  const theme = localStorage.getItem("portable-theme");
  if (theme && theme !== "system") {
    document.documentElement.dataset.theme = theme;
  }
});
</script>

<template>
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
  background: var(--color-bg);
  position: relative;
  overflow: hidden;
}

/* Ambient background */
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
  opacity: 0.05;
  border-radius: 50%;
  filter: blur(80px);
  animation: drift 18s ease-in-out infinite;
}

@keyframes drift {
  0% {
    transform: translate(-50%, -50%) translate(0, 0);
  }
  33% {
    transform: translate(-50%, -50%) translate(30px, -20px);
  }
  66% {
    transform: translate(-50%, -50%) translate(-20px, 15px);
  }
  100% {
    transform: translate(-50%, -50%) translate(0, 0);
  }
}

/* Content */
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
  gap: var(--space-6);
  background: var(--color-bg-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-7) var(--space-6);
  box-shadow: var(--shadow-elevated);
}

/* Brand */
.brand {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.brand-name {
  font-family: var(--font-sans);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.brand-tagline {
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

/* Error message */
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

/* GitHub button */
.btn-github {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  min-height: var(--touch-min);
  padding: var(--space-3) var(--space-5);
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-base);
  border-radius: var(--radius-sm);
  text-decoration: none;
  transition:
    background var(--transition-fast),
    transform var(--transition-fast);
}

.btn-github:hover {
  background: var(--color-accent-hover);
  color: var(--color-accent-text);
}

.btn-github:active {
  background: var(--color-accent-active);
  transform: scale(0.98);
}

.github-icon {
  width: 20px;
  height: 20px;
}
</style>
