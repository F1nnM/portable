import { and, eq } from "drizzle-orm";
import { projects } from "../../db/schema";
import { useDb } from "../../utils/db";
import { generateSlug } from "../../utils/slug";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Slug is required" });
  }

  const body = await readBody<{ name?: string }>(event);

  if (!body?.name || body.name.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: "Name is required" });
  }

  const name = body.name.trim();

  if (name.length > 100) {
    throw createError({ statusCode: 400, statusMessage: "Name must be 100 characters or fewer" });
  }

  const newSlug = generateSlug(name);

  if (newSlug.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Name must contain at least one alphanumeric character",
    });
  }

  const db = useDb();

  // Find the project owned by this user
  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.userId, user.id), eq(projects.slug, slug)))
    .limit(1);

  if (existing.length === 0) {
    throw createError({ statusCode: 404, statusMessage: "Project not found" });
  }

  // If slug changed, check uniqueness
  if (newSlug !== slug) {
    const conflict = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.userId, user.id), eq(projects.slug, newSlug)))
      .limit(1);

    if (conflict.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: "A project with this name already exists",
      });
    }
  }

  const result = await db
    .update(projects)
    .set({
      name,
      slug: newSlug,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, existing[0].id))
    .returning({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      scaffoldId: projects.scaffoldId,
      status: projects.status,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    });

  return { project: result[0] };
});
