import { Hono } from "hono";
import { getActiveSdkSessionIds } from "../session-manager.js";

export const activeSessions = new Hono();

activeSessions.get("/api/sessions/active", (c) => {
  const activeSessionIds = getActiveSdkSessionIds();
  return c.json({ activeSessionIds });
});
