/**
 * Pure proxy utility functions -- no Nitro auto-imports, no DB dependencies.
 * Safe to import from both Nitro server context and Vite plugin context (nuxt.config.ts).
 */

export interface SubdomainInfo {
  slug: string;
  type: "editor" | "preview";
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
 * Parses the Host header to extract project slug and access type.
 * Returns null if the host is the main app domain (no subdomain).
 *
 * All project subdomains are flattened to a single DNS level using "--" as separator,
 * so that only one wildcard certificate level is needed (compatible with Cloudflare free-tier SSL).
 *
 * The configured domain (e.g. "portable.127.0.0.1.nip.io") is split into:
 *   appLabel = "portable", parentDomain = "127.0.0.1.nip.io"
 *
 * Examples (domain = "portable.127.0.0.1.nip.io"):
 *   "my-project--portable.127.0.0.1.nip.io" -> { slug: "my-project", type: "editor" }
 *   "my-project--preview--portable.127.0.0.1.nip.io" -> { slug: "my-project", type: "preview" }
 *   "portable.127.0.0.1.nip.io" -> null (main app)
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

  // Check if it's a preview subdomain: "<slug>--preview"
  if (remainder.endsWith("--preview")) {
    const slug = remainder.slice(0, -"--preview".length);
    if (!slug) return null;
    return { slug, type: "preview" };
  }

  // Otherwise it's an editor subdomain: "<slug>"
  return { slug: remainder, type: "editor" };
}

/**
 * Builds the internal K8s service URL for a project pod.
 *
 * Examples:
 *   buildProxyTarget("my-project", "editor", "default") -> "http://project-my-project.default.svc.cluster.local:3000"
 *   buildProxyTarget("my-project", "preview", "default") -> "http://project-my-project.default.svc.cluster.local:3001"
 */
export function buildProxyTarget(
  slug: string,
  type: "editor" | "preview",
  namespace: string,
): string {
  const port = type === "editor" ? 3000 : 3001;
  return `http://project-${slug}.${namespace}.svc.cluster.local:${port}`;
}

/**
 * Parses a specific cookie value from a cookie header string.
 */
export function parseCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
