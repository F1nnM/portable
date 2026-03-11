import type { Options, Query } from "@anthropic-ai/claude-agent-sdk";
import type { WSContext } from "hono/ws";
import type { WebSocket as NodeWebSocket } from "ws";

import { query } from "@anthropic-ai/claude-agent-sdk";

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || "/workspace";
const CLEANUP_TIMEOUT_MS = 30_000;

export interface OutboundMessage {
  type: string;
  [key: string]: unknown;
}

export interface BackgroundSession {
  id: string;
  sdkSessionId: string | null;
  activeQuery: Query | null;
  isRunning: boolean;
  isFirstQuery: boolean;
  pendingPrompt: string | null;
  currentQueryEvents: OutboundMessage[];
  clients: Set<WSContext<NodeWebSocket>>;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

// Module-level state
const sessionsById = new Map<string, BackgroundSession>();
const sessionsBySdkId = new Map<string, BackgroundSession>();

function sendJson(ws: WSContext<NodeWebSocket>, data: OutboundMessage) {
  try {
    ws.send(JSON.stringify(data));
  } catch {
    // Connection may have closed
  }
}

function broadcastToClients(session: BackgroundSession, data: OutboundMessage) {
  for (const client of session.clients) {
    sendJson(client, data);
  }
}

function bufferAndBroadcast(session: BackgroundSession, data: OutboundMessage) {
  session.currentQueryEvents.push(data);
  broadcastToClients(session, data);
}

function startCleanupTimer(session: BackgroundSession) {
  if (session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
  }
  session.cleanupTimer = setTimeout(() => {
    sessionsById.delete(session.id);
    if (session.sdkSessionId) {
      sessionsBySdkId.delete(session.sdkSessionId);
    }
    session.cleanupTimer = null;
  }, CLEANUP_TIMEOUT_MS);
}

async function runQuery(session: BackgroundSession, prompt: string): Promise<void> {
  const options: Options = {
    cwd: WORKSPACE_DIR,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    systemPrompt: { type: "preset", preset: "claude_code" },
    settingSources: ["project"],
  };

  if (session.isFirstQuery && session.sdkSessionId) {
    options.resume = session.sdkSessionId;
  } else if (!session.isFirstQuery) {
    options.continue = true;
  }

  const activeQuery = query({ prompt, options });
  session.activeQuery = activeQuery;
  session.isRunning = true;

  // Clear event buffer for new query
  session.currentQueryEvents = [];
  bufferAndBroadcast(session, { type: "query_start" });

  let sessionIdCaptured = false;

  try {
    for await (const message of activeQuery) {
      if (
        !sessionIdCaptured &&
        typeof message === "object" &&
        message !== null &&
        "session_id" in message &&
        (message as Record<string, unknown>).session_id
      ) {
        const sdkId = (message as Record<string, unknown>).session_id as string;
        session.sdkSessionId = sdkId;
        sessionsBySdkId.set(sdkId, session);
        sessionIdCaptured = true;
      }
      bufferAndBroadcast(session, { type: "sdk_event", event: message });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    bufferAndBroadcast(session, { type: "error", message: errorMessage });
  } finally {
    if (session.isFirstQuery && session.sdkSessionId) {
      bufferAndBroadcast(session, { type: "session_info", sessionId: session.sdkSessionId });
    }
    session.isFirstQuery = false;
    session.activeQuery = null;
    session.isRunning = false;
    bufferAndBroadcast(session, { type: "query_end" });

    // Start cleanup timer if no clients are connected
    if (session.clients.size === 0) {
      startCleanupTimer(session);
    }
  }

  // If a new message arrived while this query was active, start the next query
  if (session.pendingPrompt !== null) {
    const nextPrompt = session.pendingPrompt;
    session.pendingPrompt = null;
    await runQuery(session, nextPrompt);
  }
}

export function createSession(sdkSessionId?: string): BackgroundSession {
  const session: BackgroundSession = {
    id: crypto.randomUUID(),
    sdkSessionId: sdkSessionId ?? null,
    activeQuery: null,
    isRunning: false,
    isFirstQuery: true,
    pendingPrompt: null,
    currentQueryEvents: [],
    clients: new Set(),
    cleanupTimer: null,
  };

  sessionsById.set(session.id, session);
  if (sdkSessionId) {
    sessionsBySdkId.set(sdkSessionId, session);
  }

  return session;
}

export function getSession(id: string): BackgroundSession | undefined {
  return sessionsById.get(id);
}

export function getSessionBySdkId(sdkSessionId: string): BackgroundSession | undefined {
  return sessionsBySdkId.get(sdkSessionId);
}

export function getActiveSdkSessionIds(): string[] {
  const result: string[] = [];
  for (const session of sessionsById.values()) {
    if (session.isRunning && session.sdkSessionId) {
      result.push(session.sdkSessionId);
    }
  }
  return result;
}

export function attachClient(session: BackgroundSession, ws: WSContext<NodeWebSocket>) {
  // Cancel cleanup timer if one is running
  if (session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
    session.cleanupTimer = null;
  }

  session.clients.add(ws);

  // Replay buffered events only if a query is currently running
  // (completed query results are already available via the REST API)
  if (session.isRunning && session.currentQueryEvents.length > 0) {
    sendJson(ws, { type: "replay_start" });
    for (const event of session.currentQueryEvents) {
      sendJson(ws, event);
    }
    sendJson(ws, { type: "replay_end" });
  }
}

export function detachClient(session: BackgroundSession, ws: WSContext<NodeWebSocket>) {
  session.clients.delete(ws);
  // Do NOT kill the query -- it continues running in the background
}

export function sendMessage(session: BackgroundSession, prompt: string) {
  if (session.isRunning && session.activeQuery) {
    // Interrupt the current query and queue the new prompt
    session.pendingPrompt = prompt;
    session.activeQuery.interrupt();
  } else {
    // Fire and forget with error handling
    runQuery(session, prompt).catch((err) => {
      console.error("[session-manager] Unexpected error in runQuery:", err);
    });
  }
}

export function interruptQuery(session: BackgroundSession) {
  if (session.activeQuery) {
    session.activeQuery.interrupt();
  }
}

/** Reset all sessions -- used for testing only */
export function resetAllSessions() {
  for (const session of sessionsById.values()) {
    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
    }
    if (session.activeQuery) {
      session.activeQuery.close();
    }
  }
  sessionsById.clear();
  sessionsBySdkId.clear();
}
