import type { Hono } from "hono";
import type { UpgradeWebSocket, WSContext } from "hono/ws";
import type { WebSocket as NodeWebSocket } from "ws";

import {
  type BackgroundSession,
  attachClient,
  createSession,
  detachClient,
  getSessionBySdkId,
  interruptQuery,
  sendMessage,
} from "../session-manager.js";

function sendJson(ws: WSContext<NodeWebSocket>, data: Record<string, unknown>) {
  try {
    ws.send(JSON.stringify(data));
  } catch {
    // Connection may have closed
  }
}

export function registerWsRoute(
  app: Hono,
  upgradeWebSocket: UpgradeWebSocket<NodeWebSocket, { onError: (err: unknown) => void }>,
) {
  app.get(
    "/ws",
    upgradeWebSocket((c) => {
      const sessionParam = new URL(c.req.url).searchParams.get("session");
      let session: BackgroundSession | undefined;

      return {
        onOpen(_evt, ws) {
          // Check if we should reconnect to an existing background session
          if (sessionParam) {
            session = getSessionBySdkId(sessionParam);
          }

          if (!session) {
            // Create a new background session, passing the SDK session ID for resume
            session = createSession(sessionParam || undefined);
          }

          // Attach this client to the session (handles replay of buffered events)
          attachClient(session, ws);
        },

        onMessage(evt, ws) {
          if (!session) return;

          let parsed: { type: string; content?: string };
          try {
            parsed = JSON.parse(typeof evt.data === "string" ? evt.data : String(evt.data));
          } catch {
            sendJson(ws, { type: "error", message: "Invalid JSON" });
            return;
          }

          if (parsed.type === "interrupt") {
            interruptQuery(session);
            return;
          }

          if (parsed.type === "user_message" && typeof parsed.content === "string") {
            sendMessage(session, parsed.content);
            return;
          }

          sendJson(ws, { type: "error", message: `Unknown message type: ${parsed.type}` });
        },

        onClose(_evt, ws) {
          if (session) {
            detachClient(session, ws);
          }
        },

        onError(_evt, ws) {
          if (session) {
            detachClient(session, ws);
          }
        },
      };
    }),
  );
}
