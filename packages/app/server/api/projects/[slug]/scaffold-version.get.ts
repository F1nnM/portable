import { and, eq } from "drizzle-orm";
import { projects } from "../../../db/schema";
import { useDb } from "../../../utils/db";
import { parsePortableYaml } from "../../../utils/scaffold-version";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) throw createError({ statusCode: 401 });

  const slug = getRouterParam(event, "slug");
  if (!slug) throw createError({ statusCode: 400, message: "Missing slug" });

  const db = useDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, slug), eq(projects.userId, user.id)))
    .limit(1);

  if (!project) throw createError({ statusCode: 404, message: "Project not found" });
  if (project.status !== "running") {
    return { needsMigration: false, reason: "not_running" };
  }

  const config = useRuntimeConfig();
  const currentVersion = config.scaffoldVersion;

  // Read .portable.yaml from the pod
  const namespace = config.podNamespace;
  const podUrl = `http://project-${slug}.${namespace}.svc.cluster.local:3000`;

  try {
    const fileContent = await $fetch<string>(`${podUrl}/api/files/.portable.yaml`, {
      responseType: "text",
    });

    const parsed = parsePortableYaml(fileContent);

    if (!parsed) {
      return {
        needsMigration: true,
        reason: "malformed_file",
        scaffoldId: project.scaffoldId,
        currentVersion,
        scaffoldRepoUrl: config.scaffoldRepoUrl,
      };
    }

    if (currentVersion && parsed.version !== currentVersion) {
      return {
        needsMigration: true,
        reason: "version_mismatch",
        scaffoldId: project.scaffoldId,
        projectVersion: parsed.version,
        projectScaffoldPath: parsed.path,
        projectScaffoldRepo: parsed.repo,
        currentVersion,
        scaffoldRepoUrl: config.scaffoldRepoUrl,
      };
    }

    return { needsMigration: false };
  } catch {
    if (project.scaffoldId) {
      return {
        needsMigration: true,
        reason: "missing_file_scaffold",
        scaffoldId: project.scaffoldId,
        currentVersion,
        scaffoldRepoUrl: config.scaffoldRepoUrl,
      };
    }

    return {
      needsMigration: true,
      reason: "missing_file_imported",
      currentVersion,
      scaffoldRepoUrl: config.scaffoldRepoUrl,
    };
  }
});
