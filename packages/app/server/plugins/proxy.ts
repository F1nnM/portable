import { Buffer } from "node:buffer";

import { createProxyServer, proxyUpgrade } from "httpxy";

import { validateSession } from "../utils/auth";
import { getK8sConfig } from "../utils/k8s";
import { createPreviewToken, validatePreviewToken } from "../utils/preview-auth";
import { lookupProject } from "../utils/proxy";
import {
  buildProxyErrorPage,
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
httpProxy.on("error", (err, _req, res) => {
  console.warn(`[proxy] Proxy error (suppressed):`, err.message);
  // Send a friendly auto-refreshing page for HTTP requests.
  // For WebSocket upgrades, res is a Socket (no writeHead method).
  if (res && "writeHead" in res && !res.headersSent) {
    res.writeHead(502, { "Content-Type": "text/html" });
    res.end(buildProxyErrorPage());
  }
});

const PREVIEW_COOKIE_NAME = "__portable_preview";
const PREVIEW_COOKIE_TTL = 24 * 60 * 60; // 24 hours

/**
 * Proxy plugin for preview subdomain HTTP and WebSocket requests.
 *
 * Handles preview subdomains (<slug>--preview--<appLabel>.<domain>) with
 * cookie-based authentication. The session cookie from the main app is NOT
 * sent to preview subdomains (they are siblings, not children, in DNS).
 * Instead, an auth relay flow establishes a separate `__portable_preview`
 * cookie on the preview subdomain via HMAC-signed tokens.
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

    const slug = subdomain.slug;
    const requestUrl = event.node.req.url || "/";
    const cookieHeader = event.node.req.headers.cookie || "";

    // --- Auth callback: exchange token for preview cookie ---
    if (!isWebSocket && requestUrl.startsWith("/__portable_auth_cb")) {
      const params = new URL(requestUrl, "http://localhost").searchParams;
      const token = params.get("token");
      const redirect = params.get("redirect") || "/";

      if (!token) {
        event.node.res.writeHead(400, { "Content-Type": "text/plain" });
        event.node.res.end("Missing token");
        event._handled = true;
        return;
      }

      const result = validatePreviewToken(token, slug, config.encryptionKey);
      if (!result) {
        event.node.res.writeHead(403, { "Content-Type": "text/plain" });
        event.node.res.end("Invalid or expired token");
        event._handled = true;
        return;
      }

      // Mint a fresh long-lived token for the cookie (the redirect token has a short TTL)
      const cookieToken = createPreviewToken(
        result.userId,
        slug,
        config.encryptionKey,
        PREVIEW_COOKIE_TTL,
      );

      // Set the preview cookie
      const secure = process.env.NODE_ENV === "production";
      const cookieParts = [
        `${PREVIEW_COOKIE_NAME}=${encodeURIComponent(cookieToken)}`,
        `Max-Age=${PREVIEW_COOKIE_TTL}`,
        `Path=/`,
        `HttpOnly`,
        `SameSite=Lax`,
      ];
      if (secure) cookieParts.push("Secure");
      event.node.res.setHeader("Set-Cookie", cookieParts.join("; "));

      // Sanitize redirect: must start with "/" and not "//"
      const safeRedirect = redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";
      event.node.res.writeHead(302, { Location: safeRedirect });
      event.node.res.end();
      event._handled = true;
      return;
    }

    // --- Validate preview cookie ---
    const previewToken = parseCookie(cookieHeader, PREVIEW_COOKIE_NAME);
    const tokenResult = previewToken
      ? validatePreviewToken(previewToken, slug, config.encryptionKey)
      : null;

    if (!tokenResult) {
      if (isWebSocket) {
        // WebSocket upgrades can't redirect -- destroy the socket
        event.node.req.socket.destroy();
        event._handled = true;
        return;
      }

      // Redirect to auth relay on the main app
      const path = requestUrl.split("?")[0] || "/";
      const authUrl = `${config.baseUrl}/api/preview-auth?slug=${encodeURIComponent(slug)}&redirect=${encodeURIComponent(path)}`;
      event.node.res.writeHead(302, { Location: authUrl });
      event.node.res.end();
      event._handled = true;
      return;
    }

    // --- Proxy the authenticated request ---
    const { podNamespace } = getK8sConfig();
    const target = buildProxyTarget(slug, podNamespace);

    if (isWebSocket) {
      try {
        await proxyUpgrade(target, event.node.req, event.node.req.socket, Buffer.alloc(0), {
          xfwd: true,
          headers: { "x-forwarded-host": host },
        });
      } catch (err) {
        console.error(`[proxy] Failed to proxy WebSocket for ${slug}:`, err);
        if (!event.node.req.socket.destroyed) {
          event.node.req.socket.destroy();
        }
      }
    } else {
      try {
        await httpProxy.web(event.node.req, event.node.res, {
          target,
          xfwd: true,
          headers: { "x-forwarded-host": host },
        });
      } catch (err) {
        console.error(`[proxy] Failed to proxy HTTP for ${slug}:`, err);
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
