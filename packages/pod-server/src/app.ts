import type { UpgradeWebSocket } from "hono/ws";
import type { WebSocket as NodeWebSocket } from "ws";
import { serveStatic } from "@hono/node-server/serve-static";

import { Hono } from "hono";
import { files } from "./routes/files.js";
import { health } from "./routes/health.js";
import { sessions } from "./routes/sessions.js";
import { registerWsRoute as registerWs } from "./routes/ws.js";

export function createApp() {
  const app = new Hono();

  // API routes
  app.route("/", health);
  app.route("/", files);
  app.route("/", sessions);

  function registerWsRoute(
    upgradeWebSocket: UpgradeWebSocket<NodeWebSocket, { onError: (err: unknown) => void }>,
  ) {
    registerWs(app, upgradeWebSocket);
  }

  function registerStaticFiles() {
    // Serve the editor SPA from ./public
    app.use("/*", serveStatic({ root: "./public" }));

    // SPA fallback: serve index.html for all non-API, non-file routes
    app.use("/*", serveStatic({ root: "./public", path: "index.html" }));
  }

  return { app, registerWsRoute, registerStaticFiles };
}

// Convenience export: a pre-built app instance for tests and simple usage
const { app } = createApp();
export { app };
