import { inArray } from "drizzle-orm";
import { projects } from "../db/schema";
import { useDb } from "../utils/db";
import { deleteProjectPod, deleteProjectService } from "../utils/k8s";

/**
 * On startup, reset any projects left in transitional states from a previous server run.
 * Projects stuck in "starting" or "stopping" had their lifecycle interrupted (e.g., server
 * restart). Clean up their K8s resources and mark them stopped so they can be restarted.
 */
export default defineNitroPlugin(async () => {
  const db = useDb();

  const stuck = await db
    .select({ id: projects.id, slug: projects.slug })
    .from(projects)
    .where(inArray(projects.status, ["starting", "stopping"]));

  if (stuck.length === 0) return;

  console.log(`[recovery] Resetting ${stuck.length} stuck project(s) to stopped`);

  await Promise.allSettled(
    stuck.map(async ({ slug }) => {
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
        stuck.map((p) => p.id),
      ),
    );

  console.log(`[recovery] Reset complete`);
});
