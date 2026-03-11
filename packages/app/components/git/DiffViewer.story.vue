<script setup lang="ts">
import DiffViewer from "./DiffViewer.vue";

const simpleDiff = `--- a/server/utils/db.ts
+++ b/server/utils/db.ts
@@ -1,7 +1,9 @@
 import { drizzle } from "drizzle-orm/postgres-js";
 import postgres from "postgres";
+import { logger } from "./logger";

-const sql = postgres(process.env.DATABASE_URL!);
+const connectionString = process.env.DATABASE_URL!;
+const sql = postgres(connectionString, { max: 10 });
 export const db = drizzle(sql);

 export async function getUsers() {`;

const multiHunkDiff = [
  "--- a/server/routes/api/users.ts",
  "+++ b/server/routes/api/users.ts",
  "@@ -3,8 +3,10 @@",
  " import { db } from '../utils/db';",
  " import { users } from '../db/schema';",
  "+import { eq } from 'drizzle-orm';",
  " ",
  "-export default defineEventHandler(async () => {",
  "-  return db.select().from(users);",
  "+export default defineEventHandler(async (event) => {",
  "+  const query = getQuery(event);",
  "+  const limit = Number(query.limit) || 50;",
  "+  return db.select().from(users).limit(limit);",
  " });",
  "@@ -14,6 +16,10 @@",
  " export const createUser = defineEventHandler(async (event) => {",
  "   const body = await readBody(event);",
  "-  return db.insert(users).values(body);",
  "+  const result = await db.insert(users).values(body).returning();",
  "+  return {",
  "+    user: result[0],",
  "+    created: true,",
  "+  };",
  " });",
].join("\n");

const addedFileDiff = `--- /dev/null
+++ b/server/utils/logger.ts
@@ -0,0 +1,12 @@
+export function logger(level: string, message: string) {
+  const timestamp = new Date().toISOString();
+  console.log(\`[\${timestamp}] [\${level.toUpperCase()}] \${message}\`);
+}
+
+export function info(message: string) {
+  logger("info", message);
+}
+
+export function error(message: string) {
+  logger("error", message);
+}`;

const deletedLinesDiff = `--- a/config/old-settings.ts
+++ b/config/old-settings.ts
@@ -5,10 +5,4 @@
 export const config = {
   appName: "Portable",
   version: "2.0.0",
-  legacyMode: true,
-  deprecatedFeature: "enabled",
-  oldApiEndpoint: "/api/v1",
-  compatibilityShim: true,
-  debugMode: false,
-  verbose: true,
 };`;

function logAction(action: string, ...args: unknown[]) {
  console.log(`[DiffViewer] ${action}`, ...args);
}
</script>

<template>
  <Story title="Git / DiffViewer" group="git">
    <Variant title="Simple Change">
      <div
        style="
          height: 400px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        "
      >
        <DiffViewer
          filename="server/utils/db.ts"
          :diff="simpleDiff"
          @back="logAction('back')"
          @view-file="(p) => logAction('viewFile', p)"
        />
      </div>
    </Variant>

    <Variant title="Multiple Hunks">
      <div
        style="
          height: 500px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        "
      >
        <DiffViewer
          filename="server/routes/api/users.ts"
          :diff="multiHunkDiff"
          @back="logAction('back')"
          @view-file="(p) => logAction('viewFile', p)"
        />
      </div>
    </Variant>

    <Variant title="New File (All Added)">
      <div
        style="
          height: 400px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        "
      >
        <DiffViewer
          filename="server/utils/logger.ts"
          :diff="addedFileDiff"
          @back="logAction('back')"
          @view-file="(p) => logAction('viewFile', p)"
        />
      </div>
    </Variant>

    <Variant title="Deleted Lines">
      <div
        style="
          height: 350px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        "
      >
        <DiffViewer
          filename="config/old-settings.ts"
          :diff="deletedLinesDiff"
          @back="logAction('back')"
          @view-file="(p) => logAction('viewFile', p)"
        />
      </div>
    </Variant>
  </Story>
</template>
