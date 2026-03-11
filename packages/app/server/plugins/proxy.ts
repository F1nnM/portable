import { Buffer } from "node:buffer";

import { createProxyServer, proxyUpgrade } from "httpxy";

import { validateSession } from "../utils/auth";
import { getK8sConfig } from "../utils/k8s";
import { lookupProject } from "../utils/proxy";
import {
  buildProxyTarget,
  getDomainFromBaseUrl,
  parseCookie,
  parseSubdomain,
} from "../utils/proxy-shared";

const httpProxy = createProxyServer();

// Prevent unhandled 'error' events from crashing the process.
// Errors during proxying are already caught in the try/catch around proxy.web(),
// but httpxy can also emit error events on the proxy object itself for socket-level
// errors (e.g., upstream closes mid-stream). Without this handler, those become
// unhandled errors that crash the Nuxt dev server.
httpProxy.on("error", (err) => {
  console.warn(`[proxy] Proxy error (suppressed):`, err.message);
});

/**
 * Proxy plugin for preview subdomain HTTP and WebSocket requests.
 *
 * Only handles preview subdomains (<slug>--preview--<appLabel>.<domain>).
 * The editor SPA has been replaced by Nuxt pages served from the main app,
 * so editor subdomain proxying is no longer needed.
 *
 * Preview subdomains proxy directly to the pod's dev server (port 3001)
 * without authentication, since:
 * - The preview iframe is loaded from the authenticated main app
 * - Pods are isolated by network policy (only reachable from the main app)
 *
 * Hooks into the Nitro `request` event, which fires BEFORE Vite's dev
 * middleware. This is critical: without it, Vite intercepts `/_nuxt/` asset
 * requests on subdomain hosts and serves the main app's bundles (or 404s)
 * instead of letting them reach the project pod.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("request", async (event) => {
    const host = event.node.req.headers.host;
    if (!host) return;

    const isWebSocket = event.node.req.headers.upgrade?.toLowerCase() === "websocket";

    // --- Path-based pod WebSocket proxy: /api/projects/:slug/pod/ws ---
    // This handles WebSocket connections from the editor (now part of the main app)
    // to the pod server. The HTTP API requests go through the catch-all route handler,
    // but WebSocket upgrades need to be intercepted here in the plugin.
    const podWsMatch = (event.node.req.url || "").match(
      /^\/api\/projects\/([^/]+)\/pod\/ws(\?.*)?$/,
    );
    if (podWsMatch && isWebSocket) {
      const slug = podWsMatch[1];
      const queryString = podWsMatch[2] || "";

      // Validate session
      const cookieHeader = event.node.req.headers.cookie || "";
      const sessionToken = parseCookie(cookieHeader, "portable_session");
      let user: { id: string } | null = null;
      if (sessionToken) {
        user = await validateSession(sessionToken);
      }

      if (!user) {
        event.node.req.socket.destroy();
        event._handled = true;
        return;
      }

      // Look up project and verify ownership + running status
      const project = await lookupProject(slug, user.id);
      if (!project || project.status !== "running") {
        event.node.req.socket.destroy();
        event._handled = true;
        return;
      }

      // Proxy the WebSocket to the pod
      // Rewrite the request URL from /api/projects/:slug/pod/ws to /ws
      // so the pod server receives it on its /ws endpoint.
      const { podNamespace } = getK8sConfig();
      const target = `http://project-${slug}.${podNamespace}.svc.cluster.local:3000`;
      event.node.req.url = `/ws${queryString}`;
      try {
        await proxyUpgrade(target, event.node.req, event.node.req.socket, Buffer.alloc(0), {
          xfwd: true,
          headers: { "x-forwarded-host": host },
        });
      } catch (err) {
        console.error(`[proxy] Failed to proxy pod WebSocket for ${slug}:`, err);
        if (!event.node.req.socket.destroyed) {
          event.node.req.socket.destroy();
        }
      }
      event._handled = true;
      return;
    }

    const config = useRuntimeConfig();
    const domain = getDomainFromBaseUrl(config.baseUrl);

    // Quick check: is this a preview subdomain request?
    const subdomain = parseSubdomain(host, domain);
    if (!subdomain) return; // Main app domain or unrecognized -- let Nuxt handle it

    // --- Build proxy target directly (no auth required for preview) ---
    // Preview subdomains proxy directly without authentication because:
    // - The preview iframe is loaded from within the authenticated main app
    // - Pods are isolated by network policy (only reachable from the main app)
    // - The auth relay flow has been removed, so preview subdomains have no session cookie
    const { podNamespace } = getK8sConfig();
    const target = buildProxyTarget(subdomain.slug, podNamespace);
    const resolution = { target, slug: subdomain.slug };

    // --- Proxy the request ---
    if (isWebSocket) {
      try {
        await proxyUpgrade(
          resolution.target,
          event.node.req,
          event.node.req.socket,
          Buffer.alloc(0),
          {
            xfwd: true,
            headers: { "x-forwarded-host": host },
          },
        );
      } catch (err) {
        console.error(`[proxy] Failed to proxy WebSocket for ${resolution.slug}:`, err);
        if (!event.node.req.socket.destroyed) {
          event.node.req.socket.destroy();
        }
      }
    } else {
      try {
        await httpProxy.web(event.node.req, event.node.res, {
          target: resolution.target,
          xfwd: true,
          headers: { "x-forwarded-host": host },
        });
      } catch (err) {
        console.error(`[proxy] Failed to proxy HTTP for ${resolution.slug}:`, err);
        if (!event.node.res.headersSent) {
          event.node.res.writeHead(502, { "Content-Type": "text/plain" });
          event.node.res.end("Bad Gateway");
        }
      }
    }

    // Mark as handled so Nitro/Vite don't process it further
    event._handled = true;
  });
});
