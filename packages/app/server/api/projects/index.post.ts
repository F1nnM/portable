import { and, eq } from "drizzle-orm";
import { projects } from "../../db/schema";
import { useDb } from "../../utils/db";
import { listScaffolds } from "../../utils/github";
import { createProject } from "../../utils/project-lifecycle";
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

  if (name.length > 100) {
    throw createError({ statusCode: 400, statusMessage: "Name must be 100 characters or fewer" });
  }

  const slug = generateSlug(name);

  if (slug.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Name must contain at least one alphanumeric character",
    });
  }

  const scaffoldId = body.scaffoldId ?? "nuxt-postgres";

  // Validate scaffoldId against available scaffolds
  const availableScaffolds = listScaffolds();
  if (!availableScaffolds.some((s) => s.id === scaffoldId)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid scaffold: "${scaffoldId}"`,
    });
  }

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

  // Create the DB record with "creating" status
  const result = await db
    .insert(projects)
    .values({
      userId: user.id,
      name,
      slug,
      scaffoldId,
      status: "creating",
    })
    .returning({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      scaffoldId: projects.scaffoldId,
      status: projects.status,
      repoUrl: projects.repoUrl,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    });

  const project = result[0];

  // Fire and forget — status transitions (creating → stopped / error) happen via DB.
  // The client polls for status changes while transitioning.
  createProject(user.id, project.id, slug, scaffoldId).catch((err: unknown) => {
    console.error(`Failed to create project ${slug}:`, err);
  });

  setResponseStatus(event, 201);
  return { project };
});
