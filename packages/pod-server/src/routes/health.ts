import { Hono } from "hono";
import { getPhase } from "../setup-state.js";

const health = new Hono();

health.get("/health", (c) => {
  const phase = getPhase();
  if (phase === "ready") {
    return c.json({ status: "ok", phase: "ready" }, 200);
  }
  return c.json({ status: "setting_up", phase }, 503);
});

export { health };
