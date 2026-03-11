import { createPreviewToken } from "../utils/preview-auth";
import { lookupProject } from "../utils/proxy";
import { buildPreviewOrigin } from "../utils/proxy-shared";

const REDIRECT_TOKEN_TTL = 5 * 60; // 5 minutes
const PREVIEW_RETURN_COOKIE_MAX_AGE = 10 * 60; // 10 minutes

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const slug = query.slug as string | undefined;
  const redirect = (query.redirect as string | undefined) || "/";

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: "Missing slug parameter" });
  }

  // Sanitize redirect: must start with "/" and not "//"
  if (!redirect.startsWith("/") || redirect.startsWith("//")) {
    throw createError({ statusCode: 400, statusMessage: "Invalid redirect parameter" });
  }

  const user = event.context.user;
  const config = useRuntimeConfig();

  if (user) {
    // User is logged in -- verify project ownership and create token
    const project = await lookupProject(slug, user.id);
    if (!project) {
      throw createError({ statusCode: 404, statusMessage: "Project not found" });
    }
    if (project.status !== "running") {
      throw createError({ statusCode: 503, statusMessage: "Project is not running" });
    }

    const token = createPreviewToken(user.id, slug, config.encryptionKey, REDIRECT_TOKEN_TTL);
    const previewOrigin = buildPreviewOrigin(slug, config.baseUrl);
    const callbackUrl = `${previewOrigin}/__portable_auth_cb?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(redirect)}`;

    return sendRedirect(event, callbackUrl);
  }

  // Not logged in -- store return info and redirect to GitHub OAuth
  setCookie(event, "__preview_return", JSON.stringify({ slug, redirect }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PREVIEW_RETURN_COOKIE_MAX_AGE,
  });

  return sendRedirect(event, "/auth/github");
});
