import { Buffer } from "node:buffer";

import { proxyUpgrade } from "httpxy";

import { validateSession } from "../utils/auth";
import { getK8sConfig } from "../utils/k8s";
import { getDomainFromBaseUrl, resolveProxyTarget } from "../utils/proxy";

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("request", async (event) => {
    // Only handle WebSocket upgrade requests
    const upgradeHeader = event.node.req.headers.upgrade;
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") return;

    const host = event.node.req.headers.host;
    if (!host) return;

    const config = useRuntimeConfig();
    const domain = getDomainFromBaseUrl(config.baseUrl);
    const { podNamespace } = getK8sConfig();

    // Validate session from cookie
    const cookieHeader = event.node.req.headers.cookie || "";
    const sessionToken = parseCookie(cookieHeader, "portable_session");

    let user: { id: string } | null = null;
    if (sessionToken) {
      user = await validateSession(sessionToken);
    }

    let resolution;
    try {
      resolution = await resolveProxyTarget(host, domain, podNamespace, user);
    } catch {
      // Auth/project errors -- destroy the socket
      event.node.req.socket.destroy();
      event._handled = true;
      return;
    }

    // Not a subdomain request -- let Nuxt handle it
    if (!resolution) return;

    // Proxy the WebSocket upgrade
    try {
      await proxyUpgrade(
        resolution.target,
        event.node.req,
        event.node.req.socket,
        Buffer.alloc(0),
        {
          xfwd: true,
          headers: {
            "x-forwarded-host": host,
          },
        },
      );
    } catch (err) {
      console.error(`[ws-proxy] Failed to proxy WebSocket for ${resolution.subdomain.slug}:`, err);
      if (!event.node.req.socket.destroyed) {
        event.node.req.socket.destroy();
      }
    }

    // Mark as handled so Nitro doesn't process it further
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
