<script setup lang="ts">
import { onMounted } from "vue";

const { user, isAuthenticated, isSetupComplete } = useAuth();

onMounted(() => {
  const theme = localStorage.getItem("portable-theme");
  if (theme && theme !== "system") {
    document.documentElement.dataset.theme = theme;
  }
});
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <NuxtLink to="/" class="topbar-brand">portable</NuxtLink>
      <div class="topbar-actions">
        <NuxtLink
          v-if="isSetupComplete"
          to="/projects/new"
          class="topbar-btn"
          aria-label="New project"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <line x1="10" y1="4" x2="10" y2="16" />
            <line x1="4" y1="10" x2="16" y2="10" />
          </svg>
        </NuxtLink>
        <NuxtLink v-if="isAuthenticated" to="/settings" class="topbar-avatar" aria-label="Settings">
          <img
            v-if="user?.avatarUrl"
            :src="user.avatarUrl"
            :alt="user.username"
            class="avatar-img"
          />
          <span v-else class="avatar-fallback">{{ user?.username?.charAt(0)?.toUpperCase() }}</span>
        </NuxtLink>
      </div>
    </header>
    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.topbar-brand {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  text-decoration: none;
  letter-spacing: -0.03em;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.topbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.topbar-btn:hover {
  background: var(--color-bg-inset);
  color: var(--color-text);
}

.topbar-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: var(--color-accent-tint);
  transition: opacity var(--transition-fast);
}

.topbar-avatar:hover {
  opacity: 0.8;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-accent);
}

.main-content {
  flex: 1;
  padding: var(--space-5) var(--space-4);
  max-width: var(--content-max-width);
  width: 100%;
  margin: 0 auto;
}
</style>
