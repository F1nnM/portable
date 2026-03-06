import { getSessionMessages, listSessions } from "@anthropic-ai/claude-agent-sdk";
import { Hono } from "hono";

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || "/workspace";

export const sessions = new Hono();

sessions.get("/api/sessions", async (c) => {
  const raw = await listSessions({ dir: WORKSPACE_DIR });
  const sorted = raw.sort((a, b) => b.lastModified - a.lastModified);
  const mapped = sorted.map((s) => ({
    sessionId: s.sessionId,
    title: s.customTitle || s.summary || s.firstPrompt || "Untitled",
    lastModified: s.lastModified,
    firstPrompt: s.firstPrompt ?? null,
  }));
  return c.json({ sessions: mapped });
});

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  id?: string;
  input?: unknown;
}

interface MessageContent {
  role?: string;
  content?: ContentBlock[] | string;
}

sessions.get("/api/sessions/:id/messages", async (c) => {
  const sessionId = c.req.param("id");
  const raw = await getSessionMessages(sessionId, { dir: WORKSPACE_DIR });

  const messages = raw
    .filter((m) => m.type === "user" || m.type === "assistant")
    .map((m) => {
      const msg = m.message as MessageContent;
      const blocks = Array.isArray(msg.content) ? msg.content : [];

      const text = blocks
        .filter((b): b is ContentBlock & { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("");

      const toolUse = blocks
        .filter((b) => b.type === "tool_use")
        .map((b) => ({
          name: b.name!,
          input: JSON.stringify(b.input, null, 2),
        }));

      const result: Record<string, unknown> = {
        role: m.type,
        content: typeof msg.content === "string" ? msg.content : text,
      };

      if (toolUse.length > 0) {
        result.toolUse = toolUse;
      }

      return result;
    });

  return c.json({ messages });
});
