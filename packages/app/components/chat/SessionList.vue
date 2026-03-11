<script setup lang="ts">
import type { ChatSession } from "~/types/chat";

const props = defineProps<{
  sessions: ChatSession[];
  activeSessions: string[];
}>();

const emit = defineEmits<{
  select: [sessionId: string];
  newSession: [];
  delete: [sessionId: string];
}>();

const sortedSessions = computed(() =>
  [...props.sessions].sort((a, b) => b.lastModified - a.lastModified),
);

function isActive(sessionId: string): boolean {
  return props.activeSessions.includes(sessionId);
}

function formatRelativeTime(unixTimestamp: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, Math.floor(now - unixTimestamp));

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

function handleSelect(sessionId: string) {
  emit("select", sessionId);
}

function handleDelete(e: Event, sessionId: string) {
  e.stopPropagation();
  emit("delete", sessionId);
}
</script>

<template>
  <div class="session-list">
    <div class="session-header">
      <h2 class="session-header-title">Conversations</h2>
      <button class="btn-new-session" aria-label="New conversation" @click="emit('newSession')">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>

    <div v-if="sortedSessions.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <p class="empty-text">No conversations yet</p>
      <button class="btn-start-conversation" @click="emit('newSession')">
        Start a conversation
      </button>
    </div>

    <div v-else class="session-items">
      <div
        v-for="session in sortedSessions"
        :key="session.sessionId"
        class="session-item"
        @click="handleSelect(session.sessionId)"
      >
        <div class="session-info">
          <div class="session-title-row">
            <span v-if="isActive(session.sessionId)" class="session-active-dot" />
            <span class="session-title">{{ session.title }}</span>
          </div>
          <span v-if="session.firstPrompt" class="session-preview">{{ session.firstPrompt }}</span>
          <span class="session-time">{{ formatRelativeTime(session.lastModified) }}</span>
        </div>
        <button
          class="btn-delete-session"
          aria-label="Delete session"
          @click="(e) => handleDelete(e, session.sessionId)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path
              d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
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
  height: 100%;
  overflow: hidden;
}

.session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  flex-shrink: 0;
}

.session-header-title {
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.btn-new-session {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  border-radius: var(--radius-sm);
  color: var(--color-accent);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.btn-new-session:hover {
  background: var(--color-accent-tint);
}

.btn-new-session svg {
  width: 22px;
  height: 22px;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: var(--space-4);
  padding: var(--space-7);
}

.empty-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
  opacity: 0.4;
  background: var(--color-accent-tint);
  border-radius: var(--radius-full);
}

.empty-icon svg {
  width: 32px;
  height: 32px;
}

.empty-text {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  text-align: center;
}

.btn-start-conversation {
  padding: var(--space-2) var(--space-6);
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-full);
  min-height: var(--touch-min);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
  box-shadow: 0 2px 8px rgba(217, 122, 62, 0.25);
}

.btn-start-conversation:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(217, 122, 62, 0.3);
}

.btn-start-conversation:active {
  transform: translateY(0);
}

/* Session items */
.session-items {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 var(--space-2);
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3);
  min-height: 56px;
  cursor: pointer;
  transition: background var(--transition-fast);
  border-radius: var(--radius-sm);
  position: relative;
}

.session-item + .session-item::before {
  content: "";
  position: absolute;
  top: 0;
  left: var(--space-3);
  right: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.session-item:hover {
  background: var(--color-bg-inset);
}

.session-item:active {
  background: var(--color-bg-elevated);
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
  flex: 1;
}

.session-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.session-active-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  flex-shrink: 0;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.session-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-normal);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-preview {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: var(--line-height-tight);
}

.session-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.btn-delete-session {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    opacity var(--transition-fast);
}

.session-item:hover .btn-delete-session {
  opacity: 1;
}

/* Always show on touch devices since there's no hover */
@media (hover: none) {
  .btn-delete-session {
    opacity: 0.6;
  }
}

.btn-delete-session:hover {
  color: var(--color-danger);
  background: var(--color-danger-tint);
}

.btn-delete-session svg {
  width: 16px;
  height: 16px;
}
</style>
