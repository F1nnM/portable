import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { files } from "./routes/files.js";
import { health } from "./routes/health.js";

const app = new Hono();

// API routes
app.route("/", health);
app.route("/", files);

// Serve the editor SPA from ./public
app.use("/*", serveStatic({ root: "./public" }));

// SPA fallback: serve index.html for all non-API, non-file routes
app.use("/*", serveStatic({ root: "./public", path: "index.html" }));

export { app };
