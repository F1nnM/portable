import type { UpgradeWebSocket } from "hono/ws";
import type { WebSocket as NodeWebSocket } from "ws";

import { Hono } from "hono";
import { registerWsRoute as registerWs } from "./routes/ws.js";

export function createApp() {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({ status: "ok" }, 200);
  });

  app.get("/", (c) => {
    return c.text("Portable Pod Server");
  });

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
