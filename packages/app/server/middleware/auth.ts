import type { SessionUser } from "../utils/auth";
import { validateSession } from "../utils/auth";

declare module "h3" {
  interface H3EventContext {
    user: SessionUser | null;
  }
}

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, "portable_session");

  if (!sessionToken) {
    event.context.user = null;
    return;
  }

  try {
    const user = await validateSession(sessionToken);
    event.context.user = user;
  } catch {
    event.context.user = null;
  }
});
