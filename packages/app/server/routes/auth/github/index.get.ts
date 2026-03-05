import * as arctic from "arctic";
import { useGitHubClient } from "../../../utils/auth";

export default defineEventHandler(async (event) => {
  const github = useGitHubClient();
  const state = arctic.generateState();
  const scopes = ["repo", "read:user", "delete_repo"];

  const url = github.createAuthorizationURL(state, scopes);

  setCookie(event, "github_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
    sameSite: "lax",
  });

  return sendRedirect(event, url.toString());
});
