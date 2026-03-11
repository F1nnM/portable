import type { UpgradeWebSocket } from "hono/ws";
import type { WebSocket as NodeWebSocket } from "ws";

import { Hono } from "hono";
import { activeSessions } from "./routes/active-sessions.js";
import { files } from "./routes/files.js";
import { git } from "./routes/git.js";
import { health } from "./routes/health.js";
import { sessions } from "./routes/sessions.js";
import { registerWsRoute as registerWs } from "./routes/ws.js";

export function createApp() {
  const app = new Hono();

  // API routes (active-sessions before sessions to avoid :id param matching "active")
  app.route("/", health);
  app.route("/", files);
  app.route("/", git);
  app.route("/", activeSessions);
  app.route("/", sessions);

  function registerWsRoute(
    upgradeWebSocket: UpgradeWebSocket<NodeWebSocket, { onError: (err: unknown) => void }>,
  ) {
    registerWs(app, upgradeWebSocket);
  }

  return { app, registerWsRoute };
}

// Convenience export: a pre-built app instance for tests and simple usage
const { app } = createApp();
export { app };
