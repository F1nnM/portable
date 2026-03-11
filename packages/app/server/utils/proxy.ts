import { and, eq } from "drizzle-orm";

import { projects } from "../db/schema";
import { useDb } from "./db";
import { buildProxyTarget, parseSubdomain } from "./proxy-shared";

export interface ProjectProxyInfo {
  id: string;
  slug: string;
  status: string;
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
  slug: string;
}

/**
 * Core proxy resolution logic for preview subdomains. Given a host header, domain,
 * namespace, and user context, determines where to proxy the request.
 *
 * Only preview subdomains (<slug>--preview--<appLabel>.<domain>) are proxied.
 * Returns null if the request is not a preview subdomain (should be handled by Nuxt).
 * Throws errors for auth failures, missing projects, or non-running projects.
 */
export async function resolveProxyTarget(
  host: string,
  domain: string,
  namespace: string,
  user: { id: string } | null,
): Promise<ProxyResolution | null> {
  const subdomain = parseSubdomain(host, domain);

  // Not a preview subdomain request -- let Nuxt handle it normally
  if (!subdomain) return null;

  // Preview subdomain: require authentication
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

  const target = buildProxyTarget(subdomain.slug, namespace);
  return { target, slug: subdomain.slug };
}
