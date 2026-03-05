import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { createApp } from "./app.js";
import { DevServerSupervisor } from "./dev-server.js";

const { app, registerWsRoute } = createApp();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
registerWsRoute(upgradeWebSocket);

const port = Number.parseInt(process.env.PORT || "3000", 10);

const server = serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Pod server listening on port ${info.port}`);
  },
);

injectWebSocket(server);

// Start the dev server supervisor
const supervisor = new DevServerSupervisor({
  command: process.env.DEV_SERVER_COMMAND || "pnpm dev",
  cwd: process.env.WORKSPACE_DIR || "/workspace",
  port: 3001,
});
supervisor.start();

// Graceful shutdown
process.on("SIGTERM", () => {
  supervisor.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  supervisor.stop();
  process.exit(0);
});
