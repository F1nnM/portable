import type { UpgradeWebSocket } from "hono/ws";
import type { WebSocket as NodeWebSocket } from "ws";

import type { DevServerSupervisor } from "./dev-server.js";
import { Hono } from "hono";
import { activeSessions } from "./routes/active-sessions.js";
import { files } from "./routes/files.js";
import { git } from "./routes/git.js";
import { health } from "./routes/health.js";
import { rebuild } from "./routes/rebuild.js";
import { sessions } from "./routes/sessions.js";
import { registerWsRoute as registerWs } from "./routes/ws.js";

export interface AppConfig {
  supervisor?: DevServerSupervisor;
  workspaceDir?: string;
}

export function createApp(config?: AppConfig) {
  const app = new Hono();

  // API routes (active-sessions before sessions to avoid :id param matching "active")
  app.route("/", health);
  app.route("/", files);
  app.route("/", git);
  app.route("/", activeSessions);
  app.route("/", sessions);

  if (config?.supervisor && config?.workspaceDir) {
    app.route("/", rebuild({ supervisor: config.supervisor, workspaceDir: config.workspaceDir }));
  }

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
