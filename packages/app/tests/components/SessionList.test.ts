import type { ChatSession } from "../../types/chat";
import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";
import SessionList from "../../components/chat/SessionList.vue";

function makeSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    sessionId: "sess-1",
    title: "Test Session",
    lastModified: Date.now() / 1000 - 120, // 2 minutes ago
    firstPrompt: "Hello Claude",
    ...overrides,
  };
}

describe("sessionList", () => {
  it("renders sessions sorted by most recent first", async () => {
    const now = Date.now() / 1000;
    const sessions: ChatSession[] = [
      makeSession({ sessionId: "old", title: "Old Session", lastModified: now - 3600 }),
      makeSession({ sessionId: "new", title: "New Session", lastModified: now - 60 }),
    ];
    const wrapper = await mountSuspended(SessionList, {
      props: { sessions, activeSessions: [] },
    });
    const items = wrapper.findAll(".session-item");
    expect(items.length).toBe(2);
    // Most recent first
    expect(items[0].text()).toContain("New Session");
    expect(items[1].text()).toContain("Old Session");
  });

  it("emits select event when a session is clicked", async () => {
    const sessions = [makeSession({ sessionId: "abc-123", title: "Click me" })];
    const wrapper = await mountSuspended(SessionList, {
      props: { sessions, activeSessions: [] },
    });
    await wrapper.find(".session-item").trigger("click");
    expect(wrapper.emitted("select")).toBeTruthy();
    expect(wrapper.emitted("select")![0]).toEqual(["abc-123"]);
  });

  it("emits newSession event when new conversation button is clicked", async () => {
    const wrapper = await mountSuspended(SessionList, {
      props: { sessions: [], activeSessions: [] },
    });
    await wrapper.find(".btn-new-session").trigger("click");
    expect(wrapper.emitted("newSession")).toBeTruthy();
  });

  it("emits delete event when delete button is clicked", async () => {
    const sessions = [makeSession({ sessionId: "del-1" })];
    const wrapper = await mountSuspended(SessionList, {
      props: { sessions, activeSessions: [] },
    });
    await wrapper.find(".btn-delete-session").trigger("click");
    expect(wrapper.emitted("delete")).toBeTruthy();
    expect(wrapper.emitted("delete")![0]).toEqual(["del-1"]);
  });

  it("shows pulsing dot for active sessions", async () => {
    const sessions = [makeSession({ sessionId: "active-1" })];
    const wrapper = await mountSuspended(SessionList, {
      props: { sessions, activeSessions: ["active-1"] },
    });
    expect(wrapper.find(".session-active-dot").exists()).toBe(true);
  });

  it("does not show pulsing dot for inactive sessions", async () => {
    const sessions = [makeSession({ sessionId: "inactive-1" })];
    const wrapper = await mountSuspended(SessionList, {
      props: { sessions, activeSessions: [] },
    });
    expect(wrapper.find(".session-active-dot").exists()).toBe(false);
  });

  it("shows empty state when no sessions exist", async () => {
    const wrapper = await mountSuspended(SessionList, {
      props: { sessions: [], activeSessions: [] },
    });
    expect(wrapper.find(".empty-state").exists()).toBe(true);
    expect(wrapper.text()).toContain("No conversations yet");
  });

  it("shows relative time for sessions", async () => {
    const now = Date.now() / 1000;
    const sessions = [makeSession({ lastModified: now - 120 })]; // 2 min ago
    const wrapper = await mountSuspended(SessionList, {
      props: { sessions, activeSessions: [] },
    });
    expect(wrapper.text()).toContain("2m ago");
  });
});
