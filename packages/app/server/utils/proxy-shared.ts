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
 * Examples (domain = "portable.127.0.0.1.nip.io"):
 *   "my-project.portable.127.0.0.1.nip.io" -> { slug: "my-project", type: "editor" }
 *   "my-project--preview.portable.127.0.0.1.nip.io" -> { slug: "my-project", type: "preview" }
 *   "portable.127.0.0.1.nip.io" -> null (main app)
 */
export function parseSubdomain(host: string, domain: string): SubdomainInfo | null {
  if (!host) return null;

  // Strip port from host if present
  const hostname = host.includes(":") ? host.split(":")[0] : host;

  // Ensure the hostname ends with the domain
  if (!hostname.endsWith(domain)) return null;

  // If hostname equals domain exactly, it's the main app
  if (hostname === domain) return null;

  // Extract the subdomain prefix (everything before the domain)
  // e.g., "my-project.portable.127.0.0.1.nip.io" -> "my-project"
  // e.g., "my-project--preview.portable.127.0.0.1.nip.io" -> "my-project--preview"
  const prefix = hostname.slice(0, -(domain.length + 1)); // +1 for the trailing dot

  if (!prefix) return null;

  // Check if it's a preview subdomain: "<slug>--preview"
  // Uses "--" suffix so the entire subdomain stays in a single DNS label,
  // which is required for wildcard ingress matching (*.domain).
  if (prefix.endsWith("--preview")) {
    const slug = prefix.slice(0, -"--preview".length);
    if (!slug) return null;
    return { slug, type: "preview" };
  }

  // Otherwise it's an editor subdomain: "<slug>"
  return { slug: prefix, type: "editor" };
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
