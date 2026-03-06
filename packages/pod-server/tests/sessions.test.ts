import { readdir, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { getSessionMessages, listSessions } from "@anthropic-ai/claude-agent-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
  listSessions: vi.fn(),
  getSessionMessages: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/home/testuser"),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  // eslint-disable-next-line ts/consistent-type-imports -- vitest importOriginal requires typeof import()
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...original,
    readdir: vi.fn(),
    unlink: vi.fn(),
  };
});

const mockListSessions = vi.mocked(listSessions);
const mockGetSessionMessages = vi.mocked(getSessionMessages);
const mockReaddir = vi.mocked(readdir);
const mockUnlink = vi.mocked(unlink);
const mockHomedir = vi.mocked(homedir);

describe("sessions API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHomedir.mockReturnValue("/home/testuser");
  });

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

  describe("dELETE /api/sessions/:id", () => {
    const validSessionId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

    it("removes session file and returns 204", async () => {
      // Mock readdir to return project directories and session files
      mockReaddir.mockImplementation(((path: string) => {
        if (path === "/home/testuser/.claude/projects") {
          return Promise.resolve([{ name: "-workspace", isDirectory: () => true }]);
        }
        if (path === "/home/testuser/.claude/projects/-workspace") {
          return Promise.resolve([`${validSessionId}.jsonl`]);
        }
        return Promise.resolve([]);
      }) as typeof readdir);

      mockUnlink.mockResolvedValue(undefined);

      const { app } = createApp();
      const res = await app.request(`/api/sessions/${validSessionId}`, { method: "DELETE" });
      expect(res.status).toBe(204);
      expect(mockUnlink).toHaveBeenCalledWith(
        `/home/testuser/.claude/projects/-workspace/${validSessionId}.jsonl`,
      );
    });

    it("returns 404 for unknown session", async () => {
      // Mock readdir to return project directories but no matching session file
      mockReaddir.mockImplementation(((path: string) => {
        if (path === "/home/testuser/.claude/projects") {
          return Promise.resolve([{ name: "-workspace", isDirectory: () => true }]);
        }
        if (path === "/home/testuser/.claude/projects/-workspace") {
          return Promise.resolve(["other-session.jsonl"]);
        }
        return Promise.resolve([]);
      }) as typeof readdir);

      const { app } = createApp();
      const res = await app.request(`/api/sessions/${validSessionId}`, { method: "DELETE" });
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe("Session not found");
    });

    it("returns 404 when .claude/projects directory does not exist", async () => {
      mockReaddir.mockImplementation((() => {
        return Promise.reject(new Error("ENOENT"));
      }) as typeof readdir);

      const { app } = createApp();
      const res = await app.request(`/api/sessions/${validSessionId}`, { method: "DELETE" });
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid session ID format", async () => {
      const { app } = createApp();
      const res = await app.request("/api/sessions/not-a-valid-uuid", { method: "DELETE" });
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("Invalid session ID");
    });
  });
});
