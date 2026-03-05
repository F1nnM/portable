import { and, eq } from "drizzle-orm";
import { projects, users } from "../db/schema";
import { decrypt } from "./crypto";
import { useDb } from "./db";
import { deleteGitHubRepo, getDecryptedGithubToken, parseGitHubRepoUrl } from "./github";
import {
  createProjectPod,
  createProjectPVC,
  createProjectService,
  deleteProjectPod,
  deleteProjectPVC,
  deleteProjectService,
  waitForPodReady,
} from "./k8s";
import { createProjectDatabase, deleteProjectDatabase } from "./project-db";

/**
 * Checks if a K8s error is an AlreadyExists (409) error.
 */
function isK8sAlreadyExists(err: unknown): boolean {
  if (err && typeof err === "object" && "statusCode" in err) {
    return (err as { statusCode: number }).statusCode === 409;
  }
  return false;
}

/**
 * Updates the status of a project in the database.
 */
async function updateProjectStatus(
  projectId: string,
  status: "stopped" | "starting" | "running" | "stopping" | "error",
  podName?: string | null,
): Promise<void> {
  const db = useDb();
  const set: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };
  if (podName !== undefined) {
    set.podName = podName;
  }
  await db.update(projects).set(set).where(eq(projects.id, projectId));
}

/**
 * Looks up a project by slug + userId, throwing 404 if not found.
 */
async function lookupProject(userId: string, slug: string) {
  const db = useDb();
  const result = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.slug, slug)))
    .limit(1);

  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: "Project not found" });
  }

  return result[0];
}

/**
 * Returns the encryption key from runtime config or environment.
 */
function getEncryptionKey(): string {
  // In Nitro server context, useRuntimeConfig() is available.
  // We try it first, falling back to the env var for testability.
  try {
    const config = useRuntimeConfig();
    if (config.encryptionKey) return config.encryptionKey;
  } catch {
    // Not in Nuxt context (e.g., tests)
  }
  const key = process.env.NUXT_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("Encryption key not configured");
  }
  return key;
}

/**
 * Retrieves the decrypted Anthropic API key for a project.
 * Checks the project-level key first, then falls back to the user-level key.
 */
async function getAnthropicKey(
  userId: string,
  projectEncryptedKey: string | null,
): Promise<string | undefined> {
  const encryptionKey = getEncryptionKey();

  // Project-level key takes precedence
  if (projectEncryptedKey) {
    return decrypt(projectEncryptedKey, encryptionKey);
  }

  // Fall back to user-level key
  const db = useDb();
  const result = await db
    .select({ encryptedAnthropicKey: users.encryptedAnthropicKey })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (result.length > 0 && result[0].encryptedAnthropicKey) {
    return decrypt(result[0].encryptedAnthropicKey, encryptionKey);
  }

  return undefined;
}

/**
 * Starts a project: creates the per-project DB, PVC, pod, and service.
 * Updates the project status throughout the process.
 */
export async function startProject(userId: string, slug: string): Promise<void> {
  const project = await lookupProject(userId, slug);

  // Only stopped or error projects can be started
  if (project.status !== "stopped" && project.status !== "error") {
    throw createError({
      statusCode: 409,
      statusMessage: `Cannot start project in "${project.status}" state`,
    });
  }

  // Update to starting
  await updateProjectStatus(project.id, "starting");

  try {
    // Get credentials
    const githubToken = await getDecryptedGithubToken(userId);
    const anthropicApiKey = await getAnthropicKey(userId, project.encryptedAnthropicKey);

    // Create per-project database
    const databaseUrl = await createProjectDatabase(slug);

    // Create PVC (ignore AlreadyExists for retries after partial failure)
    try {
      await createProjectPVC(slug);
    } catch (err: unknown) {
      if (!isK8sAlreadyExists(err)) throw err;
    }

    // Create pod (ignore AlreadyExists for retries after partial failure)
    try {
      await createProjectPod({
        slug,
        databaseUrl,
        githubToken,
        anthropicApiKey,
        repoUrl: project.repoUrl ?? undefined,
      });
    } catch (err: unknown) {
      if (!isK8sAlreadyExists(err)) throw err;
    }

    // Create headless service (ignore AlreadyExists for retries after partial failure)
    try {
      await createProjectService(slug);
    } catch (err: unknown) {
      if (!isK8sAlreadyExists(err)) throw err;
    }

    // Wait for pod ready
    await waitForPodReady(slug);

    // Update to running
    const podName = `project-${slug}`;
    await updateProjectStatus(project.id, "running", podName);
  } catch (err: unknown) {
    // On failure: set status to error and attempt cleanup
    await updateProjectStatus(project.id, "error").catch(() => {
      // Swallow status-update errors to avoid masking the original error
    });

    // Attempt to clean up any partially-created resources
    try {
      await deleteProjectPod(slug);
      await deleteProjectService(slug);
    } catch {
      // Swallow cleanup errors
    }

    throw err;
  }
}

/**
 * Stops a project: deletes the pod and service (keeps PVC for data persistence).
 */
export async function stopProject(userId: string, slug: string): Promise<void> {
  const project = await lookupProject(userId, slug);

  // Only running, starting, or error projects can be stopped
  if (project.status !== "running" && project.status !== "starting" && project.status !== "error") {
    throw createError({
      statusCode: 409,
      statusMessage: `Cannot stop project in "${project.status}" state`,
    });
  }

  // Update to stopping
  await updateProjectStatus(project.id, "stopping");

  try {
    await deleteProjectPod(slug);
    await deleteProjectService(slug);

    // Update to stopped, clear podName
    await updateProjectStatus(project.id, "stopped", null);
  } catch (err: unknown) {
    await updateProjectStatus(project.id, "error").catch(() => {});
    throw err;
  }
}

/**
 * Deletes a project: cleans up all K8s resources, per-project DB, and the DB row.
 */
export async function deleteProject(
  userId: string,
  slug: string,
  options?: { deleteGithubRepo?: boolean },
): Promise<void> {
  // Verify project exists and belongs to user (throws 404 if not found)
  const project = await lookupProject(userId, slug);

  // Optionally delete the GitHub repo
  if (options?.deleteGithubRepo && project.repoUrl) {
    const parsed = parseGitHubRepoUrl(project.repoUrl);
    if (parsed) {
      const githubToken = await getDecryptedGithubToken(userId);
      await deleteGitHubRepo(githubToken, parsed.owner, parsed.repo);
    }
  }

  // Clean up K8s resources (all delete functions handle 404 gracefully)
  await deleteProjectPod(slug);
  await deleteProjectService(slug);
  await deleteProjectPVC(slug);

  // Clean up per-project database
  await deleteProjectDatabase(slug);

  // Delete the DB row
  const db = useDb();
  await db.delete(projects).where(and(eq(projects.userId, userId), eq(projects.slug, slug)));
}
