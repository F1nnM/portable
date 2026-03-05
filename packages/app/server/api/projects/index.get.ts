import { desc, eq } from "drizzle-orm";
import { projects } from "../../db/schema";
import { useDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const db = useDb();

  const result = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      scaffoldId: projects.scaffoldId,
      status: projects.status,
      repoUrl: projects.repoUrl,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(desc(projects.createdAt));

  return { projects: result };
});
