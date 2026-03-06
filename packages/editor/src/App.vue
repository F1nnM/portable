<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const tabs = [
  { name: "Chat", route: "/chat", icon: "chat" },
  { name: "Files", route: "/files", icon: "files" },
  { name: "Git", route: "/git", icon: "git" },
  { name: "Preview", route: "/preview", icon: "preview" },
] as const;

const activeTab = computed(() => route.path);

function navigate(path: string) {
  router.push(path);
}
</script>

<template>
  <div class="shell">
    <main class="content">
      <router-view />
    </main>
    <nav class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.name"
        class="tab"
        :class="{ active: activeTab === tab.route }"
        data-testid="nav-tab"
        @click="navigate(tab.route)"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <!-- Chat icon -->
          <template v-if="tab.icon === 'chat'">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </template>
          <!-- Files icon -->
          <template v-if="tab.icon === 'files'">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </template>
          <!-- Git icon (branch) -->
          <template v-if="tab.icon === 'git'">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 9a9 9 0 0 1-9 9"
            />
          </template>
          <!-- Preview icon -->
          <template v-if="tab.icon === 'preview'">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </template>
        </svg>
        <span class="tab-label">{{ tab.name }}</span>
      </button>
    </nav>
  </div>
</template>

<style>
:root {
  --color-bg: #0d1117;
  --color-bg-elevated: #161b22;
  --color-bg-surface: #21262d;
  --color-text: #e6edf3;
  --color-text-muted: #7d8590;
  --color-accent: #58a6ff;
  --color-accent-active: #f0883e;
  --color-border: #30363d;
  --font-mono: "JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;
  --tab-bar-height: 56px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: var(--font-sans);
  background: var(--color-bg);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  height: 100dvh;
}
</style>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-bar {
  display: flex;
  align-items: stretch;
  height: var(--tab-bar-height);
  background: var(--color-bg-elevated);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: none;
  border: none;
  border-top: 2px solid transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: var(--font-mono);
  transition:
    color 0.15s,
    border-color 0.15s;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.tab:active {
  background: var(--color-bg-surface);
}

.tab.active {
  color: var(--color-accent);
  border-top-color: var(--color-accent);
}

.tab-icon {
  width: 20px;
  height: 20px;
}

.tab-label {
  font-size: 0.6875rem;
  letter-spacing: 0.02em;
}
</style>
