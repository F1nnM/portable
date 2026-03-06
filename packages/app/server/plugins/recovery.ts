import { eq, inArray } from "drizzle-orm";
import { projects } from "../db/schema";
import { useDb, waitForMigrations } from "../utils/db";
import { deleteProjectPod, deleteProjectService } from "../utils/k8s";

/**
 * On startup, reset any projects left in transitional states from a previous server run.
 * Waits for migrations to complete first since Nitro does not await async plugins.
 */
export default defineNitroPlugin(() => {
  if (!process.env.DATABASE_URL) {
    return;
  }

  waitForMigrations()
    .then(async () => {
      const db = useDb();

      // Projects stuck in "creating" get set to "error" (they may lack repo/DB)
      const stuckCreating = await db
        .select({ id: projects.id, slug: projects.slug })
        .from(projects)
        .where(eq(projects.status, "creating"));

      if (stuckCreating.length > 0) {
        console.log(
          `[recovery] Marking ${stuckCreating.length} stuck creating project(s) as error`,
        );
        await db
          .update(projects)
          .set({ status: "error", updatedAt: new Date() })
          .where(
            inArray(
              projects.id,
              stuckCreating.map((p) => p.id),
            ),
          );
      }

      // Projects stuck in "starting"/"stopping" get cleaned up and set to "stopped"
      const stuckTransitioning = await db
        .select({ id: projects.id, slug: projects.slug })
        .from(projects)
        .where(inArray(projects.status, ["starting", "stopping"]));

      if (stuckTransitioning.length > 0) {
        console.log(
          `[recovery] Resetting ${stuckTransitioning.length} stuck project(s) to stopped`,
        );

        await Promise.allSettled(
          stuckTransitioning.map(async ({ slug }) => {
            await deleteProjectPod(slug).catch(() => {});
            await deleteProjectService(slug).catch(() => {});
          }),
        );

        await db
          .update(projects)
          .set({ status: "stopped", podName: null, updatedAt: new Date() })
          .where(
            inArray(
              projects.id,
              stuckTransitioning.map((p) => p.id),
            ),
          );
      }

      if (stuckCreating.length > 0 || stuckTransitioning.length > 0) {
        console.log(`[recovery] Reset complete`);
      }
    })
    .catch((err) => {
      console.error("[recovery] Failed to run recovery after migrations:", err);
    });
});
