import type { Buffer } from "node:buffer";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import type { Connect, Plugin, ViteDevServer } from "vite";

import { createProxyServer, proxyUpgrade } from "httpxy";
import postgres from "postgres";

import { createPreviewToken, validatePreviewToken } from "./server/utils/preview-auth";
import { buildProxyTarget, parseCookie, parseSubdomain } from "./server/utils/proxy-shared";

// --- Dev proxy shared state ---
// Module-level variables shared between the Vite middleware plugin (HTTP subdomain
// proxy) and the listen hook (WebSocket subdomain proxy). Only used in dev mode.
const DEV_BASE_URL = process.env.NUXT_BASE_URL || "http://localhost:3000";
const DEV_NAMESPACE = process.env.NUXT_POD_NAMESPACE || "default";
const DEV_DOMAIN = new URL(DEV_BASE_URL).hostname;
const DEV_ENCRYPTION_KEY = process.env.NUXT_ENCRYPTION_KEY || "";

const PREVIEW_COOKIE_NAME = "__portable_preview";
const PREVIEW_COOKIE_TTL = 24 * 60 * 60; // 24 hours

let devSql: postgres.Sql | undefined;
let devProxy: ReturnType<typeof createProxyServer> | undefined;

function getDevSql(): postgres.Sql {
  if (!devSql) devSql = postgres(process.env.DATABASE_URL!);
  return devSql;
}

function getDevProxy(): ReturnType<typeof createProxyServer> {
  if (!devProxy) {
    devProxy = createProxyServer();
    devProxy.on("error", (err) => {
      console.warn(`[dev-proxy] Proxy error (suppressed):`, err.message);
    });
  }
  return devProxy;
}

/**
 * Validates a session cookie against the database. Returns the user ID if valid.
 * Uses raw SQL because Drizzle auto-imports aren't available in Vite context.
 */
async function validateDevSession(cookieHeader: string): Promise<string | null> {
  const token = parseCookie(cookieHeader, "portable_session");
  if (!token) return null;

  const rows = await getDevSql()`
    SELECT u.id as user_id
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ${token} AND s.expires_at > NOW()
    LIMIT 1
  `;

  return rows.length > 0 ? (rows[0].user_id as string) : null;
}

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
 * Vite plugin that proxies preview subdomain HTTP requests BEFORE Vite's built-in middleware.
 *
 * Only handles preview subdomains (<slug>--preview--<appLabel>.<domain>).
 * The editor SPA has been replaced by Nuxt pages served from the main app,
 * so editor subdomain proxying is no longer needed.
 *
 * In dev mode, Vite serves `/_nuxt/` asset requests before Nitro ever sees them.
 * When the browser requests `/_nuxt/entry.js` on a subdomain host (e.g.
 * `my-project--preview--portable.domain`), Vite serves the main app's assets instead of
 * letting the proxy forward them to the pod. This plugin intercepts ALL preview subdomain
 * requests before Vite can handle them.
 *
 * WebSocket proxying is handled separately by the `listen` hook (see
 * `installDevWsProxy`), because Vite runs in middlewareMode where
 * `server.httpServer` is null.
 *
 * In production there is no Vite, so the Nitro proxy plugin handles everything.
 */
function devSubdomainProxy(): Plugin {
  return {
    name: "dev-subdomain-proxy",
    configureServer(server: ViteDevServer) {
      // Clean up previous instances (configureServer is called on each Vite restart)
      if (devSql) {
        devSql.end({ timeout: 0 }).catch(() => {});
        devSql = undefined;
      }
      if (devProxy) {
        if (typeof devProxy.close === "function") devProxy.close();
        devProxy = undefined;
      }

      const currentProxy = getDevProxy();

      server.middlewares.use(
        (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
          const host = req.headers.host;
          if (!host) return next();

          const subdomain = parseSubdomain(host, DEV_DOMAIN);
          if (!subdomain) return next();

          handlePreviewProxy(req, res, subdomain, currentProxy, host).catch((err) => {
            console.error(`[dev-proxy] Error:`, err);
            if (!res.headersSent) {
              res.writeHead(500, { "Content-Type": "text/plain" });
              res.end("Internal Server Error");
            }
          });
        },
      );

      console.log(`[dev-proxy] Preview subdomain proxy installed (domain: ${DEV_DOMAIN})`);
    },
  };
}

async function handlePreviewProxy(
  req: IncomingMessage,
  res: ServerResponse,
  subdomain: { slug: string; type: "preview" },
  proxy: ReturnType<typeof createProxyServer>,
  host: string,
): Promise<void> {
  const slug = subdomain.slug;
  const requestUrl = req.url || "/";
  const cookieHeader = req.headers.cookie || "";

  // --- Auth callback: exchange token for preview cookie ---
  if (requestUrl.startsWith("/__portable_auth_cb")) {
    const params = new URL(requestUrl, "http://localhost").searchParams;
    const token = params.get("token");
    const redirect = params.get("redirect") || "/";

    if (!token) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing token");
      return;
    }

    const result = validatePreviewToken(token, slug, DEV_ENCRYPTION_KEY);
    if (!result) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Invalid or expired token");
      return;
    }

    // Mint a fresh long-lived token for the cookie
    const cookieToken = createPreviewToken(
      result.userId,
      slug,
      DEV_ENCRYPTION_KEY,
      PREVIEW_COOKIE_TTL,
    );
    const cookieParts = [
      `${PREVIEW_COOKIE_NAME}=${encodeURIComponent(cookieToken)}`,
      `Max-Age=${PREVIEW_COOKIE_TTL}`,
      `Path=/`,
      `HttpOnly`,
      `SameSite=Lax`,
    ];
    res.setHeader("Set-Cookie", cookieParts.join("; "));

    const safeRedirect = redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";
    res.writeHead(302, { Location: safeRedirect });
    res.end();
    return;
  }

  // --- Validate preview cookie ---
  const previewToken = parseCookie(cookieHeader, PREVIEW_COOKIE_NAME);
  const tokenResult = previewToken
    ? validatePreviewToken(previewToken, slug, DEV_ENCRYPTION_KEY)
    : null;

  if (!tokenResult) {
    // Redirect to auth relay on the main app
    const path = requestUrl.split("?")[0] || "/";
    const authUrl = `${DEV_BASE_URL}/api/preview-auth?slug=${encodeURIComponent(slug)}&redirect=${encodeURIComponent(path)}`;
    res.writeHead(302, { Location: authUrl });
    res.end();
    return;
  }

  // --- Proxy the authenticated request ---
  const target = buildProxyTarget(slug, DEV_NAMESPACE);
  await proxy.web(req, res, {
    target,
    xfwd: true,
    headers: { "x-forwarded-host": host },
  });
}

/**
 * Installs a WebSocket proxy on the actual HTTP server for dev mode.
 *
 * In dev, Vite runs in middlewareMode (no httpServer), so the Vite plugin's
 * `server.httpServer?.on("upgrade", ...)` would be a no-op. The actual HTTP
 * server is owned by the Nitro dev server, which registers its own upgrade
 * handler to forward all WebSocket connections to the Nitro worker.
 *
 * This function intercepts upgrade events on that server to proxy preview subdomain
 * WebSocket connections directly to project pods, before Nitro's default
 * handler forwards them to the worker (which doesn't know about subdomains).
 */
function installDevWsProxy(server: Server): void {
  // Capture existing upgrade listeners (Nitro's worker proxy, Vite HMR, etc.)
  const existingListeners = server.listeners("upgrade") as ((
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => void)[];
  server.removeAllListeners("upgrade");

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const host = req.headers.host;
    if (!host) {
      for (const listener of existingListeners) listener(req, socket, head);
      return;
    }

    // Path-based pod WebSocket proxy: /api/projects/:slug/pod/ws
    const podWsMatch = (req.url || "").match(/^\/api\/projects\/([^/]+)\/pod\/ws(\?.*)?$/);
    if (podWsMatch) {
      const slug = podWsMatch[1];
      const queryString = podWsMatch[2] || "";

      validateDevSession(req.headers.cookie || "")
        .then((userId) => {
          if (!userId) {
            socket.destroy();
            return;
          }

          const target = `http://project-${slug}.${DEV_NAMESPACE}.svc.cluster.local:3000`;
          req.url = `/ws${queryString}`;
          return proxyUpgrade(target, req, socket, head, {
            xfwd: true,
            headers: { "x-forwarded-host": host },
          });
        })
        .catch((err) => {
          console.error(`[dev-proxy] Pod WebSocket error:`, err);
          if (!socket.destroyed) socket.destroy();
        });
      return;
    }

    const subdomain = parseSubdomain(host, DEV_DOMAIN);
    if (!subdomain) {
      // Not a preview subdomain request -- delegate to original handlers
      for (const listener of existingListeners) listener(req, socket, head);
      return;
    }

    // Preview subdomain WebSocket -- validate preview cookie before proxying
    const wsCookieHeader = req.headers.cookie || "";
    const wsPreviewToken = parseCookie(wsCookieHeader, PREVIEW_COOKIE_NAME);
    const wsTokenResult = wsPreviewToken
      ? validatePreviewToken(wsPreviewToken, subdomain.slug, DEV_ENCRYPTION_KEY)
      : null;

    if (!wsTokenResult) {
      socket.destroy();
      return;
    }

    const target = buildProxyTarget(subdomain.slug, DEV_NAMESPACE);
    proxyUpgrade(target, req, socket, head, {
      xfwd: true,
      headers: { "x-forwarded-host": host },
    }).catch((err) => {
      console.error(`[dev-proxy] WebSocket error:`, err);
      if (!socket.destroyed) socket.destroy();
    });
  });

  console.log(`[dev-proxy] WebSocket proxy installed on HTTP server`);
}

export default defineNuxtConfig({
  compatibilityDate: "2025-03-01",
  ssr: true,
  devtools: { enabled: false },
  hooks: {
    // The listen hook fires when the Nuxt dev server binds to a port.
    // In production, nuxt.config.ts isn't loaded at runtime (Nitro handles
    // everything), so this hook only runs during development.
    listen(server) {
      installDevWsProxy(server as Server);
    },
  },
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
    server: {
      // Allow all hosts so subdomain requests (e.g. *.portable.127.0.0.1.nip.io)
      // reach our dev proxy instead of being blocked by Vite's host check.
      allowedHosts: true,
    },
  },
  app: {
    head: {
      title: "Portable",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { name: "theme-color", content: "#f6f4f1" },
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
          href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
        },
      ],
    },
  },
  css: ["@portable/design-tokens/tokens.css", "~/assets/css/global.css"],
});
