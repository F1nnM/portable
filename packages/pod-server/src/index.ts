import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { createApp } from "./app.js";

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
