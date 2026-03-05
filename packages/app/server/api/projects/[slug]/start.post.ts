import { startProject } from "../../../utils/project-lifecycle";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Slug is required" });
  }

  // Fire and forget — status transitions (starting → running / error) happen via DB.
  // The client polls for status changes while transitioning.
  startProject(user.id, slug).catch((err: unknown) => {
    console.error(`Failed to start project ${slug}:`, err);
  });

  setResponseStatus(event, 202);
  return { ok: true };
});
