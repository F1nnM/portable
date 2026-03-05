import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { app } from "./app.js";

const { injectWebSocket, upgradeWebSocket: _upgradeWebSocket } = createNodeWebSocket({ app });

const port = Number.parseInt(process.env.PORT || "8080", 10);

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

export { app };
