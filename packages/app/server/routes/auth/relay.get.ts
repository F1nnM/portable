import { getDomainFromBaseUrl, parseSubdomain } from "../../utils/proxy-shared";
import { createRelayToken } from "../../utils/relay-token";

/**
 * Auth relay endpoint. Transfers the user's session from the main app domain
 * to a project subdomain by issuing a short-lived signed token.
 *
 * Flow:
 * 1. User visits a project subdomain without a session cookie
 * 2. Proxy plugin redirects to `/auth/relay?redirect=<url>`
 * 3. This handler validates the main-domain session (cookie is available here)
 * 4. Creates a signed relay token and redirects to `<url>?__portable_relay=<token>`
 * 5. Proxy plugin intercepts the token, sets a subdomain-scoped cookie, and strips the param
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const redirect = query.redirect as string | undefined;

  if (!redirect) {
    throw createError({ statusCode: 400, statusMessage: "Missing redirect parameter" });
  }

  // Validate the redirect URL is a project subdomain (prevent open redirect)
  const config = useRuntimeConfig();
  const domain = getDomainFromBaseUrl(config.baseUrl);
  let redirectUrl: URL;
  try {
    redirectUrl = new URL(redirect);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid redirect URL" });
  }

  const subdomain = parseSubdomain(redirectUrl.hostname, domain);
  if (!subdomain) {
    throw createError({ statusCode: 400, statusMessage: "Redirect must be a project subdomain" });
  }

  // Require authentication (auth middleware has already validated the session)
  const user = event.context.user;
  if (!user) {
    // Not logged in — send to GitHub OAuth, then come back here
    const loginUrl = new URL("/auth/github", config.baseUrl);
    // Store the relay redirect in a cookie so the callback can continue the flow
    setCookie(event, "portable_relay_redirect", redirect, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600, // 10 minutes
      sameSite: "lax",
    });
    return sendRedirect(event, loginUrl.toString());
  }

  // User is authenticated — create a relay token from their session cookie
  const sessionToken = getCookie(event, "portable_session");
  if (!sessionToken) {
    throw createError({ statusCode: 401, statusMessage: "No session cookie" });
  }

  const token = createRelayToken(sessionToken, config.encryptionKey);

  // Append the relay token to the redirect URL
  redirectUrl.searchParams.set("__portable_relay", token);
  return sendRedirect(event, redirectUrl.toString());
});
