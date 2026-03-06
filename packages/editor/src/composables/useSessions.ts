import type { ChatMessage } from "./useWebSocket";
import { ref } from "vue";

export interface SessionSummary {
  sessionId: string;
  title: string;
  lastModified: number;
  firstPrompt: string | null;
}

export function useSessions() {
  const sessions = ref<SessionSummary[]>([]);
  const loading = ref(false);

  async function fetchSessions() {
    loading.value = true;
    try {
      const res = await fetch("/api/sessions");
      const body = await res.json();
      sessions.value = body.sessions;
    } finally {
      loading.value = false;
    }
  }

  async function loadMessages(sessionId: string): Promise<ChatMessage[]> {
    const res = await fetch(`/api/sessions/${sessionId}/messages`);
    const body = await res.json();
    return body.messages;
  }

  async function deleteSession(sessionId: string) {
    await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    sessions.value = sessions.value.filter((s) => s.sessionId !== sessionId);
  }

  return { sessions, loading, fetchSessions, loadMessages, deleteSession };
}
