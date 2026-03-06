import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin, ViteDevServer } from "vite";

import { createProxyServer } from "httpxy";
import postgres from "postgres";

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

  return {
    name: "dev-subdomain-proxy",
    configureServer(server: ViteDevServer) {
      const proxy = createProxyServer();
      const sql = postgres(process.env.DATABASE_URL!);

      server.middlewares.use(
        (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
          const host = req.headers.host;
          if (!host) return next();

          const subdomain = parseSubdomain(host, domain);
          if (!subdomain) return next();

          // Authenticate via session cookie before proxying
          handleAuthenticatedProxy(req, res, subdomain, sql, namespace, proxy, host).catch(
            (err) => {
              console.error(`[dev-proxy] Error:`, err);
              if (!res.headersSent) {
                res.writeHead(500, { "Content-Type": "text/plain" });
                res.end("Internal Server Error");
              }
            },
          );
        },
      );

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
  devtools: { enabled: true },
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
    plugins: [devSubdomainProxy()],
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
