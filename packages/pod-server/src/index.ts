import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { app } from "./app.js";

const { injectWebSocket } = createNodeWebSocket({ app });

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
