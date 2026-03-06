import { getDecryptedGithubToken, listUserRepos } from "../../utils/github";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const query = getQuery(event);
  const search = typeof query.search === "string" ? query.search : undefined;

  const githubToken = await getDecryptedGithubToken(user.id);
  let repos = await listUserRepos(githubToken);

  if (search) {
    const lower = search.toLowerCase();
    repos = repos.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.fullName.toLowerCase().includes(lower) ||
        (r.description && r.description.toLowerCase().includes(lower)),
    );
  }

  return { repos };
});
