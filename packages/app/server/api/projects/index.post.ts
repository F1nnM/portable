import { and, eq } from "drizzle-orm";
import { projects } from "../../db/schema";
import { useDb } from "../../utils/db";
import {
  createGitHubRepo,
  getDecryptedGithubToken,
  listScaffolds,
  pushScaffoldToRepo,
} from "../../utils/github";
import { createProjectDatabase } from "../../utils/project-db";
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

  // Create the DB record first
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
      repoUrl: projects.repoUrl,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    });

  const project = result[0];

  // Create per-project database and GitHub repo
  try {
    await createProjectDatabase(slug);

    const githubToken = await getDecryptedGithubToken(user.id);
    const repo = await createGitHubRepo(githubToken, slug);
    await pushScaffoldToRepo(githubToken, repo.owner, repo.repo, scaffoldId);

    // Update the project with the repo URL
    await db
      .update(projects)
      .set({ repoUrl: repo.htmlUrl, updatedAt: new Date() })
      .where(eq(projects.id, project.id));

    project.repoUrl = repo.htmlUrl;
  } catch (err) {
    // If operations fail, set status to "error" but keep the DB record
    console.error("Failed to set up project:", err);
    await db
      .update(projects)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(projects.id, project.id));

    project.status = "error";
  }

  setResponseStatus(event, 201);
  return { project };
});
