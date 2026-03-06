<script setup lang="ts">
import { onMounted } from "vue";
import { useSessions } from "../composables/useSessions";

const emit = defineEmits<{
  select: [sessionId: string];
  newSession: [];
}>();

const { sessions, loading, fetchSessions, deleteSession } = useSessions();

onMounted(() => {
  fetchSessions();
});

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function handleDelete(sessionId: string) {
  await deleteSession(sessionId);
}
</script>

<template>
  <div class="session-list">
    <div class="session-header">
      <h2 class="session-title">Conversations</h2>
      <button class="new-button" data-testid="new-session-button" @click="emit('newSession')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="new-icon">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <span class="loading-text">Loading...</span>
    </div>

    <div v-else-if="sessions.length === 0" class="empty-state" data-testid="empty-state">
      <span class="empty-label">No conversations yet</span>
      <button class="start-button" data-testid="new-session-button" @click="emit('newSession')">
        Start a conversation
      </button>
    </div>

    <div v-else class="session-cards">
      <div
        v-for="session in sessions"
        :key="session.sessionId"
        class="session-card"
        data-testid="session-card"
        @click="emit('select', session.sessionId)"
      >
        <div class="card-content">
          <span class="card-title">{{ session.title }}</span>
          <span class="card-time">{{ formatRelativeTime(session.lastModified) }}</span>
        </div>
        <button
          class="delete-button"
          data-testid="delete-session-button"
          @click.stop="handleDelete(session.sessionId)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="delete-icon">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 12px 8px;
  flex-shrink: 0;
}

.session-title {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.new-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-surface);
  color: var(--color-accent);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.new-icon {
  width: 18px;
  height: 18px;
}

.session-cards {
  flex: 1;
  overflow-y: auto;
  padding: 4px 12px 12px;
  -webkit-overflow-scrolling: touch;
}

.session-card {
  display: flex;
  align-items: center;
  padding: 14px 12px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.session-card:active {
  background: var(--color-bg-surface);
}

.card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-title {
  font-size: 0.875rem;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-time {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.delete-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.delete-button:active {
  background: var(--color-bg-surface);
  color: #f85149;
}

.delete-icon {
  width: 16px;
  height: 16px;
}

.loading-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.loading-text,
.empty-label {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.start-button {
  padding: 10px 20px;
  border: 1px solid var(--color-accent);
  border-radius: 8px;
  background: none;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.start-button:active {
  background: var(--color-bg-surface);
}
</style>
