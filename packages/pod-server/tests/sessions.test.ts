import { getSessionMessages, listSessions } from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
  listSessions: vi.fn(),
  getSessionMessages: vi.fn(),
}));

const mockListSessions = vi.mocked(listSessions);
const mockGetSessionMessages = vi.mocked(getSessionMessages);

describe("sessions API", () => {
  it("returns session list sorted by lastModified desc", async () => {
    mockListSessions.mockResolvedValue([
      {
        sessionId: "aaa",
        summary: "First conversation",
        lastModified: 1000,
        fileSize: 100,
        firstPrompt: "Hello",
      },
      {
        sessionId: "bbb",
        summary: "Second conversation",
        lastModified: 2000,
        fileSize: 200,
        firstPrompt: "Help me",
      },
    ]);

    const { app } = createApp();
    const res = await app.request("/api/sessions");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sessions).toHaveLength(2);
    // Sorted by lastModified desc — bbb first
    expect(body.sessions[0].sessionId).toBe("bbb");
    expect(body.sessions[1].sessionId).toBe("aaa");
    expect(body.sessions[0]).toEqual({
      sessionId: "bbb",
      title: "Second conversation",
      lastModified: 2000,
      firstPrompt: "Help me",
    });
  });

  it("returns empty array when no sessions", async () => {
    mockListSessions.mockResolvedValue([]);

    const { app } = createApp();
    const res = await app.request("/api/sessions");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sessions).toEqual([]);
  });

  it("returns mapped messages for a session", async () => {
    mockGetSessionMessages.mockResolvedValue([
      {
        type: "user",
        uuid: "u1",
        session_id: "sess1",
        message: { role: "user", content: [{ type: "text", text: "Hello" }] },
        parent_tool_use_id: null,
      },
      {
        type: "assistant",
        uuid: "a1",
        session_id: "sess1",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Hi there!" },
            { type: "tool_use", id: "t1", name: "bash", input: { command: "ls" } },
          ],
        },
        parent_tool_use_id: null,
      },
    ]);

    const { app } = createApp();
    const res = await app.request("/api/sessions/sess1/messages");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toEqual({
      role: "user",
      content: "Hello",
    });
    expect(body.messages[1]).toEqual({
      role: "assistant",
      content: "Hi there!",
      toolUse: [{ name: "bash", input: '{\n  "command": "ls"\n}' }],
    });
  });

  it("returns empty array for unknown session", async () => {
    mockGetSessionMessages.mockResolvedValue([]);

    const { app } = createApp();
    const res = await app.request("/api/sessions/unknown/messages");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.messages).toEqual([]);
  });
});
