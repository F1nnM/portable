import { readdir, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { getSessionMessages, listSessions } from "@anthropic-ai/claude-agent-sdk";
import { Hono } from "hono";

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || "/workspace";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findSessionFile(sessionId: string): Promise<string | null> {
  const claudeProjectsDir = join(
    process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"),
    "projects",
  );

  let projectDirs: { name: string; isDirectory: () => boolean }[];
  try {
    projectDirs = (await readdir(claudeProjectsDir, { withFileTypes: true })) as {
      name: string;
      isDirectory: () => boolean;
    }[];
  } catch {
    return null;
  }

  const targetFile = `${sessionId}.jsonl`;

  for (const entry of projectDirs) {
    if (!entry.isDirectory()) continue;
    const projectPath = join(claudeProjectsDir, entry.name);
    let files: string[];
    try {
      files = (await readdir(projectPath)) as string[];
    } catch {
      continue;
    }
    if (files.includes(targetFile)) {
      return join(projectPath, targetFile);
    }
  }

  return null;
}

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

sessions.delete("/api/sessions/:id", async (c) => {
  const sessionId = c.req.param("id");

  if (!UUID_REGEX.test(sessionId)) {
    return c.json({ error: "Invalid session ID" }, 400);
  }

  const filePath = await findSessionFile(sessionId);
  if (!filePath) {
    return c.json({ error: "Session not found" }, 404);
  }

  await unlink(filePath);
  return new Response(null, { status: 204 });
});
