<script setup lang="ts">
import type { ChatSession } from "~/types/chat";
import SessionList from "./SessionList.vue";

const now = Date.now() / 1000;

const sessions: ChatSession[] = [
  {
    sessionId: "sess-1",
    title: "Setting up database with Drizzle ORM",
    lastModified: now - 120,
    firstPrompt: "Help me set up a database connection",
  },
  {
    sessionId: "sess-2",
    title: "Fix authentication bug in login flow",
    lastModified: now - 3600,
    firstPrompt: "There's a bug in the login flow",
  },
  {
    sessionId: "sess-3",
    title: "Add WebSocket support for real-time updates",
    lastModified: now - 86400,
    firstPrompt: "I need to add real-time updates",
  },
  {
    sessionId: "sess-4",
    title: "Refactor component architecture for better code splitting",
    lastModified: now - 604800,
    firstPrompt: "Let's refactor the components",
  },
];

const activeSessions = ["sess-1"];

function logAction(action: string, ...args: unknown[]) {
  console.log(`[SessionList] ${action}`, ...args);
}
</script>

<template>
  <Story title="Chat / SessionList" group="chat">
    <Variant title="With Sessions">
      <div style="width: 320px; height: 500px; border: 1px solid var(--color-border)">
        <SessionList
          :sessions="sessions"
          :active-sessions="activeSessions"
          @select="(id) => logAction('select', id)"
          @new-session="logAction('newSession')"
          @delete="(id) => logAction('delete', id)"
        />
      </div>
    </Variant>

    <Variant title="Empty State">
      <div style="width: 320px; height: 500px; border: 1px solid var(--color-border)">
        <SessionList
          :sessions="[]"
          :active-sessions="[]"
          @select="(id) => logAction('select', id)"
          @new-session="logAction('newSession')"
          @delete="(id) => logAction('delete', id)"
        />
      </div>
    </Variant>

    <Variant title="All Active">
      <div style="width: 320px; height: 500px; border: 1px solid var(--color-border)">
        <SessionList
          :sessions="sessions.slice(0, 2)"
          :active-sessions="['sess-1', 'sess-2']"
          @select="(id) => logAction('select', id)"
          @new-session="logAction('newSession')"
          @delete="(id) => logAction('delete', id)"
        />
      </div>
    </Variant>
  </Story>
</template>
