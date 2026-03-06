import { and, eq } from "drizzle-orm";
import { projects } from "../db/schema";
import { useDb } from "./db";

export interface SubdomainInfo {
  slug: string;
  type: "editor" | "preview";
}

export interface ProjectProxyInfo {
  id: string;
  slug: string;
  status: string;
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
 * Looks up a project by slug and userId. Returns the project info if found, null otherwise.
 */
export async function lookupProject(
  slug: string,
  userId: string,
): Promise<ProjectProxyInfo | null> {
  const db = useDb();
  const result = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      status: projects.status,
    })
    .from(projects)
    .where(and(eq(projects.slug, slug), eq(projects.userId, userId)))
    .limit(1);

  if (result.length === 0) return null;
  return result[0];
}

/**
 * Result of resolving a proxy request. Contains either a target URL to proxy to,
 * or null if the request should be passed through to Nuxt.
 */
export interface ProxyResolution {
  target: string;
  subdomain: SubdomainInfo;
}

/**
 * Core proxy resolution logic. Given a host header, domain, namespace, and user context,
 * determines where to proxy the request.
 *
 * Returns null if the request is not a subdomain request (should be handled by Nuxt).
 * Throws errors for auth failures, missing projects, or non-running projects.
 */
export async function resolveProxyTarget(
  host: string,
  domain: string,
  namespace: string,
  user: { id: string } | null,
): Promise<ProxyResolution | null> {
  const subdomain = parseSubdomain(host, domain);

  // Not a subdomain request -- let Nuxt handle it normally
  if (!subdomain) return null;

  // Subdomain request: require authentication
  if (!user) {
    throw Object.assign(new Error("Authentication required to access project"), {
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  // Look up the project by slug, verifying ownership
  const project = await lookupProject(subdomain.slug, user.id);

  if (!project) {
    throw Object.assign(new Error(`Project "${subdomain.slug}" not found`), {
      statusCode: 404,
      statusMessage: "Not Found",
    });
  }

  if (project.status !== "running") {
    throw Object.assign(
      new Error(`Project "${subdomain.slug}" is not running (status: ${project.status})`),
      {
        statusCode: 503,
        statusMessage: "Service Unavailable",
      },
    );
  }

  const target = buildProxyTarget(subdomain.slug, subdomain.type, namespace);
  return { target, subdomain };
}
