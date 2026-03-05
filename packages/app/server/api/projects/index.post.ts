import { and, eq } from "drizzle-orm";
import { projects } from "../../db/schema";
import { useDb } from "../../utils/db";
import { generateSlug } from "../../utils/slug";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const body = await readBody<{ name?: string; scaffoldId?: string }>(event);

  if (!body?.name || body.name.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: "Name is required" });
  }

  const name = body.name.trim();
  const slug = generateSlug(name);

  if (slug.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Name must contain at least one alphanumeric character",
    });
  }

  const scaffoldId = body.scaffoldId ?? "nuxt-postgres";

  const db = useDb();

  // Check if slug is unique for this user
  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.userId, user.id), eq(projects.slug, slug)))
    .limit(1);

  if (existing.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "A project with this name already exists",
    });
  }

  const result = await db
    .insert(projects)
    .values({
      userId: user.id,
      name,
      slug,
      scaffoldId,
    })
    .returning({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      scaffoldId: projects.scaffoldId,
      status: projects.status,
      createdAt: projects.createdAt,
    });

  setResponseStatus(event, 201);
  return { project: result[0] };
});
