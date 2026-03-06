import { isError as isH3Error } from "h3";
import { deleteProject } from "../../utils/project-lifecycle";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Slug is required" });
  }

  const body = await readBody<{ deleteGithubRepo?: boolean }>(event).catch(
    () => ({}) as { deleteGithubRepo?: boolean },
  );

  try {
    await deleteProject(user.id, slug, { deleteGithubRepo: body?.deleteGithubRepo });
  } catch (err: unknown) {
    // Re-throw H3 errors (404, 409, etc.) as-is
    if (isH3Error(err)) {
      throw err;
    }
    // Wrap unexpected errors with a user-friendly message
    const message = err instanceof Error ? err.message : "Unknown error";
    throw createError({ statusCode: 502, statusMessage: `Failed to delete project: ${message}` });
  }

  return { ok: true };
});
