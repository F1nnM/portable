# Portable

A mobile-first web application for using Claude Code remotely. Create projects from scaffolds, and each project runs in an isolated Kubernetes pod with Claude Code, a dev server, and a code editor -- all accessible through a mobile-optimized web UI.

## Features

- **Mobile-first Claude Code** -- Chat with Claude Code from your phone or tablet through a responsive web UI with streaming messages and tool usage display
- **Isolated K8s pods** -- Each project runs in its own Kubernetes pod with dedicated CPU, memory, and persistent storage
- **Project scaffolds** -- Start new projects from templates (e.g., Nuxt + Postgres) with automatic GitHub repo creation
- **Live preview** -- See your running app at `preview.<project>.yourdomain.com` while Claude Code edits it
- **File browser** -- View and edit project files with CodeMirror 6, optimized for mobile
- **GitHub integration** -- OAuth login, automatic repo creation, scaffold push

## How It Works

1. Log in with GitHub
2. Create a new project by picking a scaffold and naming it
3. Portable creates a GitHub repo, pushes the scaffold, and spins up a K8s pod
4. Open the project to chat with Claude Code, browse files, and preview the running app
5. Stop or delete the project when done -- persistent storage keeps your work between sessions

## Architecture

```
Browser
  |
  v
Main App (Nuxt) --- wildcard ingress ---> Project Pods (Hono + Claude Agent SDK)
  |                                          |
  v                                          v
Postgres (shared)                         Dev Server (per-project)
```

- **Main app** handles auth, project management, and proxies all traffic to pods
- **Project pods** run Claude Code, a dev server, and serve the editor SPA
- Subdomain routing: `<project>.domain` for the editor, `preview.<project>.domain` for the dev server

## Tech Stack

| Component  | Technology                                 |
| ---------- | ------------------------------------------ |
| Main app   | Nuxt 3, Drizzle ORM, Arctic (GitHub OAuth) |
| Pod server | Hono, Claude Agent SDK, fdir               |
| Editor     | Vue 3, CodeMirror 6                        |
| Infra      | Kubernetes, Helm, Postgres 16              |
| Dev tools  | mise, pnpm, k3d, Tilt, Vitest              |

## Quick Start (Deployment)

Prerequisites: a Kubernetes cluster, Helm, wildcard DNS pointing `*.yourdomain.com` to the cluster, and optionally cert-manager for TLS.

```bash
helm install portable deploy/helm/portable \
  --set domain=portable.yourdomain.com \
  --set github.clientId=YOUR_CLIENT_ID \
  --set github.clientSecret=YOUR_CLIENT_SECRET \
  --set postgres.password=YOUR_SECURE_PASSWORD \
  --set encryptionKey=YOUR_32_BYTE_HEX_KEY
```

See `docs/deployment.md` for the full configuration reference.

## Development

Prerequisites: Docker, mise.

```bash
mise install                          # Install Node.js 22, pnpm, kubectl, helm, k3d, tilt
pnpm install                          # Install dependencies
ctlptl apply -f ctlptl-config.yaml   # Create k3d cluster + registry
tilt up                               # Build, deploy, watch
# Open http://portable.127.0.0.1.nip.io
```

See `docs/development.md` for the full development guide.

## License

[MIT](LICENSE)
