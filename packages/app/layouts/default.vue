<script setup lang="ts">
import { onMounted } from "vue";

const { user, logout } = useAuth();
const route = useRoute();

const navItems = [
  { path: "/", label: "Dashboard", icon: "grid" },
  { path: "/new", label: "New", icon: "plus" },
  { path: "/settings", label: "Settings", icon: "gear" },
] as const;

function isActive(path: string): boolean {
  return route.path === path;
}

onMounted(() => {
  const theme = localStorage.getItem("portable-theme");
  if (theme && theme !== "system") {
    document.documentElement.dataset.theme = theme;
  }
});
</script>

<template>
  <div class="app-layout">
    <!-- Top bar -->
    <header class="topbar">
      <div class="topbar-inner">
        <NuxtLink to="/" class="topbar-brand">
          <span class="brand-mark">&gt;_</span>
          <span class="brand-name">portable</span>
        </NuxtLink>

        <div v-if="user" class="topbar-user">
          <span class="user-name">{{ user.username }}</span>
          <button class="btn-logout" @click="logout">Sign out</button>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="main-content">
      <slot />
    </main>

    <!-- Bottom navigation (mobile) -->
    <nav v-if="user" class="bottom-nav">
      <NuxtLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
      >
        <svg
          v-if="item.icon === 'grid'"
          class="nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <svg
          v-else-if="item.icon === 'plus'"
          class="nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <svg
          v-else-if="item.icon === 'gear'"
          class="nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
        <span class="nav-label">{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

/* Top bar */
.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
}

.topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-2) var(--space-4);
  height: 56px;
}

.topbar-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-text);
  text-decoration: none;
}

.brand-mark {
  font-family: var(--font-mono);
  color: var(--color-accent);
  font-size: 0.9375rem;
}

.brand-name {
  letter-spacing: -0.01em;
}

.topbar-user {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.user-name {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.btn-logout {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  min-height: var(--touch-min);
  display: flex;
  align-items: center;
  padding: 0 var(--space-2);
  transition: color var(--transition-fast);
}

.btn-logout:hover {
  color: var(--color-danger);
}

/* Main content */
.main-content {
  flex: 1;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4);
  padding-bottom: calc(var(--space-5) + 72px);
}

/* Bottom nav */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  background: var(--color-bg-surface);
  border-top: 1px solid var(--color-border);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  height: 60px;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  flex: 1;
  min-height: var(--touch-min);
  color: var(--color-text-muted);
  text-decoration: none;
  transition: color var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.nav-item.active {
  color: var(--color-accent);
}

.nav-item:hover {
  color: var(--color-text-secondary);
}

.nav-item.active:hover {
  color: var(--color-accent);
}

.nav-icon {
  width: 22px;
  height: 22px;
}

.nav-label {
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 500;
}

/* Desktop: hide bottom nav */
@media (min-width: 768px) {
  .bottom-nav {
    display: none;
  }

  .main-content {
    padding-bottom: var(--space-5);
  }
}
</style>
