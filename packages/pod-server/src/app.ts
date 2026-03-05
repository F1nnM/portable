import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({ status: "ok" }, 200);
});

app.get("/", (c) => {
  return c.text("Portable Pod Server");
});

export { app };
