import type { ChatMessage } from "./useWebSocket";

export interface Session {
  sessionId: string;
  title: string;
  lastModified: number;
  firstPrompt: string | null;
}

const POLL_INTERVAL_MS = 5000;

export function useSessions(slug: string) {
  const sessions = ref<Session[]>([]);
  const activeSessions = ref<Set<string>>(new Set());
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function fetchSessions(): Promise<void> {
    try {
      const data = await $fetch<{ sessions: Session[] }>(`/api/projects/${slug}/pod/api/sessions`);
      sessions.value = data.sessions;
    } catch {
      // Leave sessions unchanged on error
    }
  }

  async function loadMessages(sessionId: string): Promise<ChatMessage[]> {
    const data = await $fetch<{ messages: ChatMessage[] }>(
      `/api/projects/${slug}/pod/api/sessions/${sessionId}/messages`,
    );
    return data.messages;
  }

  async function deleteSession(sessionId: string): Promise<void> {
    await $fetch(`/api/projects/${slug}/pod/api/sessions/${sessionId}`, {
      method: "DELETE",
    });
  }

  async function fetchActiveSessions(): Promise<void> {
    try {
      const data = await $fetch<{ activeSessionIds: string[] }>(
        `/api/projects/${slug}/pod/api/sessions/active`,
      );
      activeSessions.value = new Set(data.activeSessionIds);
    } catch {
      // Leave active sessions unchanged on error
    }
  }

  function startPolling(): void {
    // Fetch immediately
    fetchActiveSessions();

    // Then poll at interval
    pollTimer = setInterval(() => {
      fetchActiveSessions();
    }, POLL_INTERVAL_MS);
  }

  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  return {
    sessions,
    activeSessions,
    fetchSessions,
    loadMessages,
    deleteSession,
    fetchActiveSessions,
    startPolling,
    stopPolling,
  };
}
