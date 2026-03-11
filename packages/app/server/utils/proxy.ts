import { and, eq } from "drizzle-orm";

import { projects } from "../db/schema";
import { useDb } from "./db";

export interface ProjectProxyInfo {
  id: string;
  slug: string;
  status: string;
}

/**
 * Looks up a project by slug and userId. Returns the project info if found, null otherwise.
 * Used by the pod WebSocket proxy to verify project ownership and running status.
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
