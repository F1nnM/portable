import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SessionList from "../src/components/SessionList.vue";
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

describe("sessionList component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders session cards with title and relative time", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessions: [
            {
              sessionId: "a",
              title: "Fix the login bug",
              lastModified: Date.now() - 3600000,
              firstPrompt: "Fix the login bug",
            },
          ],
        }),
    });

    const wrapper = mount(SessionList);
    await flushPromises();

    expect(wrapper.find("[data-testid='session-card']").exists()).toBe(true);
    expect(wrapper.text()).toContain("Fix the login bug");
  });

  it("emits select with sessionId when card is tapped", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessions: [
            { sessionId: "a", title: "Chat 1", lastModified: Date.now(), firstPrompt: "Hello" },
          ],
        }),
    });

    const wrapper = mount(SessionList);
    await flushPromises();

    await wrapper.find("[data-testid='session-card']").trigger("click");
    expect(wrapper.emitted("select")).toBeTruthy();
    expect(wrapper.emitted("select")![0]).toEqual(["a"]);
  });

  it("emits newSession when new conversation button is clicked", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessions: [] }),
    });

    const wrapper = mount(SessionList);
    await flushPromises();

    await wrapper.find("[data-testid='new-session-button']").trigger("click");
    expect(wrapper.emitted("newSession")).toBeTruthy();
  });

  it("shows empty state when no sessions exist", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessions: [] }),
    });

    const wrapper = mount(SessionList);
    await flushPromises();

    expect(wrapper.find("[data-testid='empty-state']").exists()).toBe(true);
  });
});
