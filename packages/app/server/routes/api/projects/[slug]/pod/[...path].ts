import { and, eq } from "drizzle-orm";

import { projects } from "~/server/db/schema";
import { useDb } from "~/server/utils/db";
import { getK8sConfig } from "~/server/utils/k8s";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Slug is required" });
  }

  const path = getRouterParam(event, "path") || "";

  // Look up project, verify ownership and running status
  const db = useDb();
  const result = await db
    .select({ status: projects.status })
    .from(projects)
    .where(and(eq(projects.slug, slug), eq(projects.userId, user.id)))
    .limit(1);

  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: "Project not found" });
  }

  if (result[0].status !== "running") {
    throw createError({
      statusCode: 503,
      statusMessage: `Project is not running (status: ${result[0].status})`,
    });
  }

  // Build target URL and proxy
  const { podNamespace } = getK8sConfig();
  const target = `http://project-${slug}.${podNamespace}.svc.cluster.local:3000/${path}`;

  return proxyRequest(event, target);
});
