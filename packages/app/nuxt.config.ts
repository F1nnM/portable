import type { Buffer } from "node:buffer";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";
import type { Connect, Plugin, ViteDevServer } from "vite";

import { createProxyServer, proxyUpgrade } from "httpxy";
import postgres from "postgres";

/**
 * Suppresses "socket hang up" unhandled rejections from crashing the Nuxt dev
 * server. Nitropack's dev server uses an internal httpxy (v0.1.7, separate from
 * our v0.3.1) to proxy WebSocket connections to its worker process. During
 * rebuilds triggered by Tilt file sync, the old worker dies and the WebSocket
 * proxy fails with "socket hang up". Nitropack doesn't catch the rejection,
 * which causes Nuxt to restart. We intercept process.emit to suppress this
 * specific event before Nuxt's error handler sees it.
 */
function suppressWsHangupErrors(): Plugin {
  let patched = false;
  return {
    name: "suppress-ws-hangup-errors",
    config() {
      if (patched) return;
      patched = true;

      const originalEmit = process.emit.bind(process);
      // @ts-expect-error -- monkey-patching process.emit for error suppression
      process.emit = function (event: string, ...args: unknown[]) {
        if (event === "unhandledRejection" || event === "uncaughtException") {
          const reason = args[0];
          if (reason instanceof Error && reason.message === "socket hang up") {
            return true; // signal that the event was handled
          }
        }
        // @ts-expect-error -- forwarding to original emit with loosened types
        return originalEmit(event, ...args);
      };
    },
  };
}

/**
 * Vite plugin that proxies subdomain requests BEFORE Vite's built-in middleware.
 *
 * In dev mode, Vite serves `/_nuxt/` asset requests before Nitro ever sees them.
 * When the browser requests `/_nuxt/entry.js` on a subdomain host (e.g.
 * `my-project--preview.domain`), Vite serves the main app's assets instead of
 * letting the proxy forward them to the pod. This plugin intercepts ALL subdomain
 * requests before Vite can handle them.
 *
 * In production there is no Vite, so the Nitro proxy plugin handles everything.
 */
function devSubdomainProxy(): Plugin {
  const baseUrl = process.env.NUXT_BASE_URL || "http://localhost:3000";
  const namespace = process.env.NUXT_POD_NAMESPACE || "default";
  const domain = new URL(baseUrl).hostname;

  let proxy: ReturnType<typeof createProxyServer> | undefined;
  let sql: postgres.Sql | undefined;

  return {
    name: "dev-subdomain-proxy",
    configureServer(server: ViteDevServer) {
      // Clean up previous instances (configureServer is called on each Vite restart)
      if (sql) {
        sql.end({ timeout: 0 }).catch(() => {});
        sql = undefined;
      }
      if (proxy) {
        if (typeof proxy.close === "function") proxy.close();
        proxy = undefined;
      }

      proxy = createProxyServer();
      sql = postgres(process.env.DATABASE_URL!);

      const currentProxy = proxy;
      const currentSql = sql;

      // Prevent unhandled 'error' events from crashing the process
      currentProxy.on("error", (err) => {
        console.warn(`[dev-proxy] Proxy error (suppressed):`, err.message);
      });

      server.middlewares.use(
        (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
          const host = req.headers.host;
          if (!host) return next();

          const subdomain = parseSubdomain(host, domain);
          if (!subdomain) return next();

          // Authenticate via session cookie before proxying
          handleAuthenticatedProxy(
            req,
            res,
            subdomain,
            currentSql,
            namespace,
            currentProxy,
            host,
          ).catch((err) => {
            console.error(`[dev-proxy] Error:`, err);
            if (!res.headersSent) {
              res.writeHead(500, { "Content-Type": "text/plain" });
              res.end("Internal Server Error");
            }
          });
        },
      );

      // Handle WebSocket upgrades on subdomain hosts.
      // Connect middleware doesn't intercept `upgrade` events, so without this
      // handler WebSocket requests (e.g. /ws) fall through to Nitro/Nuxt which
      // logs Vue Router warnings about unmatched paths.
      server.httpServer?.on("upgrade", (req: IncomingMessage, socket: Socket, head: Buffer) => {
        const host = req.headers.host;
        if (!host) return;

        const subdomain = parseSubdomain(host, domain);
        if (!subdomain) return;

        handleAuthenticatedWsProxy(req, socket, head, subdomain, currentSql, namespace, host).catch(
          (err) => {
            console.error(`[dev-proxy] WebSocket error:`, err);
            if (!socket.destroyed) socket.destroy();
          },
        );
      });

      // Clean up on server close
      server.httpServer?.on("close", () => {
        currentSql.end({ timeout: 0 }).catch(() => {});
        if (typeof currentProxy.close === "function") currentProxy.close();
      });

      console.log(`[dev-proxy] Subdomain proxy installed (domain: ${domain})`);
    },
  };
}

async function handleAuthenticatedProxy(
  req: IncomingMessage,
  res: ServerResponse,
  subdomain: { slug: string; type: "editor" | "preview" },
  sql: postgres.Sql,
  namespace: string,
  proxy: ReturnType<typeof createProxyServer>,
  host: string,
): Promise<void> {
  // Parse session cookie
  const cookieHeader = req.headers.cookie || "";
  const tokenMatch = cookieHeader.match(/(?:^|;\s*)portable_session=([^;]*)/);
  const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;

  if (!token) {
    res.writeHead(401, { "Content-Type": "text/plain" });
    res.end("Unauthorized");
    return;
  }

  // Validate session directly against the database
  const rows = await sql`
    SELECT u.id as user_id
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ${token} AND s.expires_at > NOW()
    LIMIT 1
  `;

  if (rows.length === 0) {
    res.writeHead(401, { "Content-Type": "text/plain" });
    res.end("Unauthorized");
    return;
  }

  const port = subdomain.type === "editor" ? 3000 : 3001;
  const target = `http://project-${subdomain.slug}.${namespace}.svc.cluster.local:${port}`;

  await proxy.web(req, res, {
    target,
    xfwd: true,
    headers: { "x-forwarded-host": host },
  });
}

async function handleAuthenticatedWsProxy(
  req: IncomingMessage,
  socket: Socket,
  head: Buffer,
  subdomain: { slug: string; type: "editor" | "preview" },
  sql: postgres.Sql,
  namespace: string,
  host: string,
): Promise<void> {
  const cookieHeader = req.headers.cookie || "";
  const tokenMatch = cookieHeader.match(/(?:^|;\s*)portable_session=([^;]*)/);
  const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;

  if (!token) {
    socket.destroy();
    return;
  }

  const rows = await sql`
    SELECT u.id as user_id
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ${token} AND s.expires_at > NOW()
    LIMIT 1
  `;

  if (rows.length === 0) {
    socket.destroy();
    return;
  }

  const port = subdomain.type === "editor" ? 3000 : 3001;
  const target = `http://project-${subdomain.slug}.${namespace}.svc.cluster.local:${port}`;

  await proxyUpgrade(target, req, socket, head, {
    xfwd: true,
    headers: { "x-forwarded-host": host },
  });
}

function parseSubdomain(
  host: string,
  domain: string,
): { slug: string; type: "editor" | "preview" } | null {
  if (!host) return null;
  const hostname = host.includes(":") ? host.split(":")[0] : host;
  if (!hostname.endsWith(domain)) return null;
  if (hostname === domain) return null;
  const prefix = hostname.slice(0, -(domain.length + 1));
  if (!prefix) return null;
  if (prefix.endsWith("--preview")) {
    const slug = prefix.slice(0, -"--preview".length);
    if (!slug) return null;
    return { slug, type: "preview" };
  }
  return { slug: prefix, type: "editor" };
}

export default defineNuxtConfig({
  compatibilityDate: "2025-03-01",
  ssr: true,
  devtools: { enabled: false },
  runtimeConfig: {
    githubClientId: "",
    githubClientSecret: "",
    encryptionKey: "",
    baseUrl: "http://localhost:3000",
    podNamespace: "default",
    podServerImage: "portable/pod-server:latest",
    podResourceCpuRequest: "500m",
    podResourceCpuLimit: "2000m",
    podResourceMemoryRequest: "512Mi",
    podResourceMemoryLimit: "4Gi",
    podStorageSize: "5Gi",
    allowedUsers: "",
  },
  vite: {
    plugins: [suppressWsHangupErrors(), devSubdomainProxy()],
  },
  app: {
    head: {
      title: "Portable",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { name: "theme-color", content: "#0a0a0b" },
        {
          name: "description",
          content: "Mobile-first remote Claude Code environment",
        },
      ],
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
        },
      ],
    },
  },
  css: ["~/assets/css/global.css"],
});
