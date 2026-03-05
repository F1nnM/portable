import type { Query } from "@anthropic-ai/claude-agent-sdk";
import type { Hono } from "hono";
import type { UpgradeWebSocket, WSContext } from "hono/ws";
import type { WebSocket as NodeWebSocket } from "ws";

import { query } from "@anthropic-ai/claude-agent-sdk";

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || "/workspace";

function sendJson(ws: WSContext<NodeWebSocket>, data: Record<string, unknown>) {
  try {
    ws.send(JSON.stringify(data));
  } catch {
    // Connection may have closed
  }
}

interface ConnectionState {
  activeQuery: Query | null;
  pendingPrompt: string | null;
  closed: boolean;
}

async function runQuery(
  ws: WSContext<NodeWebSocket>,
  prompt: string,
  state: ConnectionState,
): Promise<void> {
  const activeQuery = query({
    prompt,
    options: {
      cwd: WORKSPACE_DIR,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      systemPrompt: { type: "preset", preset: "claude_code" },
      settingSources: ["project"],
    },
  });

  state.activeQuery = activeQuery;
  sendJson(ws, { type: "query_start" });

  try {
    for await (const message of activeQuery) {
      sendJson(ws, { type: "sdk_event", event: message });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendJson(ws, { type: "error", message: errorMessage });
  } finally {
    state.activeQuery = null;
    sendJson(ws, { type: "query_end" });
  }

  // If a new message arrived while this query was active, start the next query
  if (state.pendingPrompt !== null && !state.closed) {
    const nextPrompt = state.pendingPrompt;
    state.pendingPrompt = null;
    await runQuery(ws, nextPrompt, state);
  }
}

export function registerWsRoute(
  app: Hono,
  upgradeWebSocket: UpgradeWebSocket<NodeWebSocket, { onError: (err: unknown) => void }>,
) {
  app.get(
    "/ws",
    upgradeWebSocket((_c) => {
      const state: ConnectionState = {
        activeQuery: null,
        pendingPrompt: null,
        closed: false,
      };

      return {
        onOpen(_evt, _ws) {
          // Connection established
        },

        onMessage(evt, ws) {
          let parsed: { type: string; content?: string };
          try {
            parsed = JSON.parse(typeof evt.data === "string" ? evt.data : String(evt.data));
          } catch {
            sendJson(ws, { type: "error", message: "Invalid JSON" });
            return;
          }

          if (parsed.type === "interrupt") {
            if (state.activeQuery) {
              state.activeQuery.interrupt();
            }
            return;
          }

          if (parsed.type === "user_message" && typeof parsed.content === "string") {
            if (state.activeQuery) {
              // Interrupt the current query; the pending prompt will be picked up
              // by runQuery's finally block after the loop exits
              state.pendingPrompt = parsed.content;
              state.activeQuery.interrupt();
            } else {
              runQuery(ws, parsed.content, state);
            }
            return;
          }

          sendJson(ws, { type: "error", message: `Unknown message type: ${parsed.type}` });
        },

        onClose(_evt, _ws) {
          state.closed = true;
          if (state.activeQuery) {
            state.activeQuery.close();
            state.activeQuery = null;
          }
        },

        onError(_evt, _ws) {
          state.closed = true;
          if (state.activeQuery) {
            state.activeQuery.close();
            state.activeQuery = null;
          }
        },
      };
    }),
  );
}
