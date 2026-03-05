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

  const files: ScaffoldFile[] = [];

  function walkDir(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules and .git
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        walkDir(fullPath);
      } else if (entry.isFile()) {
        const relativePath = relative(scaffoldDir, fullPath);
        const content = readFileSync(fullPath, "utf-8");
        files.push({ path: relativePath, content });
      }
    }
  }

  walkDir(scaffoldDir);
  return files;
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
