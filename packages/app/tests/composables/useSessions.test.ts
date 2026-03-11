import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock $fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

// eslint-disable-next-line ts/consistent-type-imports
type UseSessions = Awaited<typeof import("~/composables/useSessions")>["useSessions"];
let useSessions: UseSessions;

beforeEach(async () => {
  vi.useFakeTimers();
  mockFetch.mockReset();

  const mod = await import("~/composables/useSessions");
  useSessions = mod.useSessions;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useSessions", () => {
  it("fetches sessions from the pod proxy API", async () => {
    const sessionsData = [
      { sessionId: "s1", title: "First chat", lastModified: 1000, firstPrompt: "Hello" },
      { sessionId: "s2", title: "Second chat", lastModified: 2000, firstPrompt: "Hi" },
    ];
    mockFetch.mockResolvedValueOnce({ sessions: sessionsData });

    const { sessions, fetchSessions } = useSessions("my-project");
    await fetchSessions();

    expect(mockFetch).toHaveBeenCalledWith("/api/projects/my-project/pod/api/sessions");
    expect(sessions.value).toHaveLength(2);
    expect(sessions.value[0].sessionId).toBe("s1");
    expect(sessions.value[1].sessionId).toBe("s2");
  });

  it("loads messages for a session", async () => {
    const messagesData = [
      { role: "user", content: "Hello" },
      {
        role: "assistant",
        content: "Hi there!",
        thinking: [{ content: "Thinking..." }],
        toolUse: [{ name: "Read", input: '{"path":"/test"}' }],
      },
    ];
    mockFetch.mockResolvedValueOnce({ messages: messagesData });

    const { loadMessages } = useSessions("my-project");
    const messages = await loadMessages("session-123");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/my-project/pod/api/sessions/session-123/messages",
    );
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].thinking).toHaveLength(1);
    expect(messages[1].toolUse).toHaveLength(1);
  });

  it("deletes a session", async () => {
    mockFetch.mockResolvedValueOnce(undefined);

    const { deleteSession } = useSessions("my-project");
    await deleteSession("session-123");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/projects/my-project/pod/api/sessions/session-123",
      { method: "DELETE" },
    );
  });

  it("fetches active sessions", async () => {
    mockFetch.mockResolvedValueOnce({ activeSessionIds: ["s1", "s3"] });

    const { activeSessions, fetchActiveSessions } = useSessions("my-project");
    await fetchActiveSessions();

    expect(mockFetch).toHaveBeenCalledWith("/api/projects/my-project/pod/api/sessions/active");
    expect(activeSessions.value.has("s1")).toBe(true);
    expect(activeSessions.value.has("s3")).toBe(true);
    expect(activeSessions.value.size).toBe(2);
  });

  it("handles empty sessions list", async () => {
    mockFetch.mockResolvedValueOnce({ sessions: [] });

    const { sessions, fetchSessions } = useSessions("my-project");
    await fetchSessions();

    expect(sessions.value).toHaveLength(0);
  });

  it("handles empty active sessions", async () => {
    mockFetch.mockResolvedValueOnce({ activeSessionIds: [] });

    const { activeSessions, fetchActiveSessions } = useSessions("my-project");
    await fetchActiveSessions();

    expect(activeSessions.value.size).toBe(0);
  });

  it("handles fetch errors gracefully for sessions", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { sessions, fetchSessions } = useSessions("my-project");
    await fetchSessions();

    expect(sessions.value).toHaveLength(0);
  });

  it("handles fetch errors gracefully for active sessions", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { activeSessions, fetchActiveSessions } = useSessions("my-project");
    await fetchActiveSessions();

    expect(activeSessions.value.size).toBe(0);
  });

  it("polls active sessions every 5 seconds", async () => {
    mockFetch.mockResolvedValue({ activeSessionIds: [] });

    const { startPolling, stopPolling } = useSessions("my-project");
    startPolling();

    // Initial fetch
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // After 5 seconds, should fetch again
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // After another 5 seconds
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Stop polling
    stopPolling();
    await vi.advanceTimersByTimeAsync(10000);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("stops polling on stopPolling call", async () => {
    mockFetch.mockResolvedValue({ activeSessionIds: [] });

    const { startPolling, stopPolling } = useSessions("my-project");
    startPolling();

    expect(mockFetch).toHaveBeenCalledTimes(1);

    stopPolling();
    await vi.advanceTimersByTimeAsync(20000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
