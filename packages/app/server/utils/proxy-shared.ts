/**
 * Pure proxy utility functions -- no Nitro auto-imports, no DB dependencies.
 * Safe to import from both Nitro server context and Vite plugin context (nuxt.config.ts).
 */

export interface SubdomainInfo {
  slug: string;
  type: "preview";
}

/**
 * Extracts the hostname (without protocol or port) from a base URL.
 *
 * Examples:
 *   "http://portable.127.0.0.1.nip.io" -> "portable.127.0.0.1.nip.io"
 *   "https://portable.example.com:8443" -> "portable.example.com"
 */
export function getDomainFromBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  return url.hostname;
}

/**
 * Parses the Host header to extract project slug for preview subdomains.
 * Returns null if the host is the main app domain or not a preview subdomain.
 *
 * Only preview subdomains are recognized. The editor SPA has been replaced by
 * Nuxt pages served from the main app, so editor subdomains are no longer needed.
 *
 * All project subdomains are flattened to a single DNS level using "--" as separator,
 * so that only one wildcard certificate level is needed (compatible with Cloudflare free-tier SSL).
 *
 * The configured domain (e.g. "portable.127.0.0.1.nip.io") is split into:
 *   appLabel = "portable", parentDomain = "127.0.0.1.nip.io"
 *
 * Examples (domain = "portable.127.0.0.1.nip.io"):
 *   "my-project--preview--portable.127.0.0.1.nip.io" -> { slug: "my-project", type: "preview" }
 *   "portable.127.0.0.1.nip.io" -> null (main app)
 *   "my-project--portable.127.0.0.1.nip.io" -> null (no longer recognized)
 *   "argocd.127.0.0.1.nip.io" -> null (not our traffic, no "--portable" suffix)
 */
export function parseSubdomain(host: string, domain: string): SubdomainInfo | null {
  if (!host) return null;

  // Derive appLabel and parentDomain from the configured domain
  // e.g. "portable.127.0.0.1.nip.io" -> appLabel="portable", parentDomain="127.0.0.1.nip.io"
  const firstDot = domain.indexOf(".");
  if (firstDot === -1) return null;
  const appLabel = domain.slice(0, firstDot);
  const parentDomain = domain.slice(firstDot + 1);

  // Strip port from host if present
  const hostname = host.includes(":") ? host.split(":")[0] : host;

  // Ensure the hostname ends with the parent domain
  if (!hostname.endsWith(parentDomain)) return null;

  // If hostname equals the configured domain exactly, it's the main app
  if (hostname === domain) return null;

  // Extract the subdomain label (everything before .{parentDomain})
  const suffix = `.${parentDomain}`;
  if (!hostname.endsWith(suffix)) return null;
  const subdomain = hostname.slice(0, -suffix.length);

  if (!subdomain) return null;

  // The subdomain must end with --{appLabel} to be our traffic
  const appSuffix = `--${appLabel}`;
  if (!subdomain.endsWith(appSuffix)) return null;

  // Strip the app label suffix
  const remainder = subdomain.slice(0, -appSuffix.length);

  if (!remainder) return null;

  // Only preview subdomains are recognized: "<slug>--preview"
  if (remainder.endsWith("--preview")) {
    const slug = remainder.slice(0, -"--preview".length);
    if (!slug) return null;
    return { slug, type: "preview" };
  }

  // Non-preview subdomains (former "editor" pattern) are no longer recognized
  return null;
}

/**
 * Builds the internal K8s service URL for a project pod's dev server (preview).
 *
 * Example:
 *   buildProxyTarget("my-project", "default") -> "http://project-my-project.default.svc.cluster.local:3001"
 */
export function buildProxyTarget(slug: string, namespace: string): string {
  return `http://project-${slug}.${namespace}.svc.cluster.local:3001`;
}

/**
 * Builds the full preview origin URL for a project slug.
 *
 * Derives appLabel and parentDomain from the base URL (same pattern as parseSubdomain),
 * preserving the protocol and port.
 *
 * Examples:
 *   ("my-project", "http://portable.127.0.0.1.nip.io") -> "http://my-project--preview--portable.127.0.0.1.nip.io"
 *   ("my-project", "https://portable.example.com:8443") -> "https://my-project--preview--portable.example.com:8443"
 */
export function buildPreviewOrigin(slug: string, baseUrl: string): string {
  const url = new URL(baseUrl);
  const hostname = url.hostname;
  const firstDot = hostname.indexOf(".");
  const appLabel = hostname.slice(0, firstDot);
  const parentDomain = hostname.slice(firstDot + 1);
  const previewHost = `${slug}--preview--${appLabel}.${parentDomain}`;

  // Preserve port if non-default
  const port = url.port ? `:${url.port}` : "";
  return `${url.protocol}//${previewHost}${port}`;
}

/**
 * Returns an auto-refreshing HTML page shown when the proxy cannot reach
 * the pod's dev server (ECONNREFUSED / timeout). Refreshes every 3 seconds
 * so the preview loads automatically once the dev server starts.
 */
export function buildProxyErrorPage(): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="3">
<title>App Loading...</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f6f4f1;color:#3d3a37}.c{text-align:center;padding:2rem}.s{width:32px;height:32px;border:2px solid #e5e1dc;border-top-color:#e87c4a;border-radius:50%;animation:r .8s linear infinite;margin:0 auto 1rem}@keyframes r{to{transform:rotate(360deg)}}h1{font-size:1.125rem;font-weight:600;margin:0 0 .5rem}p{font-size:.875rem;color:#8b8580;margin:0}</style>
</head><body><div class="c"><div class="s"></div><h1>Dev server is starting</h1><p>This page will refresh automatically.</p></div></body></html>`;
}

/**
 * Parses a specific cookie value from a cookie header string.
 */
export function parseCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
