#!/bin/sh
set -e

WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace}"

echo "[entrypoint-dev] Starting workspace setup..."

# Run the TypeScript setup module directly via tsx (no build step needed)
cd /build/packages/pod-server
npx tsx -e "
  import { setupWorkspace } from './src/setup.ts';
  await setupWorkspace({
    workspaceDir: process.env.WORKSPACE_DIR || '/workspace',
    githubRepoUrl: process.env.GITHUB_REPO_URL,
    githubToken: process.env.GITHUB_TOKEN,
  });
"

echo "[entrypoint-dev] Setup complete. Starting pod server (dev mode)..."

# Start the pod server with tsx watch for live reloading
exec npx tsx watch src/index.ts
