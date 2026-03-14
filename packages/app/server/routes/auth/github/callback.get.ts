import { users } from "../../../db/schema";
import { createSession, sessionCookieOptions, useGitHubClient } from "../../../utils/auth";
import { encrypt } from "../../../utils/crypto";
import { useDb } from "../../../utils/db";
import { createPreviewToken } from "../../../utils/preview-auth";
import { lookupProject } from "../../../utils/proxy";
import { buildPreviewOrigin } from "../../../utils/proxy-shared";

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string | undefined;
  const state = query.state as string | undefined;
  const storedState = getCookie(event, "github_oauth_state");

  if (!code || !state || !storedState || state !== storedState) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid OAuth state",
    });
  }

  // Clear the state cookie
  deleteCookie(event, "github_oauth_state");

  const github = useGitHubClient();

  let tokens;
  try {
    tokens = await github.validateAuthorizationCode(code);
  } catch (err: unknown) {
    console.error("GitHub OAuth token exchange failed:", err);
    throw createError({
      statusCode: 400,
      statusMessage: "Failed to validate authorization code",
    });
  }

  const accessToken = tokens.accessToken();

  // Fetch GitHub user profile
  const githubUserResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!githubUserResponse.ok) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch GitHub user profile",
    });
  }

  const githubUser = (await githubUserResponse.json()) as GitHubUser;

  const config = useRuntimeConfig();

  // Check allowlist
  const allowedUsers = config.allowedUsers
    ? config.allowedUsers.split(",").map((u: string) => u.trim().toLowerCase())
    : [];
  if (allowedUsers.length > 0 && !allowedUsers.includes(githubUser.login.toLowerCase())) {
    return sendRedirect(event, "/login?error=not_allowed");
  }

  const db = useDb();

  // Encrypt the GitHub access token
  const encryptedToken = encrypt(accessToken, config.encryptionKey);

  // Upsert user (insert or update on githubId conflict)
  const upsertResult = await db
    .insert(users)
    .values({
      githubId: githubUser.id,
      username: githubUser.login,
      displayName: githubUser.name,
      avatarUrl: githubUser.avatar_url,
      encryptedGithubToken: encryptedToken,
    })
    .onConflictDoUpdate({
      target: users.githubId,
      set: {
        username: githubUser.login,
        displayName: githubUser.name,
        avatarUrl: githubUser.avatar_url,
        encryptedGithubToken: encryptedToken,
        updatedAt: new Date(),
      },
    })
    .returning({ id: users.id });

  const userId = upsertResult[0].id;

  // Create session
  const sessionToken = await createSession(userId);

  // Set session cookie on the main app domain
  setCookie(event, "portable_session", sessionToken, {
    ...sessionCookieOptions(),
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  // Check for preview return cookie (set by /api/preview-auth when user wasn't logged in)
  const previewReturn = getCookie(event, "__preview_return");
  if (previewReturn) {
    deleteCookie(event, "__preview_return");
    try {
      const { slug, redirect } = JSON.parse(previewReturn) as {
        slug: string;
        redirect: string;
      };

      // Sanitize redirect
      const safeRedirect =
        redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";

      const project = await lookupProject(slug, userId);
      if (project && project.status === "running") {
        const token = createPreviewToken(userId, slug, config.encryptionKey, 5 * 60);
        const previewOrigin = buildPreviewOrigin(slug, config.baseUrl);
        const callbackUrl = `${previewOrigin}/__portable_auth_cb?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(safeRedirect)}`;
        return sendRedirect(event, callbackUrl);
      }
    } catch {
      // Malformed cookie -- fall through to default redirect
    }
  }

  return sendRedirect(event, "/");
});
