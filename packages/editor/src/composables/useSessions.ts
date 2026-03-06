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
  const error = ref<string | null>(null);

  async function fetchSessions() {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) {
        throw new Error(`Failed to fetch sessions: ${res.status}`);
      }
      const body = await res.json();
      sessions.value = body.sessions;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error";
    } finally {
      loading.value = false;
    }
  }

  async function loadMessages(sessionId: string): Promise<ChatMessage[]> {
    const res = await fetch(`/api/sessions/${sessionId}/messages`);
    if (!res.ok) {
      throw new Error(`Failed to load messages: ${res.status}`);
    }
    const body = await res.json();
    return body.messages;
  }

  async function deleteSession(sessionId: string) {
    const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    if (!res.ok) {
      throw new Error(`Failed to delete session: ${res.status}`);
    }
    sessions.value = sessions.value.filter((s) => s.sessionId !== sessionId);
  }

  return { sessions, loading, error, fetchSessions, loadMessages, deleteSession };
}
