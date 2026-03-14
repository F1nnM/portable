import { Buffer } from "node:buffer";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { Octokit } from "octokit";
import { users } from "../db/schema";
import { decrypt } from "./crypto";
import { useDb } from "./db";

export interface Scaffold {
  id: string;
  name: string;
  description: string;
}

export interface ScaffoldFile {
  path: string;
  content: string;
}

export interface CreateRepoResult {
  owner: string;
  repo: string;
  cloneUrl: string;
  htmlUrl: string;
}

const SCAFFOLD_METADATA: Record<string, { name: string; description: string }> = {
  "nuxt-postgres": {
    name: "Nuxt + Postgres",
    description: "Nuxt 3 full-stack app with Postgres database using Drizzle ORM",
  },
};

/**
 * Resolves the path to the scaffolds directory.
 * Searches multiple candidate locations to work across dev, test, and production contexts.
 */
function getScaffoldsDir(): string {
  const candidates: string[] = [];

  // From process.cwd() (works during Nuxt dev, build, and test)
  candidates.push(resolve(process.cwd(), "../../scaffolds"));
  candidates.push(resolve(process.cwd(), "scaffolds"));

  // From this file's location in the source tree
  try {
    const thisDir = dirname(fileURLToPath(import.meta.url));
    candidates.push(resolve(thisDir, "../../../../scaffolds"));
  } catch {
    // import.meta.url may not work in all contexts
  }

  for (const dir of candidates) {
    if (existsSync(dir) && existsSync(resolve(dir, "nuxt-postgres"))) {
      return dir;
    }
  }

  throw new Error(`Scaffolds directory not found. Searched: ${candidates.join(", ")}`);
}

/**
 * Lists all available scaffolds by scanning the scaffolds directory.
 */
export function listScaffolds(): Scaffold[] {
  const scaffoldsDir = getScaffoldsDir();
  const entries = readdirSync(scaffoldsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const id = entry.name;
      const metadata = SCAFFOLD_METADATA[id] || {
        name: id,
        description: `Project scaffold: ${id}`,
      };
      return {
        id,
        name: metadata.name,
        description: metadata.description,
      };
    });
}

/**
 * Recursively reads all files from a scaffold directory.
 * Returns an array of { path, content } objects where path is relative to the scaffold root.
 */
export function readScaffoldFiles(scaffoldId: string): ScaffoldFile[] {
  const scaffoldsDir = getScaffoldsDir();
  const scaffoldDir = resolve(scaffoldsDir, scaffoldId);

  if (!existsSync(scaffoldDir)) {
    throw new Error(`Scaffold "${scaffoldId}" not found`);
  }

  const isIgnored = loadGitignore(scaffoldDir);
  const files: ScaffoldFile[] = [];

  function walkDir(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(scaffoldDir, fullPath);
      if (entry.isDirectory()) {
        if (entry.name === ".git" || isIgnored(relativePath, true)) continue;
        walkDir(fullPath);
      } else if (entry.isFile()) {
        if (isIgnored(relativePath, false)) continue;
        const content = readFileSync(fullPath, "utf-8");
        files.push({ path: relativePath, content });
      }
    }
  }

  walkDir(scaffoldDir);
  return files;
}

/**
 * Parses a .gitignore file and returns a function that tests whether a relative path is ignored.
 */
function loadGitignore(dir: string): (path: string, isDir: boolean) => boolean {
  const gitignorePath = join(dir, ".gitignore");
  if (!existsSync(gitignorePath)) return () => false;

  const lines = readFileSync(gitignorePath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const patterns = lines.map((line) => {
    const dirOnly = line.endsWith("/");
    const pattern = dirOnly ? line.slice(0, -1) : line;
    return { pattern, dirOnly };
  });

  return (relPath: string, isDir: boolean) => {
    const segments = relPath.split("/");
    for (const { pattern, dirOnly } of patterns) {
      if (dirOnly && !isDir) continue;
      // Simple glob: *.ext matches filename
      if (pattern.startsWith("*")) {
        const ext = pattern.slice(1);
        if (segments[segments.length - 1].endsWith(ext)) return true;
      } else if (!pattern.includes("/")) {
        // Bare name matches any segment (directory or final filename)
        if (segments.includes(pattern)) return true;
      } else {
        // Pattern with slash matches from root
        if (relPath === pattern || relPath.startsWith(`${pattern}/`)) return true;
      }
    }
    return false;
  };
}

/**
 * Retrieves and decrypts the user's GitHub access token from the database.
 */
export async function getDecryptedGithubToken(userId: string): Promise<string> {
  const db = useDb();
  const config = useRuntimeConfig();

  const result = await db
    .select({ encryptedGithubToken: users.encryptedGithubToken })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (result.length === 0) {
    throw new Error("User not found");
  }

  const encryptedToken = result[0].encryptedGithubToken;

  if (!encryptedToken) {
    throw new Error("No GitHub token stored for this user");
  }

  return decrypt(encryptedToken, config.encryptionKey);
}

/**
 * Creates a new GitHub repository for the authenticated user.
 */
export async function createGitHubRepo(
  token: string,
  name: string,
  isPrivate: boolean = true,
): Promise<CreateRepoResult> {
  const octokit = new Octokit({ auth: token });

  const { data } = await octokit.rest.repos.createForAuthenticatedUser({
    name,
    private: isPrivate,
    auto_init: true,
  });

  return {
    owner: data.owner.login,
    repo: data.name,
    cloneUrl: data.clone_url,
    htmlUrl: data.html_url,
  };
}

/**
 * Pushes scaffold files to a GitHub repo as an initial commit using the Git Data API.
 * This avoids needing git installed locally -- everything is done via REST.
 *
 * Steps:
 * 1. Create blobs for each file
 * 2. Create a tree with all blobs
 * 3. Create a commit with the tree
 * 4. Create the main branch ref pointing to the commit
 */
/**
 * Deletes a GitHub repository.
 */
export async function deleteGitHubRepo(token: string, owner: string, repo: string): Promise<void> {
  const octokit = new Octokit({ auth: token });
  await octokit.rest.repos.delete({ owner, repo });
}

/**
 * Parses a GitHub repo URL into owner and repo components.
 * Supports https://github.com/owner/repo and https://github.com/owner/repo.git
 */
export function parseGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export async function pushScaffoldToRepo(
  token: string,
  owner: string,
  repo: string,
  scaffoldId: string,
): Promise<void> {
  const octokit = new Octokit({ auth: token });
  const files = readScaffoldFiles(scaffoldId);

  // Get the current HEAD commit (repo was created with auto_init: true)
  const { data: ref } = await octokit.rest.git.getRef({ owner, repo, ref: "heads/main" });
  const parentSha = ref.object.sha;

  // Step 1: Create blobs for each file
  const blobPromises = files.map(async (file) => {
    const { data } = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: Buffer.from(file.content, "utf-8").toString("base64"),
      encoding: "base64",
    });
    return {
      path: file.path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: data.sha,
    };
  });

  const treeItems = await Promise.all(blobPromises);

  // Step 2: Create a tree with all blobs
  const { data: tree } = await octokit.rest.git.createTree({
    owner,
    repo,
    tree: treeItems,
  });

  // Step 3: Create a commit on top of the initial commit
  const { data: commit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: "Initial scaffold",
    tree: tree.sha,
    parents: [parentSha],
  });

  // Step 4: Update the main branch to point to the new commit
  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: "heads/main",
    sha: commit.sha,
  });
}

export interface UserRepo {
  name: string;
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  language: string | null;
  defaultBranch: string;
  url: string;
}

/**
 * Lists the authenticated user's GitHub repositories, sorted by most recently updated.
 */
export async function listUserRepos(token: string): Promise<UserRepo[]> {
  const octokit = new Octokit({ auth: token });

  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    per_page: 100,
    sort: "updated",
  });

  return data.map((repo) => ({
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description ?? null,
    isPrivate: repo.private,
    language: repo.language ?? null,
    defaultBranch: repo.default_branch,
    url: repo.html_url,
  }));
}
