import type { UpgradeWebSocket } from "hono/ws";
import type { WebSocket as NodeWebSocket } from "ws";
import { serveStatic } from "@hono/node-server/serve-static";

import { Hono } from "hono";
import { files } from "./routes/files.js";
import { health } from "./routes/health.js";
import { registerWsRoute as registerWs } from "./routes/ws.js";

export function createApp() {
  const app = new Hono();

  // API routes
  app.route("/", health);
  app.route("/", files);

  // Serve the editor SPA from ./public
  app.use("/*", serveStatic({ root: "./public" }));

  // SPA fallback: serve index.html for all non-API, non-file routes
  app.use("/*", serveStatic({ root: "./public", path: "index.html" }));

  function registerWsRoute(
    upgradeWebSocket: UpgradeWebSocket<NodeWebSocket, { onError: (err: unknown) => void }>,
  ) {
    registerWs(app, upgradeWebSocket);
  }

  return { app, registerWsRoute };
}

// Default export for backwards compatibility with smoke tests
const { app } = createApp();
export { app };
