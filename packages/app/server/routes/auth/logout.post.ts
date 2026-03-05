import { deleteSession, sessionCookieOptions } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, "portable_session");

  if (sessionToken) {
    try {
      await deleteSession(sessionToken);
    } catch {
      // Session cleanup is best-effort; the cookie is still cleared below
    }
  }

  // Clear the session cookie — must use same domain as when it was set
  deleteCookie(event, "portable_session", sessionCookieOptions());

  return { ok: true };
});
