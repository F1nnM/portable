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

  const body = await readBody<{ name?: string; scaffoldId?: string; repoUrl?: string }>(event);

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

  const hasScaffold = !!body.scaffoldId;
  const hasRepoUrl = !!body.repoUrl;

  if (hasScaffold && hasRepoUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: "Provide either scaffoldId or repoUrl, not both",
    });
  }

  if (!hasScaffold && !hasRepoUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: "Either scaffoldId or repoUrl is required",
    });
  }

  let scaffoldId: string | null = null;
  let repoUrl: string | null = null;

  if (hasScaffold) {
    scaffoldId = body.scaffoldId!;
    const availableScaffolds = listScaffolds();
    if (!availableScaffolds.some((s) => s.id === scaffoldId)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid scaffold: "${scaffoldId}"`,
      });
    }
  } else {
    repoUrl = body.repoUrl!;
    if (!repoUrl.startsWith("https://github.com/")) {
      throw createError({
        statusCode: 400,
        statusMessage: "Only GitHub repository URLs are supported",
      });
    }
  }

  const db = useDb();

  // Check if slug is unique for this user
  const existingSlug = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.userId, user.id), eq(projects.slug, slug)))
    .limit(1);

  if (existingSlug.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "A project with this name already exists",
    });
  }

  // Check if repoUrl is already used by this user
  if (repoUrl) {
    const existingRepo = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.userId, user.id), eq(projects.repoUrl, repoUrl)))
      .limit(1);

    if (existingRepo.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: "This repository is already linked to a project",
      });
    }
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
      repoUrl,
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
