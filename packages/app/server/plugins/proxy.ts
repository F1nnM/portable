import { Buffer } from "node:buffer";

import { createProxyServer, proxyUpgrade } from "httpxy";

import { validateSession } from "../utils/auth";
import { getK8sConfig } from "../utils/k8s";
import { resolveProxyTarget } from "../utils/proxy";
import { getDomainFromBaseUrl, parseCookie, parseSubdomain } from "../utils/proxy-shared";
import { verifyRelayToken } from "../utils/relay-token";

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
/**
 * Extracts the `__portable_relay` query parameter from a raw URL string.
 * Returns the token value and the URL with the parameter stripped, or null if absent.
 */
function extractRelayToken(url: string): { token: string; cleanUrl: string } | null {
  const qIdx = url.indexOf("?");
  if (qIdx === -1) return null;

  const searchParams = new URLSearchParams(url.slice(qIdx));
  const token = searchParams.get("__portable_relay");
  if (!token) return null;

  searchParams.delete("__portable_relay");
  const remaining = searchParams.toString();
  const cleanUrl = remaining ? `${url.slice(0, qIdx)}?${remaining}` : url.slice(0, qIdx);
  return { token, cleanUrl };
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("request", async (event) => {
    const host = event.node.req.headers.host;
    if (!host) return;

    const config = useRuntimeConfig();
    const domain = getDomainFromBaseUrl(config.baseUrl);

    // Quick check: is this a subdomain request at all?
    const subdomain = parseSubdomain(host, domain);
    if (!subdomain) return; // Main app domain — let Nuxt handle it

    const isWebSocket = event.node.req.headers.upgrade?.toLowerCase() === "websocket";

    // --- Relay token exchange ---
    // If the URL contains a `__portable_relay` param, validate it, set a
    // subdomain-scoped session cookie, and redirect to the clean URL.
    if (!isWebSocket) {
      const relay = extractRelayToken(event.node.req.url || "/");
      if (relay) {
        const result = verifyRelayToken(relay.token, config.encryptionKey);
        if (result) {
          // Validate the session is still active
          const relayUser = await validateSession(result.sessionId);
          if (relayUser) {
            // Set session cookie as a host-only cookie (no Domain attribute).
            // Omitting Domain means the browser only sends this cookie to the
            // exact host that set it, which is the project subdomain.
            const secure = process.env.NODE_ENV === "production";
            const cookie =
              `portable_session=${encodeURIComponent(result.sessionId)}; ` +
              `Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${
                secure ? "; Secure" : ""
              }`;
            event.node.res.writeHead(302, {
              Location: relay.cleanUrl || "/",
              "Set-Cookie": cookie,
            });
            event.node.res.end();
            event._handled = true;
            return;
          }
        }
        // Invalid or expired relay token — fall through to auth redirect
      }
    }

    // --- Session validation ---
    const cookieHeader = event.node.req.headers.cookie || "";
    const sessionToken = parseCookie(cookieHeader, "portable_session");

    let user: { id: string } | null = null;
    if (sessionToken) {
      user = await validateSession(sessionToken);
    }

    // --- Unauthenticated subdomain request: redirect to auth relay ---
    if (!user) {
      if (isWebSocket) {
        event.node.req.socket.destroy();
      } else {
        const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
        const originalUrl = `${protocol}://${host}${event.node.req.url || "/"}`;
        const relayUrl = `${config.baseUrl}/auth/relay?redirect=${encodeURIComponent(originalUrl)}`;
        event.node.res.writeHead(302, { Location: relayUrl });
        event.node.res.end();
      }
      event._handled = true;
      return;
    }

    // --- Resolve proxy target ---
    const { podNamespace } = getK8sConfig();
    let resolution;
    try {
      resolution = await resolveProxyTarget(host, domain, podNamespace, user);
    } catch (err: unknown) {
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

    // This shouldn't happen since we already checked parseSubdomain above,
    // but guard against it anyway.
    if (!resolution) return;

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
