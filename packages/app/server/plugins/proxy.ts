import { Buffer } from "node:buffer";

import { createProxyServer, proxyUpgrade } from "httpxy";

import { validateSession } from "../utils/auth";
import { getK8sConfig } from "../utils/k8s";
import { getDomainFromBaseUrl, resolveProxyTarget } from "../utils/proxy";

const httpProxy = createProxyServer();

/**
 * Unified proxy plugin for HTTP and WebSocket subdomain requests.
 *
 * Hooks into the Nitro `request` event, which fires BEFORE Vite's dev
 * middleware. This is critical: without it, Vite intercepts `/_nuxt/` asset
 * requests on subdomain hosts and serves the main app's bundles (or 404s)
 * instead of letting them reach the project pod.
 *
 * Auth is handled manually (cookie parsing + session validation) because
 * Nitro middleware (including the auth middleware) hasn't run yet at this point.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("request", async (event) => {
    const host = event.node.req.headers.host;
    if (!host) return;

    const config = useRuntimeConfig();
    const domain = getDomainFromBaseUrl(config.baseUrl);
    const { podNamespace } = getK8sConfig();

    // Validate session from cookie (auth middleware hasn't run yet in plugin context)
    const cookieHeader = event.node.req.headers.cookie || "";
    const sessionToken = parseCookie(cookieHeader, "portable_session");

    let user: { id: string } | null = null;
    if (sessionToken) {
      user = await validateSession(sessionToken);
    }

    let resolution;
    try {
      resolution = await resolveProxyTarget(host, domain, podNamespace, user);
    } catch (err: unknown) {
      const isWebSocket = event.node.req.headers.upgrade?.toLowerCase() === "websocket";
      if (isWebSocket) {
        event.node.req.socket.destroy();
      } else {
        const statusCode = (err as { statusCode?: number }).statusCode || 502;
        const statusMessage = (err as { statusMessage?: string }).statusMessage || "Bad Gateway";
        event.node.res.writeHead(statusCode, { "Content-Type": "text/plain" });
        event.node.res.end(statusMessage);
      }
      event._handled = true;
      return;
    }

    // Not a subdomain request -- let Nuxt handle it normally
    if (!resolution) return;

    const isWebSocket = event.node.req.headers.upgrade?.toLowerCase() === "websocket";

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
        console.error(`[proxy] Failed to proxy WebSocket for ${resolution.subdomain.slug}:`, err);
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
        console.error(`[proxy] Failed to proxy HTTP for ${resolution.subdomain.slug}:`, err);
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

/**
 * Parses a specific cookie value from a cookie header string.
 */
function parseCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
