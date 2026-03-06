#!/bin/sh
set -e

WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace}"

echo "[entrypoint] Starting workspace setup..."

# Run the TypeScript setup module (compiled to JS) which handles:
# - Cloning the repo if workspace is empty and GITHUB_REPO_URL is set
# - Installing dependencies if node_modules is missing
node -e "
  import { setupWorkspace } from './dist/setup.js';
  setupWorkspace({
    workspaceDir: process.env.WORKSPACE_DIR || '/workspace',
    githubRepoUrl: process.env.GITHUB_REPO_URL,
    githubToken: process.env.GITHUB_TOKEN,
  });
"

echo "[entrypoint] Setup complete. Starting pod server..."

# Start the Hono server (which also starts the dev server supervisor)
exec node dist/index.js
