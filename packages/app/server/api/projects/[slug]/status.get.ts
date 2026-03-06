import { and, eq } from "drizzle-orm";
import { projects } from "../../../db/schema";
import { useDb } from "../../../utils/db";
import { getK8sConfig } from "../../../utils/k8s";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Slug is required" });
  }

  const db = useDb();
  const result = await db
    .select({ status: projects.status })
    .from(projects)
    .where(and(eq(projects.slug, slug), eq(projects.userId, user.id)))
    .limit(1);

  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: "Project not found" });
  }

  const project = result[0];

  if (project.status === "starting") {
    const config = getK8sConfig();
    const podUrl = `http://project-${slug}.${config.podNamespace}.svc.cluster.local:3000/health`;

    try {
      const response = await fetch(podUrl, {
        signal: AbortSignal.timeout(2000),
      });
      const body = await response.json();
      return { status: "starting", phase: body.phase ?? "initializing" };
    } catch {
      return { status: "starting", phase: "preparing" };
    }
  }

  return { status: project.status, phase: null };
});
