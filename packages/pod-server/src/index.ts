import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";

const app = new Hono();
const { injectWebSocket, upgradeWebSocket: _upgradeWebSocket } = createNodeWebSocket({ app });

app.get("/health", (c) => {
  return c.json({ status: "ok" }, 200);
});

app.get("/", (c) => {
  return c.text("Portable Pod Server");
});

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
