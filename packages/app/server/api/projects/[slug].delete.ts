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

  const body = await readBody<{ deleteGithubRepo?: boolean }>(event).catch(() => ({}));

  await deleteProject(user.id, slug, { deleteGithubRepo: body?.deleteGithubRepo });

  return { ok: true };
});
