import { integer, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const projectStatusEnum = pgEnum("project_status", [
  "stopped",
  "starting",
  "running",
  "stopping",
  "error",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: integer("github_id").unique().notNull(),
  username: text("username").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  encryptedGithubToken: text("encrypted_github_token"),
  encryptedAnthropicKey: text("encrypted_anthropic_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    scaffoldId: text("scaffold_id").notNull().default("nuxt-postgres"),
    status: projectStatusEnum("status").notNull().default("stopped"),
    encryptedAnthropicKey: text("encrypted_anthropic_key"),
    podName: text("pod_name"),
    repoUrl: text("repo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("projects_user_id_slug_unique").on(table.userId, table.slug)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
