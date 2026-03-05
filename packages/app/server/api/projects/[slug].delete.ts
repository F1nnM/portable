import { and, eq } from "drizzle-orm";
import { projects } from "../../db/schema";
import { useDb } from "../../utils/db";

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
    .delete(projects)
    .where(and(eq(projects.userId, user.id), eq(projects.slug, slug)))
    .returning({ id: projects.id });

  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: "Project not found" });
  }

  return { ok: true };
});
