import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { createApp } from "./app.js";
import { DevServerSupervisor } from "./dev-server.js";
import { setPhase } from "./setup-state.js";
import { setupWorkspace } from "./setup.js";

const { app, registerWsRoute, registerStaticFiles } = createApp();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
registerWsRoute(upgradeWebSocket);
registerStaticFiles();

const port = Number.parseInt(process.env.PORT || "3000", 10);
const workspaceDir = process.env.WORKSPACE_DIR || "/workspace";

// Start Hono server immediately so the health endpoint is available during setup
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

// Run setup asynchronously, then start the dev server
async function startup() {
  await setupWorkspace({
    workspaceDir,
    githubRepoUrl: process.env.GITHUB_REPO_URL,
    githubToken: process.env.GITHUB_TOKEN,
  });

  setPhase("starting_server");

  const supervisor = new DevServerSupervisor({
    command: process.env.DEV_SERVER_COMMAND || "bun run dev",
    cwd: workspaceDir,
    port: 3001,
  });
  supervisor.start();

  setPhase("ready");

  // Graceful shutdown
  process.on("SIGTERM", () => {
    supervisor.stop();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    supervisor.stop();
    process.exit(0);
  });
}

startup().catch((err) => {
  console.error("[startup] Fatal error during setup:", err);
  process.exit(1);
});
