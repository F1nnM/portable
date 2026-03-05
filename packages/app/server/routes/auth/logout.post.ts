import { deleteSession } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, "portable_session");

  if (sessionToken) {
    try {
      await deleteSession(sessionToken);
    } catch {
      // Session cleanup is best-effort; the cookie is still cleared below
    }
  }

  // Clear the session cookie regardless
  deleteCookie(event, "portable_session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return { ok: true };
});
