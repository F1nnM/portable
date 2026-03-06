import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessions } from "../src/composables/useSessions";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("useSessions composable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchSessions populates sessions ref sorted by lastModified", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessions: [
            { sessionId: "a", title: "First", lastModified: 2000, firstPrompt: "Hello" },
            { sessionId: "b", title: "Second", lastModified: 1000, firstPrompt: "Hi" },
          ],
        }),
    });

    const { sessions, fetchSessions } = useSessions();
    await fetchSessions();

    expect(sessions.value).toHaveLength(2);
    expect(sessions.value[0].sessionId).toBe("a");
    expect(mockFetch).toHaveBeenCalledWith("/api/sessions");
  });

  it("loadMessages returns mapped ChatMessage array", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          messages: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi!", toolUse: [{ name: "bash", input: "{}" }] },
          ],
        }),
    });

    const { loadMessages } = useSessions();
    const messages = await loadMessages("sess1");

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].toolUse).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/sessions/sess1/messages");
  });

  it("deleteSession calls DELETE and removes from local list", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            sessions: [
              { sessionId: "a", title: "First", lastModified: 2000, firstPrompt: "Hello" },
            ],
          }),
      })
      .mockResolvedValueOnce({ ok: true, status: 204 });

    const { sessions, fetchSessions, deleteSession } = useSessions();
    await fetchSessions();
    expect(sessions.value).toHaveLength(1);

    await deleteSession("a");

    expect(sessions.value).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledWith("/api/sessions/a", { method: "DELETE" });
  });

  it("fetchSessions sets error on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal Server Error" }),
    });

    const { sessions, error, fetchSessions } = useSessions();
    await fetchSessions();

    expect(sessions.value).toHaveLength(0);
    expect(error.value).toBe("Failed to fetch sessions: 500");
  });

  it("loadMessages throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    });

    const { loadMessages } = useSessions();
    await expect(loadMessages("unknown")).rejects.toThrow("Failed to load messages: 404");
  });

  it("deleteSession throws on non-ok response and preserves local list", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            sessions: [
              { sessionId: "a", title: "First", lastModified: 2000, firstPrompt: "Hello" },
            ],
          }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const { sessions, fetchSessions, deleteSession } = useSessions();
    await fetchSessions();
    expect(sessions.value).toHaveLength(1);

    await expect(deleteSession("a")).rejects.toThrow("Failed to delete session: 500");
    expect(sessions.value).toHaveLength(1);
  });
});
