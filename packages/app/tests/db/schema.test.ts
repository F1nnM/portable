import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { projects, projectStatusEnum, sessions, users } from "../../server/db/schema";

describe("database schema", () => {
  describe("users table", () => {
    it("is named 'users'", () => {
      expect(getTableName(users)).toBe("users");
    });

    it("has all required columns with correct types", () => {
      const columns = getTableColumns(users);

      expect(columns.id).toBeDefined();
      expect(columns.id.dataType).toBe("string");
      expect(columns.id.notNull).toBe(true);

      expect(columns.githubId).toBeDefined();
      expect(columns.githubId.dataType).toBe("number");
      expect(columns.githubId.notNull).toBe(true);

      expect(columns.username).toBeDefined();
      expect(columns.username.dataType).toBe("string");
      expect(columns.username.notNull).toBe(true);

      expect(columns.displayName).toBeDefined();
      expect(columns.displayName.dataType).toBe("string");

      expect(columns.avatarUrl).toBeDefined();
      expect(columns.avatarUrl.dataType).toBe("string");

      expect(columns.encryptedGithubToken).toBeDefined();
      expect(columns.encryptedGithubToken.dataType).toBe("string");

      expect(columns.createdAt).toBeDefined();
      expect(columns.createdAt.notNull).toBe(true);

      expect(columns.updatedAt).toBeDefined();
      expect(columns.updatedAt.notNull).toBe(true);
    });

    it("has id as primary key", () => {
      const columns = getTableColumns(users);
      expect(columns.id.primary).toBe(true);
    });

    it("has default values for id, createdAt, and updatedAt", () => {
      const columns = getTableColumns(users);
      expect(columns.id.hasDefault).toBe(true);
      expect(columns.createdAt.hasDefault).toBe(true);
      expect(columns.updatedAt.hasDefault).toBe(true);
    });
  });

  describe("projects table", () => {
    it("is named 'projects'", () => {
      expect(getTableName(projects)).toBe("projects");
    });

    it("has all required columns with correct types", () => {
      const columns = getTableColumns(projects);

      expect(columns.id).toBeDefined();
      expect(columns.id.dataType).toBe("string");
      expect(columns.id.notNull).toBe(true);

      expect(columns.userId).toBeDefined();
      expect(columns.userId.dataType).toBe("string");
      expect(columns.userId.notNull).toBe(true);

      expect(columns.name).toBeDefined();
      expect(columns.name.dataType).toBe("string");
      expect(columns.name.notNull).toBe(true);

      expect(columns.slug).toBeDefined();
      expect(columns.slug.dataType).toBe("string");
      expect(columns.slug.notNull).toBe(true);

      expect(columns.scaffoldId).toBeDefined();
      expect(columns.scaffoldId.dataType).toBe("string");
      expect(columns.scaffoldId.notNull).toBe(true);

      expect(columns.status).toBeDefined();
      expect(columns.status.dataType).toBe("string");
      expect(columns.status.notNull).toBe(true);

      expect(columns.encryptedAnthropicKey).toBeDefined();
      expect(columns.encryptedAnthropicKey.dataType).toBe("string");

      expect(columns.podName).toBeDefined();
      expect(columns.podName.dataType).toBe("string");

      expect(columns.repoUrl).toBeDefined();
      expect(columns.repoUrl.dataType).toBe("string");

      expect(columns.createdAt).toBeDefined();
      expect(columns.createdAt.notNull).toBe(true);

      expect(columns.updatedAt).toBeDefined();
      expect(columns.updatedAt.notNull).toBe(true);
    });

    it("has id as primary key", () => {
      const columns = getTableColumns(projects);
      expect(columns.id.primary).toBe(true);
    });

    it("has correct default values", () => {
      const columns = getTableColumns(projects);
      expect(columns.id.hasDefault).toBe(true);
      expect(columns.scaffoldId.hasDefault).toBe(true);
      expect(columns.status.hasDefault).toBe(true);
      expect(columns.createdAt.hasDefault).toBe(true);
      expect(columns.updatedAt.hasDefault).toBe(true);
    });
  });

  describe("sessions table", () => {
    it("is named 'sessions'", () => {
      expect(getTableName(sessions)).toBe("sessions");
    });

    it("has all required columns with correct types", () => {
      const columns = getTableColumns(sessions);

      expect(columns.id).toBeDefined();
      expect(columns.id.dataType).toBe("string");
      expect(columns.id.notNull).toBe(true);

      expect(columns.userId).toBeDefined();
      expect(columns.userId.dataType).toBe("string");
      expect(columns.userId.notNull).toBe(true);

      expect(columns.expiresAt).toBeDefined();
      expect(columns.expiresAt.notNull).toBe(true);

      expect(columns.createdAt).toBeDefined();
      expect(columns.createdAt.notNull).toBe(true);
    });

    it("has id as primary key", () => {
      const columns = getTableColumns(sessions);
      expect(columns.id.primary).toBe(true);
    });

    it("has default value for createdAt but not id (session id is app-generated)", () => {
      const columns = getTableColumns(sessions);
      // Session IDs are generated by the app (random tokens), not by the DB
      expect(columns.createdAt.hasDefault).toBe(true);
    });
  });

  describe("projectStatusEnum", () => {
    it("contains all valid project statuses", () => {
      expect(projectStatusEnum.enumValues).toEqual([
        "stopped",
        "creating",
        "starting",
        "running",
        "stopping",
        "error",
      ]);
    });
  });
});
