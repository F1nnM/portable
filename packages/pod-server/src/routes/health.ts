import { Hono } from "hono";

const health = new Hono();

health.get("/health", (c) => {
  return c.json({ status: "ok" }, 200);
});

export { health };
